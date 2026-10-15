/**
 * Thin API layer for the public site. Talks to the server in server/ when VITE_API_BASE is
 * set, and to the in-browser demo backend (demoStore.ts) otherwise.
 */
import { apiFetch, isLive } from "./backend";
import { newId, readDemoDb, updateDemoDb } from "./demoStore";
import type { Order } from "../admin/api/types";
import type { SubscriptionPlan } from "../types";
import { updateDemoLearner } from "./demoLearners";
import { accessAfterPlan, toPublicPlan } from "./plans";

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export const contactIsLive = isLive;

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  if (isLive) {
    await apiFetch("/messages", { method: "POST", json: payload });
    return;
  }
  await new Promise((r) => setTimeout(r, 500));
  updateDemoDb((db) => {
    db.messages.unshift({ id: newId(), name: payload.name, email: payload.email, phone: payload.phone || null, subject: payload.subject, message: payload.message, status: "new", createdAt: new Date().toISOString() });
  });
}

// ---- Course payments (Cashfree) ----

export interface PaymentsConfig {
  enabled: boolean;
  mode: "sandbox" | "production";
  demo: boolean;
}

export async function getPaymentsConfig(): Promise<PaymentsConfig> {
  if (isLive) {
    const cfg = await apiFetch<{ enabled: boolean; mode: "sandbox" | "production" }>("/payments/config");
    return { ...cfg, demo: false };
  }
  const { payments } = readDemoDb();
  return { enabled: payments.enabled, mode: payments.mode, demo: true };
}

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface PublicOrder {
  orderId: string;
  /** "plan" for a subscription. */
  kind?: "course" | "plan";
  planMonths?: number | null;
  courseId: string;
  courseTitle: string;
  amount: number;
  status: Order["status"];
}

/** Subscription plans learners can buy. Empty when the admin hasn't made any. */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  if (isLive) return apiFetch<SubscriptionPlan[]>("/plans");
  return (readDemoDb().plans ?? []).filter((p) => p.active && p.price > 0).map(toPublicPlan);
}

/** What is being bought: one course, or a subscription plan (months of access to every course). */
export interface CheckoutItem {
  kind: "course" | "plan";
  id: string;
  title: string;
  /** What this learner pays, after any special offer. */
  price: number;
  /** Plans only. */
  months?: number;
}

/**
 * Starts payment for a paid course or a plan. Live: the server creates a Cashfree order and the
 * browser is sent to Cashfree's checkout, which returns to /payment/status. Demo: the
 * payment is simulated and the order id is returned for the status page.
 */
export async function startPayment(
  item: CheckoutItem,
  customer: CheckoutCustomer,
  account: { token: string | null; userId: string | null },
): Promise<{ demoOrderId?: string }> {
  if (isLive) {
    // The server takes the email from the signed-in account and the price from the database.
    const { paymentSessionId, mode } = await apiFetch<{ orderId: string; paymentSessionId: string; mode: "sandbox" | "production" }>("/orders", {
      method: "POST",
      token: account.token ?? undefined,
      json: { ...(item.kind === "plan" ? { planId: item.id } : { courseId: item.id }), name: customer.name, phone: customer.phone },
    });
    const { load } = await import("@cashfreepayments/cashfree-js");
    const cashfree = await load({ mode });
    if (!cashfree) throw new Error("Could not open the payment page. Please try again.");
    const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
    if (result?.error) throw new Error(result.error.message);
    return {};
  }
  await new Promise((r) => setTimeout(r, 800));
  const orderId = `DEMO-${newId().toUpperCase()}`;
  const now = new Date().toISOString();
  const plan = item.kind === "plan";
  updateDemoDb((db) => {
    db.orders.unshift({
      orderId, userId: account.userId, courseId: plan ? `plan:${item.id}` : item.id, courseTitle: plan ? `Subscription: ${item.title}` : item.title,
      kind: item.kind, planId: plan ? item.id : null, planMonths: plan ? (item.months ?? 1) : null, amount: item.price, currency: "INR",
      customerName: customer.name, customerEmail: customer.email.toLowerCase(), customerPhone: customer.phone.replace(/\D/g, "").slice(-10),
      status: "paid", gateway: "demo", gatewayPaymentId: `demo_${newId()}`, bankReference: null, refundId: null, paidAt: now, createdAt: now,
    });
  });
  if (plan && account.userId) {
    updateDemoLearner(account.userId, (l) => {
      if (!l.accessUnlimited) l.accessUntil = accessAfterPlan(l, item.months ?? 1);
    });
  }
  return { demoOrderId: orderId };
}

export async function getOrderStatus(orderId: string): Promise<PublicOrder> {
  if (isLive) return apiFetch<PublicOrder>(`/orders/${encodeURIComponent(orderId)}`);
  const order = readDemoDb().orders.find((o) => o.orderId === orderId);
  if (!order) throw new Error("Order not found.");
  return { orderId: order.orderId, kind: order.kind ?? "course", planMonths: order.planMonths ?? null, courseId: order.courseId, courseTitle: order.courseTitle, amount: order.amount, status: order.status };
}
