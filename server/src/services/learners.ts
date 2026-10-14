import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Learner, LearnerAvatar, Order, type LearnerProfile } from '../db';
import { getAccessSettings } from './access';
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
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    avatarInitials: initials || 'ST',
    // Relative to the API base (e.g. /api); the ?v= changes with every new photo.
    avatarUrl: l.avatarUpdatedAt ? `/avatars/${l.id}?v=${l.avatarUpdatedAt.getTime()}` : null,
    profile: l.profile ?? {},
    createdAt: l.createdAt.toISOString(),
  };
}

const PROFILE_FIELDS: Record<keyof LearnerProfile, number> = {
  whatsapp: 15,
  dateOfBirth: 10,
  gender: 30,
  city: 80,
  state: 80,
  country: 80,
  occupation: 120,
  englishLevel: 40,
  goal: 300,
  about: 1000,
};

/** Updates the learner's own details. Unknown fields are ignored; empty ones are cleared. */
export async function updateProfile(learner: Learner, input: Record<string, unknown>) {
  const update: Partial<Pick<Learner, 'name' | 'phone' | 'profile'>> = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (name.length < 2 || name.length > 120) throw new AccountError('Please enter your name.', 400, 'name');
    update.name = name;
  }
  if (input.phone !== undefined) {
    const phone = typeof input.phone === 'string' ? input.phone.replace(/[^\d+]/g, '').replace(/^\+?91(?=\d{10}$)/, '') : '';
    if (phone && !/^\+?\d{7,14}$/.test(phone)) throw new AccountError('Enter a valid mobile number.', 400, 'phone');
    update.phone = phone || null;
  }
  if (input.profile && typeof input.profile === 'object') {
    const raw = input.profile as Record<string, unknown>;
    const profile: LearnerProfile = { ...(learner.profile ?? {}) };
    for (const [k, max] of Object.entries(PROFILE_FIELDS) as [keyof LearnerProfile, number][]) {
      if (raw[k] === undefined) continue;
      const v = typeof raw[k] === 'string' ? (raw[k] as string).trim().slice(0, max) : '';
      if (v) profile[k] = v;
      else delete profile[k];
    }
    if (profile.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(profile.dateOfBirth)) delete profile.dateOfBirth;
    update.profile = profile;
  }
  await learner.update(update);
  return learner;
}

const IMAGE_TYPES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b.subarray(0, 4).toString('hex') === '89504e47',
  'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
};
const MAX_AVATAR_BYTES = 600 * 1024;

/** Saves a profile photo sent as a data: URL (the browser shrinks it to 256×256 first). */
export async function saveAvatar(learner: Learner, dataUrl: unknown) {
  const m = typeof dataUrl === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) throw new AccountError('Choose a JPG, PNG or WebP image.');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > MAX_AVATAR_BYTES) throw new AccountError('That photo is too large. Please use one under 600 KB.');
  if (!IMAGE_TYPES[m[1]](data)) throw new AccountError('That file is not a valid image.');
  await LearnerAvatar.upsert({ learnerId: learner.id, mime: m[1], data });
  await learner.update({ avatarUpdatedAt: new Date() });
  return learner;
}

export async function removeAvatar(learner: Learner) {
  await LearnerAvatar.destroy({ where: { learnerId: learner.id } });
  await learner.update({ avatarUpdatedAt: null });
  return learner;
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
  const { trialHours } = await getAccessSettings();
  return Learner.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    lastLoginAt: new Date(),
    trialEndsAt: trialHours > 0 ? new Date(Date.now() + trialHours * 3600_000) : null,
  });
}

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

export async function loginLearner(input: { email?: unknown; password?: unknown }) {
  const email = cleanEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const learner = email ? await Learner.findOne({ where: { email } }) : null;
  const ok = await checkPassword(password, learner?.passwordHash ?? (await (dummyHash ??= hashPassword('not-a-real-password'))));
  if (!learner || !ok) throw new AccountError('Wrong email or password.', 401);
  if (!learner.active) {
    throw new AccountError(`This account has been blocked${learner.blockedReason ? `: ${learner.blockedReason}` : ''}. Please contact us.`, 403);
  }
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
