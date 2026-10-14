import { Router, type ErrorRequestHandler } from 'express';
import { LearnerAvatar, Order, type Learner } from '../db';
import { asyncHandler, rateLimit, requireLearner } from '../middleware';
import {
  AccountError, learnerDto, loginLearner, purchasedCourseIds, registerLearner, removeAvatar, saveAvatar, signLearnerToken, updateProfile,
} from '../services/learners';
import { accessState, activeOffer, getAccessSettings } from '../services/access';
import { AiError, getAiConfig, tutorReply, usedToday } from '../services/ai';
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

/** Whether this learner may use Speak with AI: full access, or (when allowed) any bought course. */
async function aiAllowed(learner: Learner, purchased?: string[]) {
  if (accessState(learner).full) return true;
  const { aiForBuyers } = await getAccessSettings();
  return aiForBuyers && (purchased ?? (await purchasedCourseIds(learner.id))).length > 0;
}

accountRouter.get(
  '/me',
  requireLearner,
  asyncHandler(async (req, res) => {
    const learner = req.learner!;
    const purchased = await purchasedCourseIds(learner.id);
    const offer = activeOffer(learner);
    res.json({
      user: learnerDto(learner),
      purchasedCourseIds: purchased,
      access: { ...accessState(learner), ai: await aiAllowed(learner, purchased) },
      offer: offer && { kind: offer.kind, value: offer.value, courseId: offer.courseId, note: offer.note, expiresAt: offer.expiresAt },
    });
  }),
);

accountRouter.patch(
  '/me',
  requireLearner,
  asyncHandler(async (req, res) => {
    res.json({ user: learnerDto(await updateProfile(req.learner!, req.body ?? {})) });
  }),
);

accountRouter.put(
  '/me/avatar',
  requireLearner,
  rateLimit({ windowMs: 60 * 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    res.json({ user: learnerDto(await saveAvatar(req.learner!, req.body?.dataUrl)) });
  }),
);

accountRouter.delete(
  '/me/avatar',
  requireLearner,
  asyncHandler(async (req, res) => {
    res.json({ user: learnerDto(await removeAvatar(req.learner!)) });
  }),
);

/** Profile photos. The learner id is a random UUID, and the URL carries a version for caching. */
accountRouter.get(
  '/avatars/:learnerId',
  asyncHandler(async (req, res) => {
    const id = req.params.learnerId;
    const avatar = /^[0-9a-f-]{36}$/i.test(id) ? await LearnerAvatar.findByPk(id) : null;
    if (!avatar) {
      res.status(404).json({ message: 'No photo.' });
      return;
    }
    res.setHeader('Content-Type', avatar.mime);
    res.setHeader('Cache-Control', req.query.v ? 'private, max-age=31536000, immutable' : 'private, no-cache');
    res.send(avatar.data);
  }),
);

// ---- Speak with AI ----

accountRouter.get(
  '/ai/status',
  requireLearner,
  asyncHandler(async (req, res) => {
    const cfg = await getAiConfig();
    res.json({
      enabled: cfg.enabled,
      allowed: await aiAllowed(req.learner!),
      remainingToday: cfg.dailyLimit ? Math.max(0, cfg.dailyLimit - usedToday(req.learner!.id)) : null,
    });
  }),
);

accountRouter.post(
  '/ai/chat',
  requireLearner,
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(async (req, res) => {
    if (!(await aiAllowed(req.learner!))) {
      throw new AiError('Your free trial has ended. Buy a course or ask us for access to keep talking with the AI tutor.', 402, 'access');
    }
    res.json(await tutorReply(req.learner!, req.body ?? {}));
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
  if (err instanceof AiError) {
    res.status(err.status).json({ message: err.message, code: err.code });
    return;
  }
  next(err);
};
accountRouter.use(onAccountError);
