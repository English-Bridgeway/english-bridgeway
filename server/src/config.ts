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
  corsOrigins: list(process.env.CORS_ORIGIN),
  voice: {
    // Public STUN servers let two browsers find each other's address. They are enough for
    // most home and mobile networks; TURN (below) relays audio when a direct path is blocked.
    stunUrls: process.env.STUN_URLS !== undefined ? list(process.env.STUN_URLS) : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    // e.g. "turn:englishbridgeway.com:3478?transport=udp,turn:englishbridgeway.com:3478?transport=tcp".
    // When only TURN_SECRET is set, the TURN server is assumed to run on the site's own host.
    turnUrls: list(process.env.TURN_URLS).length ? list(process.env.TURN_URLS) : defaultTurnUrls(),
    // The coturn static-auth-secret. Learners get short-lived usernames/passwords made from it.
    turnSecret: process.env.TURN_SECRET || '',
    maxRoomSize: Math.min(12, Math.max(2, Number(process.env.VOICE_MAX_ROOM_SIZE || 6))),
  },
};

function defaultTurnUrls(): string[] {
  if (!process.env.TURN_SECRET) return [];
  let host = '';
  try {
    host = new URL(process.env.PUBLIC_SITE_URL || '').hostname;
  } catch {
    return [];
  }
  if (!host || host === 'localhost' || host === '127.0.0.1') return [];
  return [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`];
}

function list(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
