import express, { Router } from 'express';
import { asyncHandler } from '../middleware';
import { getPaymentConfig } from '../services/settings';
import { verifyWebhookSignature } from '../services/cashfree';
import { syncOrder } from '../services/orders';

export const webhookRouter = Router();

// Cashfree payment webhooks. The signature is checked against the RAW body, then the
// order is re-read from Cashfree's API (syncOrder) rather than trusting the payload.
webhookRouter.post(
  '/cashfree',
  express.raw({ type: '*/*', limit: '256kb' }),
  asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const cfg = await getPaymentConfig();
    const ok = verifyWebhookSignature(cfg.secretKey, raw, req.get('x-webhook-timestamp') || '', req.get('x-webhook-signature') || '');
    if (!ok) {
      res.status(401).json({ message: 'Invalid signature' });
      return;
    }
    let orderId: string | undefined;
    try {
      orderId = JSON.parse(raw)?.data?.order?.order_id;
    } catch {
      // fall through
    }
    if (orderId) await syncOrder(orderId).catch(() => undefined);
    // Always 200 once verified, so Cashfree doesn't keep retrying an order we don't know.
    res.json({ ok: true });
  }),
);
