import crypto from 'crypto';
import { Learner, Order, sequelize } from '../db';
import { config } from '../config';
import { getPaymentConfig, webhookUrl } from './settings';
import { getPublishedItem } from './content';
import * as cashfree from './cashfree';
import { addMonths, priceFor } from './access';
import { getActivePlan, planPriceFor } from './plans';

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
    kind: o.planId ? ('plan' as const) : ('course' as const),
    planId: o.planId,
    planMonths: o.planMonths,
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
  return {
    orderId: o.orderId,
    kind: o.planId ? ('plan' as const) : ('course' as const),
    courseId: o.courseId,
    courseTitle: o.courseTitle,
    planMonths: o.planMonths,
    amount: o.amountPaise / 100,
    status: o.status,
  };
}

function newOrderId(): string {
  // Cashfree allows letters, digits, "-" and "_" up to 45 characters.
  return `EB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}


interface BuyerInput {
  name?: unknown;
  phone?: unknown;
}

/** The buyer's name and phone, checked; the email always comes from the account. */
function buyerDetails(learner: Learner, input: BuyerInput) {
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : learner.name;
  const rawPhone = typeof input.phone === 'string' && input.phone.trim() ? input.phone : (learner.phone ?? '');
  const phone = rawPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (name.length < 2 || name.length > 120) throw new OrderError('Please enter your full name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new OrderError('Please enter a valid 10-digit mobile number.');
  return { name, email: learner.email, phone };
}

/** Creates the order row and the Cashfree order behind it, and returns what the browser's checkout needs. */
async function startCheckout(
  learner: Learner,
  buyer: { name: string; email: string; phone: string },
  item: { courseId: string; title: string; price: number; planId?: string; planMonths?: number; note: string; tags: Record<string, string> },
) {
  const cfg = await getPaymentConfig();
  const orderId = newOrderId();
  const order = await Order.create({
    orderId,
    userId: learner.id,
    courseId: item.courseId,
    courseTitle: item.title.slice(0, 200),
    planId: item.planId ?? null,
    planMonths: item.planMonths ?? null,
    amountPaise: Math.round(item.price * 100),
    customerName: buyer.name,
    customerEmail: buyer.email,
    customerPhone: buyer.phone,
  });

  if (learner.phone !== buyer.phone) await learner.update({ phone: buyer.phone });

  try {
    const cf = await cashfree.createOrder(cfg, {
      orderId,
      amountRupees: item.price,
      customerId: `learner_${learner.id.replace(/-/g, '')}`,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      returnUrl: `${config.publicSiteUrl}/payment/status?order_id={order_id}`,
      notifyUrl: webhookUrl() ?? undefined,
      note: item.note,
      tags: { ...item.tags, customer_name: buyer.name.slice(0, 255) },
    });
    return { orderId, paymentSessionId: cf.payment_session_id, mode: cfg.mode };
  } catch (err) {
    await order.update({ status: 'failed' });
    if (err instanceof cashfree.CashfreeNotConfiguredError) throw new OrderError(err.message, 503);
    console.error('Cashfree createOrder failed:', err instanceof Error ? err.message : err);
    throw new OrderError('We could not start the payment. Please try again in a moment.', 502);
  }
}

async function ensurePaymentsOn() {
  const cfg = await getPaymentConfig();
  if (!cfg.enabled) throw new OrderError('Online payment is not available right now. Please contact us to enrol.', 503);
}

/**
 * Starts a Cashfree checkout for a paid course, on behalf of a signed-in learner. The order is
 * tied to the learner's account, and a paid order is what unlocks the course for them.
 */
export async function createCourseOrder(learner: Learner, input: BuyerInput & { courseId?: unknown }) {
  const buyer = buyerDetails(learner, input);
  await ensurePaymentsOn();

  // The price always comes from the database, never from the browser.
  const course = typeof input.courseId === 'string' ? await getPublishedItem('courses', input.courseId) : null;
  if (!course) throw new OrderError('This course is not available.', 404);
  const listPrice = Number(course.data.price ?? 0);
  if (!Number.isFinite(listPrice) || listPrice <= 0) throw new OrderError('This course is free. Just press Start course.');
  // A special offer the admin gave this learner lowers the price (never raises it).
  const price = priceFor(learner, course.key, listPrice);
  const title = String(course.data.title ?? course.key);
  if (await Order.count({ where: { userId: learner.id, courseId: course.key, status: 'paid' } })) {
    throw new OrderError('You already own this course.', 409);
  }
  return startCheckout(learner, buyer, {
    courseId: course.key,
    title,
    price,
    note: `English-Bridgeway course: ${title}`,
    tags: { course_id: course.key.slice(0, 255) },
  });
}

/**
 * Starts a Cashfree checkout for a subscription plan. When it is paid, syncOrder moves the
 * learner's access end date forward by the plan's months (see grantPlanAccess).
 */
export async function createPlanOrder(learner: Learner, input: BuyerInput & { planId?: unknown }) {
  const buyer = buyerDetails(learner, input);
  await ensurePaymentsOn();
  const plan = await getActivePlan(input.planId);
  if (!plan) throw new OrderError('This plan is not available.', 404);
  if (learner.accessUnlimited) throw new OrderError('You already have full access with no end date.', 409);
  const price = planPriceFor(learner, plan);
  return startCheckout(learner, buyer, {
    courseId: `plan:${plan.id}`,
    title: `Subscription: ${plan.name}`,
    price,
    planId: plan.id,
    planMonths: plan.months,
    note: `English-Bridgeway subscription: ${plan.name}`,
    tags: { plan_id: plan.id },
  });
}

/**
 * Adds a paid plan's months to the learner's access. It starts from whichever is later: now,
 * the end of access they already have, or the end of their free trial, so nothing is lost.
 */
export async function grantPlanAccess(learnerId: string, months: number, t?: import('sequelize').Transaction) {
  const learner = await Learner.findByPk(learnerId, { transaction: t, lock: t ? true : undefined });
  if (!learner || learner.accessUnlimited) return;
  const now = Date.now();
  const from = Math.max(now, learner.accessUntil?.getTime() ?? 0, learner.trialEndsAt?.getTime() ?? 0);
  await learner.update({ accessUntil: addMonths(new Date(from), months) }, { transaction: t });
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
      const [changed] = await Order.update(
        {
          status: 'paid',
          paidAt: new Date(),
          gatewayPaymentId: success ? String(success.cf_payment_id) : null,
          bankReference: success?.bank_reference ?? null,
        },
        { where: { orderId, status: 'pending' }, transaction: t },
      );
      // Only the call that actually marked it paid adds the plan's months, so it happens once.
      if (changed === 1 && order.planMonths && order.userId) await grantPlanAccess(order.userId, order.planMonths, t);
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
  await sequelize.transaction(async (t) => {
    const [changed] = await Order.update({ status: 'refunded', refundId }, { where: { orderId, status: 'paid' }, transaction: t });
    // A refunded subscription takes its months back off the learner's access end date.
    if (changed === 1 && order.planMonths && order.userId) {
      const learner = await Learner.findByPk(order.userId, { transaction: t, lock: true });
      if (learner?.accessUntil && !learner.accessUnlimited) {
        const back = addMonths(learner.accessUntil, -order.planMonths);
        await learner.update({ accessUntil: back.getTime() > Date.now() ? back : new Date() }, { transaction: t });
      }
    }
  });
  return (await Order.findByPk(orderId))!;
}
