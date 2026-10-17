import crypto from 'crypto';
import { Setting } from '../db';
import { config } from '../config';

// Site settings and payment-gateway settings edited in the admin panel.
// The Cashfree secret key is stored encrypted (AES-256-GCM) and only ever
// leaves the server masked. Values saved in the admin panel win over the
// CASHFREE_* environment variables; clearing them falls back to the env.

export interface PaymentConfig {
  enabled: boolean;
  mode: 'sandbox' | 'production';
  appId: string;
  secretKey: string;
}

interface StoredPayments {
  enabled: boolean;
  mode: 'sandbox' | 'production';
  appId: string;
  secretKeyEnc: string | null;
}

function encryptionKey(): Buffer {
  const source = process.env.SETTINGS_ENCRYPTION_KEY || config.jwtSecret;
  return crypto.createHash('sha256').update(`english-bridgeway-settings:${source}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(value: string | null): string {
  if (!value) return '';
  try {
    const [iv, tag, enc] = value.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    // The encryption key changed since this was saved. Treat it as not set.
    return '';
  }
}

export function maskSecret(secret: string): string | null {
  if (!secret) return null;
  return `••••••${secret.slice(-4)}`;
}

async function read<T>(key: string): Promise<T | null> {
  const row = await Setting.findByPk(key);
  return row ? (row.value as T) : null;
}

async function write(key: string, value: object): Promise<void> {
  await Setting.upsert({ key, value: value as Record<string, unknown> });
}

// ---- Site ----

export async function getSiteSettings(): Promise<Record<string, unknown> | null> {
  return read<Record<string, unknown>>('site');
}

export async function saveSiteSettings(site: Record<string, unknown>): Promise<void> {
  await write('site', site);
}

// ---- Business details and policy pages (Admin → Policies & business) ----

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function getPolicies(): Promise<Record<string, unknown> | null> {
  return read<Record<string, unknown>>('policies');
}

/** Keeps only the known fields. A blank policy text means "use the website's default wording". */
export async function savePolicies(input: unknown): Promise<Record<string, unknown>> {
  const r = (input ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const b = r.business ?? {};
  const doc = (d: Record<string, unknown> | undefined) => ({
    title: text(d?.title, 120),
    updated: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.updated ?? '')) ? String(d!.updated) : '',
    body: text(d?.body, 60_000),
  });
  const policies = {
    business: {
      legalName: text(b.legalName, 160),
      address: text(b.address, 400),
      phone: text(b.phone, 40),
      email: text(b.email, 254),
      gstin: text(b.gstin, 20).toUpperCase(),
      jurisdiction: text(b.jurisdiction, 80),
    },
    pricingNote: text((input as Record<string, unknown> | null)?.pricingNote, 400),
    terms: doc(r.terms),
    refunds: doc(r.refunds),
    privacy: doc(r.privacy),
  };
  await write('policies', policies);
  return policies;
}

// ---- Payments ----

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const stored = await read<StoredPayments>('payments');
  const envMode = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
  return {
    enabled: stored?.enabled ?? Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),
    // Sandbox is the default so a missing setting fails toward "nothing happens
    // in a real account" rather than silently charging real money.
    mode: stored?.mode ?? envMode,
    appId: stored?.appId || process.env.CASHFREE_APP_ID || '',
    secretKey: decryptSecret(stored?.secretKeyEnc ?? null) || process.env.CASHFREE_SECRET_KEY || '',
  };
}

export async function savePaymentConfig(input: { enabled: boolean; mode: 'sandbox' | 'production'; appId: string; secretKey?: string }) {
  const stored = await read<StoredPayments>('payments');
  const next: StoredPayments = {
    enabled: input.enabled,
    mode: input.mode,
    appId: input.appId.trim(),
    secretKeyEnc: input.secretKey ? encryptSecret(input.secretKey.trim()) : (stored?.secretKeyEnc ?? null),
  };
  await write('payments', next);
}

export function webhookUrl(): string | null {
  return config.apiPublicUrl ? `${config.apiPublicUrl}/api/webhooks/cashfree` : null;
}

export async function paymentSettingsForAdmin() {
  const cfg = await getPaymentConfig();
  return {
    enabled: cfg.enabled,
    mode: cfg.mode,
    appId: cfg.appId,
    secretKeyMasked: maskSecret(cfg.secretKey),
    webhookUrl: webhookUrl(),
    currency: 'INR' as const,
  };
}
