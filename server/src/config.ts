import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set to a long random string in production (see .env.example)');
  }
  // Development only: a per-process secret, so sessions end when the server restarts.
  return crypto.randomBytes(32).toString('hex');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/english_bridgeway',
  jwtSecret: jwtSecret(),
  sessionHours: 12,
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiPublicUrl: (process.env.API_PUBLIC_URL || '').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
