import type { AdminPlan } from "../admin/api/types";
import type { LearnerOffer, SubscriptionPlan } from "../types";
import { addMonths, offerApplies } from "./access";

// Subscription plans. The same rules as server/src/services/plans.ts, for the demo backend
// and for showing prices.

export const PLAN_PERIODS: { months: number; label: string; per: string }[] = [
  { months: 1, label: "Monthly", per: "month" },
  { months: 3, label: "Quarterly", per: "3 months" },
  { months: 6, label: "Half-yearly", per: "6 months" },
  { months: 12, label: "Yearly", per: "year" },
];

export const periodOf = (months: number) => PLAN_PERIODS.find((p) => p.months === months) ?? { months, label: `${months} months`, per: `${months} months` };

/** "1 month", "3 months"… */
export const monthsLabel = (m: number) => (m === 12 ? "1 year" : `${m} month${m === 1 ? "" : "s"}`);

/** A percentage offer for "any course" also lowers plan prices. Fixed-price or single-course offers don't. */
export function planPrice(offer: LearnerOffer | null | undefined, plan: { price: number }): number {
  if (!offerApplies(offer) || offer.courseId || offer.kind !== "percent") return plan.price;
  return Math.max(1, Math.min(plan.price, Math.round(plan.price * (1 - Math.min(100, offer.value) / 100))));
}

/** When access ends after buying `months` more: counted from now, the current end date or the trial end, whichever is later. */
export function accessAfterPlan(l: { accessUntil: string | null; trialEndsAt: string | null }, months: number, now = Date.now()): string {
  const from = Math.max(now, l.accessUntil ? Date.parse(l.accessUntil) : 0, l.trialEndsAt ? Date.parse(l.trialEndsAt) : 0);
  return addMonths(new Date(from), months).toISOString();
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "plan";

/** Checks the admin's list the same way the server does. Throws an Error with a message to show. */
export function normalizePlans(input: AdminPlan[]): AdminPlan[] {
  if (input.length > 12) throw new Error("Keep it to 12 plans or fewer.");
  const used = new Set<string>();
  return input.map((r, i) => {
    const name = r.name.trim().slice(0, 60);
    if (name.length < 2) throw new Error(`Plan ${i + 1} needs a name.`);
    const price = Math.round(Number(r.price));
    if (!Number.isFinite(price) || price < 1 || price > 1_000_000) throw new Error(`“${name}” needs a price of at least ₹1.`);
    const months = Math.round(Number(r.months));
    if (!PLAN_PERIODS.some((p) => p.months === months)) throw new Error(`“${name}”: choose monthly, quarterly, half-yearly or yearly.`);
    let id = /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : slug(name);
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.add(id);
    return { id, name, description: r.description.trim().slice(0, 300), price, months, active: r.active, highlight: r.highlight };
  });
}

export const toPublicPlan = (p: AdminPlan): SubscriptionPlan => ({ id: p.id, name: p.name, description: p.description, price: p.price, months: p.months, highlight: p.highlight });
