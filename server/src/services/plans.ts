import { Setting, type Learner } from '../db';
import { activeOffer } from './access';

// Subscription plans: pay once for a period (1, 3, 6 or 12 months) and every course and the
// AI tutor are open until it ends. A paid plan moves the learner's access end date
// (learners.access_until) forward, the same field the admin sets by hand in Learners.
// Plans are kept in the settings table and edited in Admin → Subscription plans.

export interface Plan {
  id: string;
  name: string;
  description: string;
  /** Rupees for the whole period. */
  price: number;
  months: number;
  active: boolean;
  /** Shown as "Best value" on the site. */
  highlight: boolean;
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const KEY = 'subscriptionPlans';
export const PLAN_MONTHS = [1, 3, 6, 12] as const;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'plan';

export async function getPlans(): Promise<Plan[]> {
  const row = await Setting.findByPk(KEY);
  const list = (row?.value as { plans?: Plan[] } | undefined)?.plans;
  return Array.isArray(list) ? list : [];
}

/** Plans learners can buy, in the admin's order. */
export async function activePlans(): Promise<Plan[]> {
  return (await getPlans()).filter((p) => p.active && p.price > 0);
}

export async function getActivePlan(id: unknown): Promise<Plan | null> {
  if (typeof id !== 'string' || !id) return null;
  return (await activePlans()).find((p) => p.id === id) ?? null;
}

/** Checks and stores the admin's list. Plan ids stay the same once made, so old orders still match. */
export async function savePlans(input: unknown): Promise<Plan[]> {
  if (!Array.isArray(input)) throw new PlanError('Send a list of plans.');
  if (input.length > 12) throw new PlanError('Keep it to 12 plans or fewer.');
  const used = new Set<string>();
  const plans: Plan[] = input.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
    if (name.length < 2) throw new PlanError(`Plan ${i + 1} needs a name.`);
    const price = Math.round(Number(r.price));
    if (!Number.isFinite(price) || price < 1 || price > 1_000_000) throw new PlanError(`“${name}” needs a price of at least ₹1.`);
    const months = Math.round(Number(r.months));
    if (!(PLAN_MONTHS as readonly number[]).includes(months)) throw new PlanError(`“${name}”: choose monthly, quarterly, half-yearly or yearly.`);
    let id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : slug(name);
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.add(id);
    return {
      id,
      name,
      description: typeof r.description === 'string' ? r.description.trim().slice(0, 300) : '',
      price,
      months,
      active: r.active === undefined ? true : Boolean(r.active),
      highlight: Boolean(r.highlight),
    };
  });
  await Setting.upsert({ key: KEY, value: { plans } as unknown as Record<string, unknown> });
  return plans;
}

/**
 * What this learner pays for a plan. A percentage offer for "any course" applies to plans too;
 * a fixed-price offer or one for a single course is about courses only.
 */
export function planPriceFor(l: Learner, plan: Plan): number {
  const o = activeOffer(l);
  if (!o || o.courseId || o.kind !== 'percent') return plan.price;
  const offered = plan.price * (1 - Math.min(100, o.value) / 100);
  return Math.max(1, Math.min(plan.price, Math.round(offered)));
}

export const publicPlan = (p: Plan) => ({ id: p.id, name: p.name, description: p.description, price: p.price, months: p.months, highlight: p.highlight });
