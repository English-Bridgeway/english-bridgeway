import crypto from 'crypto';
import type { PaymentConfig } from './settings';

// Cashfree Payment Gateway, API version 2023-08-01 — the same client the
// Inveon Events platform uses: base URLs, auth headers and the order,
// payments and refund payload shapes follow Cashfree's API reference.

const API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

export class CashfreeNotConfiguredError extends Error {
  constructor() {
    super('Online payment is not set up yet. Please contact us to enrol.');
  }
}

export class CashfreeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

function baseUrl(cfg: PaymentConfig): string {
  // CASHFREE_API_BASE is only for pointing tests at a local mock.
  if (process.env.CASHFREE_API_BASE) return process.env.CASHFREE_API_BASE;
  return cfg.mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

async function request<T>(cfg: PaymentConfig, method: string, path: string, body?: unknown): Promise<T> {
  if (!cfg.appId || !cfg.secretKey) throw new CashfreeNotConfiguredError();
  const res = await fetch(`${baseUrl(cfg)}${path}`, {
    method,
    headers: {
      'x-client-id': cfg.appId,
      'x-client-secret': cfg.secretKey,
      'x-api-version': API_VERSION,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: string })?.message || `Cashfree API error (${res.status})`;
    throw new CashfreeApiError(message, res.status, data);
  }
  return data as T;
}

export interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED';
  payment_session_id: string;
}

export interface CashfreePayment {
  cf_payment_id: string | number;
  payment_status: 'SUCCESS' | 'NOT_ATTEMPTED' | 'FAILED' | 'USER_DROPPED' | 'VOID' | 'CANCELLED' | 'PENDING';
  payment_amount?: number;
  bank_reference?: string | null;
}

export interface CashfreeRefund {
  refund_id: string;
  refund_status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'ONHOLD' | 'CANCELLED';
}

export function createOrder(
  cfg: PaymentConfig,
  p: {
    orderId: string;
    amountRupees: number;
    customerId: string;
    name: string;
    email: string;
    phone: string;
    returnUrl: string;
    notifyUrl?: string;
    note: string;
    tags: Record<string, string>;
  },
) {
  return request<CashfreeOrder>(cfg, 'POST', '/orders', {
    order_id: p.orderId,
    order_amount: Math.round(p.amountRupees * 100) / 100,
    order_currency: 'INR',
    customer_details: {
      customer_id: p.customerId,
      customer_name: p.name,
      customer_email: p.email,
      customer_phone: p.phone,
    },
    order_meta: {
      return_url: p.returnUrl,
      ...(p.notifyUrl ? { notify_url: p.notifyUrl } : {}),
    },
    // A checkout left open stops accepting payment after an hour (Cashfree's default is 30 days).
    order_expiry_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    order_note: p.note.slice(0, 200),
    order_tags: p.tags,
  });
}

export function getOrder(cfg: PaymentConfig, orderId: string) {
  return request<CashfreeOrder>(cfg, 'GET', `/orders/${encodeURIComponent(orderId)}`);
}

export function getOrderPayments(cfg: PaymentConfig, orderId: string) {
  return request<CashfreePayment[]>(cfg, 'GET', `/orders/${encodeURIComponent(orderId)}/payments`);
}

export function createRefund(cfg: PaymentConfig, p: { orderId: string; refundId: string; amountRupees: number; note: string }) {
  return request<CashfreeRefund>(cfg, 'POST', `/orders/${encodeURIComponent(p.orderId)}/refunds`, {
    refund_amount: Math.round(p.amountRupees * 100) / 100,
    refund_id: p.refundId,
    refund_note: p.note.slice(0, 100),
    refund_speed: 'STANDARD',
  });
}

/**
 * Checks the keys by asking for an order that cannot exist: Cashfree answers 404 when the
 * keys are valid and 401/403 when they are not. Nothing is created in the account.
 */
export async function testCredentials(cfg: PaymentConfig): Promise<{ ok: boolean; message: string }> {
  try {
    await getOrder(cfg, `eb-connection-test-${Date.now()}`);
    return { ok: true, message: `Connected to Cashfree (${cfg.mode}).` };
  } catch (err) {
    if (err instanceof CashfreeNotConfiguredError) return { ok: false, message: 'Add the App ID and Secret key first.' };
    if (err instanceof CashfreeApiError && err.status === 404) return { ok: true, message: `Connected to Cashfree (${cfg.mode}).` };
    if (err instanceof CashfreeApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, message: `Cashfree rejected these keys for ${cfg.mode} mode. Check the App ID, Secret key and mode.` };
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach Cashfree.' };
  }
}

/**
 * Cashfree's webhook signature: base64(HMAC-SHA256(secretKey, timestamp + rawBody)).
 * Must be computed over the raw request body, never a re-serialised copy.
 */
export function verifyWebhookSignature(secretKey: string, rawBody: string, timestamp: string, signature: string): boolean {
  if (!secretKey || !timestamp || !signature) return false;
  const computed = Buffer.from(crypto.createHmac('sha256', secretKey).update(timestamp + rawBody).digest('base64'));
  const received = Buffer.from(signature);
  return computed.length === received.length && crypto.timingSafeEqual(computed, received);
}
