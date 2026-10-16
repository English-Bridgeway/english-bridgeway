import { collectionIdField, getBundledContent, type CollectionKey, type ContentBundle, type ContentCollections } from "../data/content";
import type { SiteSettings } from "../data/site";
import type { AdminPlan, AdminUser, AuditEntry, ContactMessage, ContentRecord, Order } from "../admin/api/types";
import { storage } from "./storage";
import { toPublicPlan } from "./plans";
import type { Policies } from "../data/policies";

/**
 * Demo backend for when no API is configured (VITE_API_BASE unset), e.g. the preview build.
 * It mirrors the server's data in localStorage so the admin panel, checkout and contact form
 * all work end to end in one browser. Nothing here is shared with other visitors.
 */
export interface DemoDb {
  version: 1;
  content: Record<CollectionKey, ContentRecord[]>;
  site: SiteSettings;
  payments: { enabled: boolean; mode: "sandbox" | "production"; appId: string; secretKey: string };
  orders: Order[];
  messages: ContactMessage[];
  admins: (AdminUser & { password: string })[];
  audit: AuditEntry[];
  /** Free trial length and who may use Speak with AI (added later, so may be missing). */
  access?: { trialHours: number; aiForBuyers: boolean };
  /** AI tutor provider. In demo mode the browser calls it directly with this key. */
  /** Subscription plans (added later, so may be missing). */
  plans?: AdminPlan[];
  /** Business details and legal pages (added later, so may be missing). */
  policies?: Policies;
  ai?: { enabled: boolean; baseUrl: string; model: string; apiKey: string; instructions: string; dailyLimit: number };
}

export const DEMO_ACCESS_DEFAULTS = { trialHours: 24, aiForBuyers: true };
export const DEMO_AI_DEFAULTS = { enabled: false, baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant", apiKey: "", instructions: "", dailyLimit: 200 };

const KEY = "english-bridgeway:demo-db";
export const DEMO_ADMIN = { email: "admin@englishbridgeway.example", password: "demo-admin-123" };

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function fresh(): DemoDb {
  const bundle = getBundledContent();
  const now = new Date().toISOString();
  const content = Object.fromEntries(
    (Object.keys(bundle.collections) as CollectionKey[]).map((c) => [
      c,
      (bundle.collections[c] as unknown as Record<string, unknown>[]).map((data, position) => ({
        key: String(data[collectionIdField[c]]),
        data,
        published: true,
        position,
        updatedAt: now,
      })),
    ]),
  ) as Record<CollectionKey, ContentRecord[]>;
  return {
    version: 1,
    content,
    site: bundle.site,
    payments: { enabled: true, mode: "sandbox", appId: "", secretKey: "" },
    orders: [],
    messages: [],
    admins: [{ id: "demo-owner", email: DEMO_ADMIN.email, name: "Demo Owner", role: "owner", active: true, lastLoginAt: null, createdAt: now, password: DEMO_ADMIN.password }],
    audit: [],
  };
}

/** The saved demo data, or null if nobody has used the demo admin/checkout in this browser. */
export function peekDemoDb(): DemoDb | null {
  const db = storage.get<DemoDb | null>(KEY, null);
  return db && db.version === 1 ? db : null;
}

export function readDemoDb(): DemoDb {
  return peekDemoDb() ?? fresh();
}

export function writeDemoDb(db: DemoDb) {
  storage.set(KEY, db);
}

export function updateDemoDb<T>(fn: (db: DemoDb) => T): T {
  const db = readDemoDb();
  const result = fn(db);
  writeDemoDb(db);
  return result;
}

export function resetDemoDb() {
  storage.remove(KEY);
}

/** Published content from the demo data, in the same shape the API's /content returns. */
export function demoContentBundle(): ContentBundle | null {
  const db = peekDemoDb();
  if (!db) return null;
  const collections = Object.fromEntries(
    (Object.keys(db.content) as CollectionKey[]).map((c) => [c, [...db.content[c]].sort((a, b) => a.position - b.position).filter((r) => r.published).map((r) => r.data)]),
  ) as unknown as ContentCollections;
  const plans = (db.plans ?? []).filter((p) => p.active && p.price > 0).map(toPublicPlan);
  return { site: db.site, collections, plans, ...(db.policies ? { policies: db.policies } : {}) };
}
