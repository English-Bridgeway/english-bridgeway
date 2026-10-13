import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Learner, Order } from '../db';
import { checkPassword, hashPassword } from './auth';

// Learner (student) accounts for the public site. Sessions are signed tokens with their own
// audience, so a learner token can never open the admin API and an admin token can't act
// as a learner.

const AUDIENCE = 'english-bridgeway-learner';
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccountError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly field?: 'name' | 'email' | 'password' | 'phone',
  ) {
    super(message);
  }
}

interface LearnerTokenPayload {
  sub: string;
  v: number;
}

export function signLearnerToken(learner: Learner): { token: string; expiresAt: number } {
  const token = jwt.sign({ sub: learner.id, v: learner.tokenVersion } satisfies LearnerTokenPayload, config.jwtSecret, {
    expiresIn: `${SESSION_DAYS}d`,
    audience: AUDIENCE,
  });
  return { token, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
}

/** The active learner a token belongs to, or null when it is invalid, expired or revoked. */
export async function learnerFromToken(token: string | undefined | null): Promise<Learner | null> {
  if (!token) return null;
  let payload: LearnerTokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { audience: AUDIENCE }) as LearnerTokenPayload;
  } catch {
    return null;
  }
  const learner = await Learner.findByPk(payload.sub);
  if (!learner || !learner.active || learner.tokenVersion !== payload.v) return null;
  return learner;
}

export function learnerDto(l: Learner) {
  const initials = l.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return { id: l.id, name: l.name, email: l.email, phone: l.phone, avatarInitials: initials || 'ST', createdAt: l.createdAt.toISOString() };
}

const cleanEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

export async function registerLearner(input: { name?: unknown; email?: unknown; password?: unknown }) {
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  if (name.length < 2 || name.length > 120) throw new AccountError('Please enter your name.', 400, 'name');
  if (!EMAIL.test(email) || email.length > 254) throw new AccountError('Enter a valid email address.', 400, 'email');
  if (password.length < 8 || password.length > 200) throw new AccountError('Use a password of at least 8 characters.', 400, 'password');
  if (await Learner.findOne({ where: { email } })) {
    throw new AccountError('An account with this email already exists. Log in instead.', 409, 'email');
  }
  return Learner.create({ name, email, passwordHash: await hashPassword(password), lastLoginAt: new Date() });
}

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

export async function loginLearner(input: { email?: unknown; password?: unknown }) {
  const email = cleanEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const learner = email ? await Learner.findOne({ where: { email } }) : null;
  const ok = await checkPassword(password, learner?.passwordHash ?? (await (dummyHash ??= hashPassword('not-a-real-password'))));
  if (!learner || !ok) throw new AccountError('Wrong email or password.', 401);
  if (!learner.active) throw new AccountError('This account is switched off. Please contact us.', 403);
  await learner.update({ lastLoginAt: new Date() });
  return learner;
}

/** Course ids this learner has paid for (refunded orders no longer count). */
export async function purchasedCourseIds(learnerId: string): Promise<string[]> {
  const rows = await Order.findAll({ where: { userId: learnerId, status: 'paid' }, attributes: ['courseId'] });
  return [...new Set(rows.map((r) => r.courseId))];
}

export async function hasPurchased(learnerId: string, courseId: string): Promise<boolean> {
  return (await Order.count({ where: { userId: learnerId, courseId, status: 'paid' } })) > 0;
}
