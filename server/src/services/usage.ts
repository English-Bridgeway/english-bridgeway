import { fn, col } from 'sequelize';
import { CallLog, LearnerUsage, sequelize, type Learner } from '../db';
import { accessState, getAccessSettings, type AccessSettings } from './access';
import { purchasedCourseIds } from './learners';

// AI tutor messages and live-call minutes: what each learner may use, and what they used.
// Trial learners get a one-off allowance for the whole trial; paid learners get a daily one.

/** paid: full access or any bought course. trial: inside the free trial. none: trial over or blocked. */
export type Tier = 'paid' | 'trial' | 'none';

export async function tierOf(l: Learner, purchased?: string[]): Promise<Tier> {
  const state = accessState(l);
  if (state.status === 'blocked') return 'none';
  if (state.full) return 'paid';
  if ((purchased ?? (await purchasedCourseIds(l.id))).length > 0) return 'paid';
  return state.status === 'trial' ? 'trial' : 'none';
}

/** Today's date in India (the daily allowances restart at midnight IST). */
export function indiaDay(d = new Date()) {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

async function used(learnerId: string, sinceDay?: string) {
  const row = (await LearnerUsage.findOne({
    where: sinceDay ? { learnerId, day: sinceDay } : { learnerId },
    attributes: [
      [fn('COALESCE', fn('SUM', col('ai_messages')), 0), 'ai'],
      [fn('COALESCE', fn('SUM', col('call_seconds')), 0), 'call'],
    ],
    raw: true,
  })) as unknown as { ai: string | number; call: string | number } | null;
  return { ai: Number(row?.ai ?? 0), callSeconds: Number(row?.call ?? 0) };
}

export interface Allowance {
  /** "day" for paid learners (restarts at midnight IST), "trial" for the one-off trial allowance. */
  period: 'day' | 'trial' | 'none';
  used: number;
  /** null = no limit. */
  limit: number | null;
  remaining: number | null;
}

export interface UsageSummary {
  tier: Tier;
  /** Lessons at the start of each course that are open without buying (trial only; null = every lesson). */
  freeLessons: number | null;
  ai: Allowance;
  /** Seconds. */
  call: Allowance;
}

function allowance(period: Allowance['period'], usedN: number, limit: number | null): Allowance {
  return { period, used: usedN, limit, remaining: limit === null ? null : Math.max(0, limit - usedN) };
}

export async function usageSummary(l: Learner, purchased?: string[], settings?: AccessSettings): Promise<UsageSummary> {
  const s = settings ?? (await getAccessSettings());
  const tier = await tierOf(l, purchased);
  if (tier === 'paid') {
    const u = await used(l.id, indiaDay());
    return {
      tier,
      freeLessons: null,
      ai: allowance('day', u.ai, s.paidAiPerDay || null),
      call: allowance('day', u.callSeconds, s.paidCallMinutesPerDay ? s.paidCallMinutesPerDay * 60 : null),
    };
  }
  if (tier === 'trial') {
    const u = await used(l.id);
    return { tier, freeLessons: s.freeLessons, ai: allowance('trial', u.ai, s.trialAiMessages), call: allowance('trial', u.callSeconds, s.trialCallMinutes * 60) };
  }
  return { tier, freeLessons: 0, ai: allowance('none', 0, 0), call: allowance('none', 0, 0) };
}

async function add(learnerId: string, field: 'ai_messages' | 'call_seconds', amount: number) {
  if (!(amount > 0)) return;
  await sequelize.query(
    `INSERT INTO learner_usage (learner_id, day, ai_messages, call_seconds) VALUES (:learnerId, :day, :ai, :call)
     ON CONFLICT (learner_id, day) DO UPDATE SET ${field} = learner_usage.${field} + EXCLUDED.${field}`,
    { replacements: { learnerId, day: indiaDay(), ai: field === 'ai_messages' ? amount : 0, call: field === 'call_seconds' ? amount : 0 } },
  );
}

export const countAiMessage = (learnerId: string) => add(learnerId, 'ai_messages', 1);
export const countCallSeconds = (learnerId: string, seconds: number) => add(learnerId, 'call_seconds', Math.round(seconds));

/** The message a learner sees when an allowance is used up, and where to pay. */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function limitMessage(kind: 'ai' | 'call', a: Allowance): string {
  if (kind === 'ai') {
    if (a.period === 'day') return `You've used today's ${plural(a.limit ?? 0, 'AI tutor message')}. They refresh at midnight.`;
    if (a.period === 'trial') return `Your free trial included ${plural(a.limit ?? 0, 'AI tutor message')} and you've used them. Subscribe or buy a course to keep practising.`;
    return 'Your free trial has ended. Subscribe or buy a course to keep practising with the AI tutor.';
  }
  const mins = Math.round((a.limit ?? 0) / 60);
  if (a.period === 'day') return `You've used today's ${plural(mins, 'minute')} of live calls. They refresh at midnight.`;
  if (a.period === 'trial') return `Your free trial included ${plural(mins, 'minute')} of live calls and you've used them. Subscribe or buy a course to keep calling.`;
  return 'Your free trial has ended. Subscribe or buy a course to make live calls.';
}

export function callLogDto(c: CallLog) {
  return {
    id: c.id,
    roomName: c.roomName,
    kind: c.kind,
    direction: c.direction,
    withNames: c.withNames,
    startedAt: c.startedAt.toISOString(),
    endedAt: c.endedAt.toISOString(),
    talkSeconds: c.talkSeconds,
    outcome: c.outcome,
  };
}

export async function callHistory(learnerId: string, limit = 50) {
  const rows = await CallLog.findAll({ where: { learnerId }, order: [['startedAt', 'DESC']], limit });
  return rows.map(callLogDto);
}
