import { Setting, type Learner, type LearnerOffer } from '../db';

// What a learner can open. Free courses are open to everyone and a paid course stays open once
// bought. On top of that, "full access" opens every course and the AI tutor: the free trial
// right after sign-up, or the access an admin grants (N months, an end date, or unlimited).

export interface AccessSettings {
  /** Hours of full access a new account gets. 0 turns the trial off. */
  trialHours: number;
  /** Who may use Speak with AI: anyone with full access, or also learners who bought a course. */
  aiForBuyers: boolean;
}

const DEFAULTS: AccessSettings = { trialHours: 24, aiForBuyers: true };

export async function getAccessSettings(): Promise<AccessSettings> {
  const row = await Setting.findByPk('learnerAccess');
  const v = (row?.value ?? {}) as Partial<AccessSettings>;
  return {
    trialHours: Number.isFinite(Number(v.trialHours)) ? Math.max(0, Math.min(24 * 90, Number(v.trialHours))) : DEFAULTS.trialHours,
    aiForBuyers: v.aiForBuyers ?? DEFAULTS.aiForBuyers,
  };
}

export async function saveAccessSettings(input: Partial<AccessSettings>): Promise<AccessSettings> {
  const current = await getAccessSettings();
  const next: AccessSettings = {
    trialHours: input.trialHours === undefined ? current.trialHours : Math.max(0, Math.min(24 * 90, Math.round(Number(input.trialHours) || 0))),
    aiForBuyers: input.aiForBuyers === undefined ? current.aiForBuyers : Boolean(input.aiForBuyers),
  };
  await Setting.upsert({ key: 'learnerAccess', value: next as unknown as Record<string, unknown> });
  return next;
}

export type AccessStatus = 'unlimited' | 'active' | 'trial' | 'expired' | 'blocked';

export interface AccessState {
  status: AccessStatus;
  /** True while every course is open (trial, granted access or unlimited). */
  full: boolean;
  /** When full access ends (null when unlimited or when there is none). */
  until: string | null;
  trialEndsAt: string | null;
  accessUntil: string | null;
  unlimited: boolean;
}

export function accessState(l: Learner, now = Date.now()): AccessState {
  const trialEnds = l.trialEndsAt ? l.trialEndsAt.getTime() : 0;
  const grantedEnds = l.accessUntil ? l.accessUntil.getTime() : 0;
  const base = {
    trialEndsAt: l.trialEndsAt?.toISOString() ?? null,
    accessUntil: l.accessUntil?.toISOString() ?? null,
    unlimited: l.accessUnlimited,
  };
  if (!l.active) return { ...base, status: 'blocked', full: false, until: null };
  if (l.accessUnlimited) return { ...base, status: 'unlimited', full: true, until: null };
  if (grantedEnds > now && grantedEnds >= trialEnds) return { ...base, status: 'active', full: true, until: l.accessUntil!.toISOString() };
  if (trialEnds > now) return { ...base, status: 'trial', full: true, until: l.trialEndsAt!.toISOString() };
  return { ...base, status: 'expired', full: false, until: null };
}

/** The learner's offer, if it is still valid (and for this course, when one is given). */
export function activeOffer(l: Learner, courseId?: string, now = Date.now()): LearnerOffer | null {
  const o = l.offer;
  if (!o || !(o.value > 0)) return null;
  if (o.expiresAt && new Date(o.expiresAt).getTime() < now) return null;
  if (courseId && o.courseId && o.courseId !== courseId) return null;
  return o;
}

/** The price this learner pays for a course, after their offer. Never below ₹1 (Cashfree's minimum). */
export function priceFor(l: Learner, courseId: string, basePrice: number): number {
  const o = activeOffer(l, courseId);
  if (!o) return basePrice;
  const offered = o.kind === 'price' ? o.value : basePrice * (1 - Math.min(100, o.value) / 100);
  return Math.max(1, Math.min(basePrice, Math.round(offered)));
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // 31 Jan + 1 month → 28/29 Feb, not 3 Mar.
  if (d.getDate() < day) d.setDate(0);
  return d;
}
