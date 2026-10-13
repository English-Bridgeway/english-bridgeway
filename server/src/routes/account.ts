import { Router, type ErrorRequestHandler } from 'express';
import { Order } from '../db';
import { asyncHandler, rateLimit, requireLearner } from '../middleware';
import { AccountError, learnerDto, loginLearner, purchasedCourseIds, registerLearner, signLearnerToken } from '../services/learners';
import { publicOrderDto } from '../services/orders';
import { iceServersFor } from '../services/voice';

// Learner accounts: sign up, log in, the signed-in learner's profile and courses, and the
// settings the live voice chat needs.
export const accountRouter = Router();

const session = (learner: Parameters<typeof learnerDto>[0]) => ({ ...signLearnerToken(learner), user: learnerDto(learner) });

accountRouter.post(
  '/auth/register',
  rateLimit({ windowMs: 60 * 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const learner = await registerLearner(req.body ?? {});
    res.status(201).json(session(learner));
  }),
);

accountRouter.post(
  '/auth/login',
  rateLimit({ windowMs: 15 * 60_000, max: 20, key: (req) => String(req.body?.email ?? '').toLowerCase() }),
  asyncHandler(async (req, res) => {
    const learner = await loginLearner(req.body ?? {});
    res.json(session(learner));
  }),
);

accountRouter.get(
  '/me',
  requireLearner,
  asyncHandler(async (req, res) => {
    res.json({ user: learnerDto(req.learner!), purchasedCourseIds: await purchasedCourseIds(req.learner!.id) });
  }),
);

accountRouter.patch(
  '/me',
  requireLearner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : req.learner!.name;
    if (name.length < 2 || name.length > 120) throw new AccountError('Please enter your name.', 400, 'name');
    await req.learner!.update({ name });
    res.json({ user: learnerDto(req.learner!) });
  }),
);

accountRouter.get(
  '/me/orders',
  requireLearner,
  asyncHandler(async (req, res) => {
    const orders = await Order.findAll({ where: { userId: req.learner!.id }, order: [['createdAt', 'DESC']], limit: 100 });
    res.json(orders.map((o) => ({ ...publicOrderDto(o), createdAt: o.createdAt.toISOString(), paidAt: o.paidAt?.toISOString() ?? null })));
  }),
);

/** Ends every session of this account (all devices). Logging out on one device just forgets the token. */
accountRouter.post(
  '/me/logout-all',
  requireLearner,
  asyncHandler(async (req, res) => {
    await req.learner!.increment('tokenVersion');
    res.status(204).end();
  }),
);

/** STUN/TURN servers for the voice chat. TURN credentials are short-lived and per learner. */
accountRouter.get('/voice/config', requireLearner, (req, res) => {
  res.json({ iceServers: iceServersFor(req.learner!.id) });
});

const onAccountError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof AccountError) {
    res.status(err.status).json({ message: err.message, field: err.field });
    return;
  }
  next(err);
};
accountRouter.use(onAccountError);
