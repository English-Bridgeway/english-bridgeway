import { Router } from 'express';
import { Op, type WhereOptions } from 'sequelize';
import { Learner, LearnerAvatar, Order, sequelize, type LearnerOffer } from '../db';
import { asyncHandler, requireOwner } from '../middleware';
import { audit } from '../services/audit';
import { accessState, activeOffer, addMonths, getAccessSettings, saveAccessSettings } from '../services/access';
import { learnerDto } from '../services/learners';
import { OrderError, orderDto } from '../services/orders';
import { aiSettingsForAdmin, AiError, saveAiConfig, testAi } from '../services/ai';
import { getPublishedItem } from '../services/content';
import { callHistory, usageSummary } from '../services/usage';

// Admin → Learners: every student account, their details and photo, their access (trial,
// N months, an end date or unlimited), special offers, and blocking. Admin → AI tutor settings.
// Everyone in the admin panel can look; only owners can change access, offers and blocks.
export const adminLearnersRouter = Router();

const summary = (l: Learner, stats?: { paid: number; spent: number }) => ({
  ...learnerDto(l),
  active: l.active,
  blockedReason: l.blockedReason,
  lastLoginAt: l.lastLoginAt?.toISOString() ?? null,
  access: accessState(l),
  offer: l.offer,
  offerActive: Boolean(activeOffer(l)),
  paidOrders: stats?.paid ?? 0,
  totalSpent: stats?.spent ?? 0,
});

async function orderStats(ids: string[]) {
  if (!ids.length) return new Map<string, { paid: number; spent: number }>();
  const rows = (await Order.findAll({
    where: { userId: ids, status: 'paid' },
    attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('order_id')), 'paid'], [sequelize.fn('SUM', sequelize.col('amount_paise')), 'spent']],
    group: ['userId'],
    raw: true,
  })) as unknown as { userId: string; paid: string; spent: string }[];
  return new Map(rows.map((r) => [r.userId, { paid: Number(r.paid), spent: Number(r.spent) / 100 }]));
}

async function findLearner(id: string) {
  const l = /^[0-9a-f-]{36}$/i.test(id) ? await Learner.findByPk(id) : null;
  if (!l) throw new OrderError('Learner not found.', 404);
  return l;
}

async function detail(l: Learner) {
  const orders = await Order.findAll({ where: { userId: l.id }, order: [['createdAt', 'DESC']], limit: 200 });
  const paid = orders.filter((o) => o.status === 'paid');
  return {
    ...summary(l, { paid: paid.length, spent: paid.reduce((s, o) => s + o.amountPaise / 100, 0) }),
    adminNote: l.adminNote,
    orders: orders.map(orderDto),
    usage: await usageSummary(l),
    calls: await callHistory(l.id, 100),
  };
}

adminLearnersRouter.get(
  '/learners',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where: WhereOptions<Learner> = q
      ? { [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { email: { [Op.iLike]: `%${q}%` } }, { phone: { [Op.iLike]: `%${q}%` } }] }
      : {};
    const rows = await Learner.findAll({ where, order: [['createdAt', 'DESC']], limit: 2000 });
    const stats = await orderStats(rows.map((r) => r.id));
    res.json(rows.map((l) => summary(l, stats.get(l.id))));
  }),
);

adminLearnersRouter.get(
  '/learners/:id',
  asyncHandler(async (req, res) => {
    res.json(await detail(await findLearner(req.params.id)));
  }),
);

/**
 * Sets full access. Body: { mode: "months", months } adds months (from today, or from the
 * current end date if it is later), { mode: "until", date: "YYYY-MM-DD" }, { mode: "unlimited" },
 * { mode: "trial", hours } restarts the free trial, or { mode: "none" } removes access.
 */
adminLearnersRouter.put(
  '/learners/:id/access',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    const b = req.body ?? {};
    const now = new Date();
    let label: string;
    if (b.mode === 'months') {
      const months = Math.round(Number(b.months));
      if (!(months >= 1 && months <= 120)) throw new OrderError('Choose between 1 and 120 months.', 400);
      const from = l.accessUntil && l.accessUntil > now ? l.accessUntil : now;
      await l.update({ accessUnlimited: false, accessUntil: addMonths(from, months) });
      label = `+${months} month${months > 1 ? 's' : ''}`;
    } else if (b.mode === 'until') {
      const m = typeof b.date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date) : null;
      // The access lasts through the whole chosen day (India time).
      const until = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59+05:30`) : null;
      if (!until || Number.isNaN(until.getTime()) || until <= now) throw new OrderError('Choose a date in the future.', 400);
      await l.update({ accessUnlimited: false, accessUntil: until });
      label = `until ${b.date}`;
    } else if (b.mode === 'unlimited') {
      await l.update({ accessUnlimited: true });
      label = 'unlimited';
    } else if (b.mode === 'trial') {
      const hours = Math.round(Number(b.hours));
      if (!(hours >= 1 && hours <= 24 * 90)) throw new OrderError('Choose between 1 hour and 90 days.', 400);
      await l.update({ trialEndsAt: new Date(now.getTime() + hours * 3600_000) });
      label = `trial ${hours}h`;
    } else if (b.mode === 'none') {
      await l.update({ accessUnlimited: false, accessUntil: null, trialEndsAt: l.trialEndsAt && l.trialEndsAt > now ? now : l.trialEndsAt });
      label = 'removed';
    } else {
      throw new OrderError('Unknown access option.', 400);
    }
    await audit(req.admin!.email, `Set learner access (${label})`, l.email);
    res.json(await detail(l));
  }),
);

adminLearnersRouter.put(
  '/learners/:id/offer',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    const b = req.body ?? {};
    const kind = b.kind === 'percent' ? 'percent' : 'price';
    const value = Math.round(Number(b.value));
    if (kind === 'percent' && !(value >= 1 && value <= 100)) throw new OrderError('The discount must be between 1% and 100%.', 400);
    if (kind === 'price' && !(value >= 1 && value <= 1_000_000)) throw new OrderError('The offer price must be at least ₹1.', 400);
    const courseId = typeof b.courseId === 'string' && b.courseId ? b.courseId : null;
    if (courseId && !(await getPublishedItem('courses', courseId))) throw new OrderError('That course does not exist.', 400);
    const expiresAt = typeof b.expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt) ? new Date(`${b.expiresAt}T23:59:59+05:30`).toISOString() : null;
    const offer: LearnerOffer = { kind, value, courseId, note: String(b.note ?? '').trim().slice(0, 200), expiresAt };
    await l.update({ offer });
    await audit(req.admin!.email, `Gave special offer (${kind === 'percent' ? `${value}% off` : `₹${value}`})`, l.email);
    res.json(await detail(l));
  }),
);

adminLearnersRouter.delete(
  '/learners/:id/offer',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    await l.update({ offer: null });
    await audit(req.admin!.email, 'Removed special offer', l.email);
    res.json(await detail(l));
  }),
);

/** Blocks or unblocks. Blocking signs the learner out on every device straight away. */
adminLearnersRouter.put(
  '/learners/:id/block',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    const blocked = req.body?.blocked !== false;
    if (blocked) {
      await l.update({ active: false, blockedReason: String(req.body?.reason ?? '').trim().slice(0, 300) || null, tokenVersion: l.tokenVersion + 1 });
    } else {
      await l.update({ active: true, blockedReason: null });
    }
    await audit(req.admin!.email, blocked ? 'Blocked learner' : 'Unblocked learner', l.email);
    res.json(await detail(l));
  }),
);

adminLearnersRouter.patch(
  '/learners/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    if (typeof req.body?.adminNote === 'string') await l.update({ adminNote: req.body.adminNote.slice(0, 5000) || null });
    res.json(await detail(l));
  }),
);

adminLearnersRouter.delete(
  '/learners/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const l = await findLearner(req.params.id);
    // Orders stay for the accounts (they keep the buyer's name and email).
    await LearnerAvatar.destroy({ where: { learnerId: l.id } });
    await l.destroy();
    await audit(req.admin!.email, 'Deleted learner account', l.email);
    res.status(204).end();
  }),
);

// ---- Settings: free trial, limits and AI tutor ----

adminLearnersRouter.get(
  '/settings/access',
  asyncHandler(async (_req, res) => {
    res.json(await getAccessSettings());
  }),
);

adminLearnersRouter.put(
  '/settings/access',
  requireOwner,
  asyncHandler(async (req, res) => {
    const saved = await saveAccessSettings(req.body ?? {});
    await audit(req.admin!.email, 'Updated learner access settings', `trial ${saved.trialHours}h, ${saved.freeLessons} free lesson(s), AI ${saved.trialAiMessages}/${saved.paidAiPerDay} a day, calls ${saved.trialCallMinutes}m/${saved.paidCallMinutesPerDay}m a day`);
    res.json(saved);
  }),
);

adminLearnersRouter.get(
  '/settings/ai',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await aiSettingsForAdmin());
  }),
);

adminLearnersRouter.put(
  '/settings/ai',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    await saveAiConfig({
      enabled: Boolean(b.enabled),
      baseUrl: typeof b.baseUrl === 'string' ? b.baseUrl : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
      apiKey: typeof b.apiKey === 'string' ? b.apiKey : undefined,
      clearKey: b.clearKey === true,
      instructions: typeof b.instructions === 'string' ? b.instructions : undefined,
      dailyLimit: b.dailyLimit,
    });
    await audit(req.admin!.email, 'Updated AI tutor settings', `${b.enabled ? 'on' : 'off'}`);
    res.json(await aiSettingsForAdmin());
  }),
);

adminLearnersRouter.post(
  '/settings/ai/test',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await testAi());
  }),
);

adminLearnersRouter.use(((err, _req, res, next) => {
  if (err instanceof AiError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  next(err);
}) as import('express').ErrorRequestHandler);
