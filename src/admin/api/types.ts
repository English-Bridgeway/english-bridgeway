import type { CollectionKey } from "../../data/content";
import type { SiteSettings } from "../../data/site";

// Shapes shared by the admin panel and the API in server/. Keep them in sync with server/src/types.ts.

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
  content: Record<CollectionKey, number>;
  orders: { total: number; paid: number; pending: number; revenue: number };
  messages: { total: number; unread: number };
  recentOrders: Order[];
  recentMessages: ContactMessage[];
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
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}
