import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Admin } from '../db';
import { verifyToken } from '../services/auth';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

declare module 'express-serve-static-core' {
  interface Request {
    admin?: Admin;
  }
}

/** Requires a valid admin session (Authorization: Bearer <token>) for an active admin. */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  const admin = payload ? await Admin.findByPk(payload.sub) : null;
  if (!admin || !admin.active) {
    res.status(401).json({ message: 'Please sign in again.' });
    return;
  }
  req.admin = admin;
  next();
});

/** Owners manage admins and payment settings; editors manage content. */
export const requireOwner: RequestHandler = (req, res, next) => {
  if (req.admin?.role !== 'owner') {
    res.status(403).json({ message: 'Only the site owner can do this.' });
    return;
  }
  next();
};

/** Small in-memory fixed-window limiter. Enough for one API process; use Redis if you run several. */
export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const id = `${req.ip}|${opts.key ? opts.key(req) : ''}`;
    const entry = hits.get(id);
    if (!entry || entry.resetAt < now) {
      hits.set(id, { count: 1, resetAt: now + opts.windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      return next();
    }
    entry.count++;
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
      return;
    }
    next();
  };
}
