import { Setting, type Learner, type LearnerOffer } from '../db';

// What a learner can open. A bought course stays open for good, and "full access" (a
// subscription, or access an admin grants: N months, an end date, or unlimited) opens every
// course. The free trial after sign-up is a taste: the first lesson(s) of each course, a few AI
// tutor messages and a couple of minutes of live calls, then the learner is asked to pay.
// Paid learners (full access or any bought course) get daily AI and call allowances.
// Every number here is set in Admin → Learners → Free trial and limits.

export interface AccessSettings {
  /** Hours the free trial lasts after sign-up. 0 turns the trial off. */
  trialHours: number;
  /** Lessons at the start of each course that trial learners can open. */
  freeLessons: number;
  /** AI tutor messages for the whole free trial. */
  trialAiMessages: number;
  /** Minutes of live calls for the whole free trial. */
  trialCallMinutes: number;
  /** AI tutor messages per day for paid learners (0 = no limit). */
  paidAiPerDay: number;
  /** Minutes of live calls per day for paid learners (0 = no limit). */
  paidCallMinutesPerDay: number;
}

export const ACCESS_DEFAULTS: AccessSettings = {
  trialHours: 24,
  freeLessons: 1,
  trialAiMessages: 100,
  trialCallMinutes: 2,
  paidAiPerDay: 1000,
  paidCallMinutesPerDay: 45,
};

const LIMITS: Record<keyof AccessSettings, number> = {
  trialHours: 24 * 90,
  freeLessons: 50,
  trialAiMessages: 100_000,
  trialCallMinutes: 10_000,
  paidAiPerDay: 100_000,
  paidCallMinutesPerDay: 24 * 60,
};

const clampSetting = (key: keyof AccessSettings, v: unknown, fallback: number) => {
  const n = Number(v);
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? fallback : Math.max(0, Math.min(LIMITS[key], Math.round(n)));
};

export async function getAccessSettings(): Promise<AccessSettings> {
  const row = await Setting.findByPk('learnerAccess');
  const v = (row?.value ?? {}) as Partial<Record<keyof AccessSettings, unknown>>;
  const out = {} as AccessSettings;
  for (const key of Object.keys(ACCESS_DEFAULTS) as (keyof AccessSettings)[]) out[key] = clampSetting(key, v[key], ACCESS_DEFAULTS[key]);
  return out;
}

export async function saveAccessSettings(input: Partial<Record<keyof AccessSettings, unknown>>): Promise<AccessSettings> {
  const current = await getAccessSettings();
  const next = {} as AccessSettings;
  for (const key of Object.keys(ACCESS_DEFAULTS) as (keyof AccessSettings)[]) next[key] = clampSetting(key, input[key], current[key]);
  await Setting.upsert({ key: 'learnerAccess', value: next as unknown as Record<string, unknown> });
  return next;
}

export type AccessStatus = 'unlimited' | 'active' | 'trial' | 'expired' | 'blocked';

export interface AccessState {
  status: AccessStatus;
  /** True while every course is open (subscription, granted access or unlimited). The trial is not full access. */
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
  if (trialEnds > now) return { ...base, status: 'trial', full: false, until: l.trialEndsAt!.toISOString() };
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
