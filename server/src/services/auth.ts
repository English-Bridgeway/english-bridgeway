import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Admin } from '../db';

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const checkPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function validatePassword(plain: unknown): string | null {
  if (typeof plain !== 'string' || plain.length < 10) return 'Use a password of at least 10 characters.';
  return null;
}

export interface TokenPayload {
  sub: string;
  role: 'owner' | 'editor';
}

export function signToken(admin: Admin): string {
  return jwt.sign({ sub: admin.id, role: admin.role } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`,
    audience: 'english-bridgeway-admin',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret, { audience: 'english-bridgeway-admin' }) as TokenPayload;
  } catch {
    return null;
  }
}

export function adminDto(a: Admin) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    active: a.active,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Creates the first owner from ADMIN_EMAIL / ADMIN_PASSWORD when no admin exists yet. */
export async function ensureFirstAdmin(): Promise<string | null> {
  if ((await Admin.count()) > 0) return null;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const problem = validatePassword(password);
  if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
  await Admin.create({ email, name: process.env.ADMIN_NAME || 'Site Owner', passwordHash: await hashPassword(password), role: 'owner' });
  return email;
}
