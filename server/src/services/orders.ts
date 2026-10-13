import crypto from 'crypto';
import { Order, sequelize, type Learner } from '../db';
import { config } from '../config';
import { getPaymentConfig, webhookUrl } from './settings';
import { getPublishedItem } from './content';
import * as cashfree from './cashfree';

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function orderDto(o: Order) {
  return {
    orderId: o.orderId,
    userId: o.userId,
    courseId: o.courseId,
    courseTitle: o.courseTitle,
    amount: o.amountPaise / 100,
    currency: 'INR' as const,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    status: o.status,
    gateway: 'cashfree' as const,
    gatewayPaymentId: o.gatewayPaymentId,
    bankReference: o.bankReference,
    refundId: o.refundId,
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  };
}

/** What a buyer may see about their own order (the order id itself is the unguessable key). */
export function publicOrderDto(o: Order) {
  return { orderId: o.orderId, courseId: o.courseId, courseTitle: o.courseTitle, amount: o.amountPaise / 100, status: o.status };
}

function newOrderId(): string {
  // Cashfree allows letters, digits, "-" and "_" up to 45 characters.
  return `EB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}


/**
 * Starts a Cashfree checkout for a paid course, on behalf of a signed-in learner. The order is
 * tied to the learner's account, and a paid order is what unlocks the course for them.
 */
export async function createCourseOrder(learner: Learner, input: { courseId?: unknown; name?: unknown; phone?: unknown }) {
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : learner.name;
  // The receipt goes to the account's email; the browser cannot choose another one.
  const email = learner.email;
  const rawPhone = typeof input.phone === 'string' && input.phone.trim() ? input.phone : (learner.phone ?? '');
  const phone = rawPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (name.length < 2 || name.length > 120) throw new OrderError('Please enter your full name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new OrderError('Please enter a valid 10-digit mobile number.');

  const cfg = await getPaymentConfig();
  if (!cfg.enabled) throw new OrderError('Online payment is not available right now. Please contact us to enrol.', 503);

  // The price always comes from the database, never from the browser.
  const course = typeof input.courseId === 'string' ? await getPublishedItem('courses', input.courseId) : null;
  if (!course) throw new OrderError('This course is not available.', 404);
  const price = Number(course.data.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) throw new OrderError('This course is free. Just press Start course.');
  const title = String(course.data.title ?? course.key);
  if (await Order.count({ where: { userId: learner.id, courseId: course.key, status: 'paid' } })) {
    throw new OrderError('You already own this course.', 409);
  }

  const orderId = newOrderId();
  const order = await Order.create({
    orderId,
    userId: learner.id,
    courseId: course.key,
    courseTitle: title.slice(0, 200),
    amountPaise: Math.round(price * 100),
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
  });

  if (learner.phone !== phone) await learner.update({ phone });

  try {
    const cf = await cashfree.createOrder(cfg, {
      orderId,
      amountRupees: price,
      customerId: `learner_${learner.id.replace(/-/g, '')}`,
      name,
      email,
      phone,
      returnUrl: `${config.publicSiteUrl}/payment/status?order_id={order_id}`,
      notifyUrl: webhookUrl() ?? undefined,
      note: `English-Bridgeway course: ${title}`,
      tags: { course_id: course.key.slice(0, 255), customer_name: name.slice(0, 255) },
    });
    return { orderId, paymentSessionId: cf.payment_session_id, mode: cfg.mode };
  } catch (err) {
    await order.update({ status: 'failed' });
    if (err instanceof cashfree.CashfreeNotConfiguredError) throw new OrderError(err.message, 503);
    throw new OrderError('We could not start the payment. Please try again in a moment.', 502);
  }
}

/**
 * Brings an order up to date with what Cashfree says. Cashfree is the source of truth:
 * the browser's return to the site and the webhook both end up here, and the status
 * change is a conditional UPDATE, so repeated or concurrent calls mark it paid once.
 */
export async function syncOrder(orderId: string): Promise<Order> {
  const order = await Order.findByPk(orderId);
  if (!order) throw new OrderError('Order not found.', 404);
  if (order.status !== 'pending') return order;

  const cfg = await getPaymentConfig();
  const cf = await cashfree.getOrder(cfg, orderId);
  if (cf.order_status === 'PAID') {
    if (Math.round(Number(cf.order_amount) * 100) !== order.amountPaise) {
      // Never happens with orders this server created; refuse to unlock on a mismatch.
      throw new OrderError('Paid amount does not match the order. Please contact support.', 409);
    }
    const payments = await cashfree.getOrderPayments(cfg, orderId).catch(() => []);
    const success = payments.find((p) => p.payment_status === 'SUCCESS');
    await sequelize.transaction(async (t) => {
      await Order.update(
        {
          status: 'paid',
          paidAt: new Date(),
          gatewayPaymentId: success ? String(success.cf_payment_id) : null,
          bankReference: success?.bank_reference ?? null,
        },
        { where: { orderId, status: 'pending' }, transaction: t },
      );
    });
  } else if (cf.order_status === 'EXPIRED' || cf.order_status === 'TERMINATED') {
    await Order.update({ status: 'failed' }, { where: { orderId, status: 'pending' } });
  }
  return (await Order.findByPk(orderId))!;
}

export async function refundOrder(orderId: string, reason: string): Promise<Order> {
  const order = await Order.findByPk(orderId);
  if (!order) throw new OrderError('Order not found.', 404);
  if (order.status !== 'paid') throw new OrderError('Only paid orders can be refunded.');
  const cfg = await getPaymentConfig();
  const refundId = `RF-${orderId}`.slice(0, 40);
  try {
    const refund = await cashfree.createRefund(cfg, { orderId, refundId, amountRupees: order.amountPaise / 100, note: reason || 'Refund' });
    if (refund.refund_status === 'FAILED' || refund.refund_status === 'CANCELLED') {
      throw new OrderError(`Cashfree did not accept the refund (${refund.refund_status}).`, 502);
    }
  } catch (err) {
    if (err instanceof OrderError) throw err;
    throw new OrderError(err instanceof Error ? err.message : 'Refund failed.', 502);
  }
  await Order.update({ status: 'refunded', refundId }, { where: { orderId, status: 'paid' } });
  return (await Order.findByPk(orderId))!;
}
