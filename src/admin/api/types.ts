import type { CollectionKey } from "../../data/content";
import type { SiteSettings } from "../../data/site";
import type { CallLogEntry, LearnerAccess, LearnerOffer, LearnerProfile, UsageSummary } from "../../types";

// Shapes shared by the admin panel and the API in server/. Keep them in sync with server/src/types.ts.

import type { Policies } from "../../data/policies";

export type AdminRole = "owner" | "editor";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminSession {
  token: string;
  admin: AdminUser;
  expiresAt: number;
}

export interface ContentRecord<T = Record<string, unknown>> {
  key: string; // the item's id / slug
  data: T;
  published: boolean;
  position: number;
  updatedAt: string;
}

export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export interface Order {
  orderId: string;
  /** The learner account that bought the course (null for orders placed before accounts existed). */
  userId?: string | null;
  courseId: string;
  courseTitle: string;
  /** "plan" for subscriptions (courseId is then "plan:<id>"). Missing on older demo orders. */
  kind?: "course" | "plan";
  planId?: string | null;
  planMonths?: number | null;
  amount: number; // rupees
  currency: "INR";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  gateway: "cashfree" | "demo";
  gatewayPaymentId: string | null;
  bankReference: string | null;
  refundId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "archived";
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  target: string | null;
  createdAt: string;
}

/** What the admin sees of the gateway settings. Secrets come back masked, never in full. */
export interface PaymentSettings {
  enabled: boolean;
  mode: "sandbox" | "production";
  appId: string;
  secretKeyMasked: string | null; // e.g. "••••••3f9a"; null when not set
  webhookUrl: string | null;
  currency: "INR";
}

export interface PaymentSettingsInput {
  enabled: boolean;
  mode: "sandbox" | "production";
  appId: string;
  secretKey?: string; // empty/undefined keeps the stored key
}

export interface DashboardStats {
  learners?: number;
  content: Record<CollectionKey, number>;
  orders: { total: number; paid: number; pending: number; revenue: number };
  messages: { total: number; unread: number };
  recentOrders: Order[];
  recentMessages: ContactMessage[];
}

export interface LearnerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarInitials: string;
  avatarUrl: string | null;
  profile: LearnerProfile;
  createdAt: string;
  lastLoginAt: string | null;
  active: boolean;
  blockedReason: string | null;
  access: Omit<LearnerAccess, "ai">;
  offer: LearnerOffer | null;
  offerActive: boolean;
  paidOrders: number;
  totalSpent: number;
}

export interface LearnerDetail extends LearnerSummary {
  adminNote: string | null;
  orders: Order[];
  usage?: UsageSummary;
  calls?: CallLogEntry[];
}

export type AccessChange =
  | { mode: "months"; months: number }
  | { mode: "until"; date: string }
  | { mode: "unlimited" }
  | { mode: "trial"; hours: number }
  | { mode: "none" };

export interface OfferInput {
  kind: "price" | "percent";
  value: number;
  courseId: string | null;
  note: string;
  /** YYYY-MM-DD, or null for no end date. */
  expiresAt: string | null;
}

/** A subscription plan as the admin edits it. */
export interface AdminPlan {
  /** Empty for a new plan; the server makes one from the name. */
  id: string;
  name: string;
  description: string;
  price: number;
  months: number;
  active: boolean;
  highlight: boolean;
}

export interface AccessSettings {
  /** Hours the free trial lasts after sign-up (0 = no trial). */
  trialHours: number;
  /** Lessons at the start of each course open during the trial. */
  freeLessons: number;
  /** AI tutor messages for the whole trial. */
  trialAiMessages: number;
  /** Minutes of live calls for the whole trial. */
  trialCallMinutes: number;
  /** AI tutor messages a day once paid (0 = no limit). */
  paidAiPerDay: number;
  /** Minutes of live calls a day once paid (0 = no limit). */
  paidCallMinutesPerDay: number;
}

export interface AiSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeyMasked: string | null;
  instructions: string;
  dailyLimit: number;
}

export interface AiSettingsInput {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearKey?: boolean;
  instructions: string;
  dailyLimit: number;
}

export interface AdminApi {
  mode: "live" | "demo";
  login(email: string, password: string): Promise<AdminSession>;
  me(): Promise<AdminUser>;
  stats(): Promise<DashboardStats>;

  listContent(collection: CollectionKey): Promise<ContentRecord[]>;
  saveContent(collection: CollectionKey, record: { key: string; data: unknown; published: boolean }, originalKey?: string): Promise<ContentRecord>;
  deleteContent(collection: CollectionKey, key: string): Promise<void>;
  reorderContent(collection: CollectionKey, keys: string[]): Promise<void>;

  getSite(): Promise<SiteSettings>;
  saveSite(site: SiteSettings): Promise<SiteSettings>;
  /** Saved business details and policy pages; missing fields use the website's defaults. */
  getPolicies(): Promise<Partial<Policies>>;
  savePolicies(policies: Policies): Promise<Partial<Policies>>;

  getPayments(): Promise<PaymentSettings>;
  savePayments(input: PaymentSettingsInput): Promise<PaymentSettings>;
  testPayments(): Promise<{ ok: boolean; message: string }>;

  listOrders(): Promise<Order[]>;
  syncOrder(orderId: string): Promise<Order>;
  refundOrder(orderId: string, reason: string): Promise<Order>;

  listMessages(): Promise<ContactMessage[]>;
  updateMessage(id: string, status: ContactMessage["status"]): Promise<ContactMessage>;
  deleteMessage(id: string): Promise<void>;

  listAdmins(): Promise<AdminUser[]>;
  saveAdmin(input: { id?: string; email: string; name: string; role: AdminRole; active: boolean; password?: string }): Promise<AdminUser>;
  deleteAdmin(id: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;

  listAudit(): Promise<AuditEntry[]>;

  listLearners(q?: string): Promise<LearnerSummary[]>;
  getLearner(id: string): Promise<LearnerDetail>;
  setLearnerAccess(id: string, change: AccessChange): Promise<LearnerDetail>;
  setLearnerOffer(id: string, offer: OfferInput | null): Promise<LearnerDetail>;
  setLearnerBlocked(id: string, blocked: boolean, reason?: string): Promise<LearnerDetail>;
  saveLearnerNote(id: string, note: string): Promise<LearnerDetail>;
  deleteLearner(id: string): Promise<void>;
  getAccessSettings(): Promise<AccessSettings>;
  getPlans(): Promise<AdminPlan[]>;
  savePlans(plans: AdminPlan[]): Promise<AdminPlan[]>;
  saveAccessSettings(input: AccessSettings): Promise<AccessSettings>;

  getAi(): Promise<AiSettings>;
  saveAi(input: AiSettingsInput): Promise<AiSettings>;
  testAi(): Promise<{ ok: boolean; message: string }>;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}
