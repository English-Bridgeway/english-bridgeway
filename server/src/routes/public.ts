import { Router } from 'express';
import { Message, Order } from '../db';
import { asyncHandler, rateLimit, requireLearner } from '../middleware';
import { publicBundle } from '../services/content';
import { getPaymentConfig } from '../services/settings';
import { createCourseOrder, createPlanOrder, publicOrderDto, syncOrder } from '../services/orders';
import { activePlans, publicPlan } from '../services/plans';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

publicRouter.get(
  '/content',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await publicBundle());
  }),
);

publicRouter.get(
  '/payments/config',
  asyncHandler(async (_req, res) => {
    const cfg = await getPaymentConfig();
    res.json({ enabled: cfg.enabled && Boolean(cfg.appId && cfg.secretKey), mode: cfg.mode });
  }),
);

/** Subscription plans learners can buy (all courses until the end date). */
publicRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json((await activePlans()).map(publicPlan));
  }),
);

publicRouter.post(
  '/orders',
  requireLearner,
  rateLimit({ windowMs: 10 * 60_000, max: 20 }),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    // { planId } buys a subscription; { courseId } buys one course.
    res.status(201).json(body.planId ? await createPlanOrder(req.learner!, body) : await createCourseOrder(req.learner!, body));
  }),
);

publicRouter.get(
  '/orders/:orderId',
  rateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(async (req, res) => {
    const existing = await Order.findByPk(req.params.orderId);
    if (!existing) {
      res.status(404).json({ message: 'Order not found.' });
      return;
    }
    const order = existing.status === 'pending' ? await syncOrder(existing.orderId).catch(() => existing) : existing;
    res.json(publicOrderDto(order));
  }),
);

publicRouter.post(
  '/messages',
  rateLimit({ windowMs: 10 * 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const name = str(b.name, 120);
    const email = str(b.email, 254);
    const subject = str(b.subject, 160);
    const message = str(b.message, 5000);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || message.length < 10) {
      res.status(400).json({ message: 'Please fill in your name, a valid email, a subject and a message.' });
      return;
    }
    await Message.create({ name, email, subject, message, phone: str(b.phone, 20) || null });
    res.status(201).json({ ok: true });
  }),
);
