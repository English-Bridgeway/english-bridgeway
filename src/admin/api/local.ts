import { collectionIdField, type CollectionKey } from "../../data/content";
import { newId, readDemoDb, updateDemoDb, type DemoDb } from "../../utils/demoStore";
import { ApiError, type AdminApi, type AdminUser, type DashboardStats } from "./types";
import { getSession } from "./session";

// Demo admin API: same contract as the server, stored in this browser (utils/demoStore.ts).

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const strip = ({ password: _p, ...a }: DemoDb["admins"][number]): AdminUser => a;
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,158}$/;

function current(db: DemoDb) {
  const s = getSession();
  const admin = s && db.admins.find((a) => a.id === s.admin.id && a.active);
  if (!admin) throw new ApiError("Please sign in again.", 401);
  return admin;
}

function owner(db: DemoDb) {
  const admin = current(db);
  if (admin.role !== "owner") throw new ApiError("Only the site owner can do this.", 403);
  return admin;
}

function log(db: DemoDb, email: string, action: string, target: string | null = null) {
  db.audit.unshift({ id: newId(), adminEmail: email, action, target, createdAt: new Date().toISOString() });
  db.audit = db.audit.slice(0, 500);
}

const mask = (s: string) => (s ? `••••••${s.slice(-4)}` : null);

function paymentsView(db: DemoDb) {
  const p = db.payments;
  return { enabled: p.enabled, mode: p.mode, appId: p.appId, secretKeyMasked: mask(p.secretKey), webhookUrl: null, currency: "INR" as const };
}

export const localApi: AdminApi = {
  mode: "demo",
  async login(email, password) {
    const db = readDemoDb();
    const admin = db.admins.find((a) => a.email === email.trim().toLowerCase() && a.active);
    if (!admin || admin.password !== password) throw new ApiError("Email or password is incorrect.", 401);
    return wait(
      updateDemoDb((d) => {
        const a = d.admins.find((x) => x.id === admin.id)!;
        a.lastLoginAt = new Date().toISOString();
        log(d, a.email, "Signed in");
        return { token: `demo-${newId()}`, admin: strip(a), expiresAt: Date.now() + 12 * 3600_000 };
      }),
    );
  },
  async me() {
    return wait(strip(current(readDemoDb())));
  },
  async stats() {
    const db = readDemoDb();
    current(db);
    const paid = db.orders.filter((o) => o.status === "paid");
    const stats: DashboardStats = {
      content: Object.fromEntries((Object.keys(db.content) as CollectionKey[]).map((c) => [c, db.content[c].length])) as DashboardStats["content"],
      orders: { total: db.orders.length, paid: paid.length, pending: db.orders.filter((o) => o.status === "pending").length, revenue: paid.reduce((s, o) => s + o.amount, 0) },
      messages: { total: db.messages.length, unread: db.messages.filter((m) => m.status === "new").length },
      recentOrders: db.orders.slice(0, 5),
      recentMessages: db.messages.slice(0, 5),
    };
    return wait(clone(stats));
  },
  async listContent(c) {
    const db = readDemoDb();
    current(db);
    return wait(clone([...db.content[c]].sort((a, b) => a.position - b.position)));
  },
  async saveContent(c, record, originalKey) {
    if (!KEY_PATTERN.test(record.key)) throw new ApiError("The URL slug can use only lowercase letters, numbers and hyphens.", 400);
    return wait(
      updateDemoDb((db) => {
        const admin = current(db);
        const list = db.content[c];
        const from = originalKey ?? record.key;
        if (record.key !== from && list.some((r) => r.key === record.key)) throw new ApiError("Another item already uses this URL slug.", 409);
        const data = { ...(record.data as Record<string, unknown>), [collectionIdField[c]]: record.key };
        const existing = list.find((r) => r.key === from);
        const now = new Date().toISOString();
        let saved;
        if (existing) {
          Object.assign(existing, { key: record.key, data, published: record.published, updatedAt: now });
          saved = existing;
        } else {
          saved = { key: record.key, data, published: record.published, position: Math.max(-1, ...list.map((r) => r.position)) + 1, updatedAt: now };
          list.push(saved);
        }
        log(db, admin.email, `Saved ${c}`, record.key);
        return clone(saved);
      }),
    );
  },
  async deleteContent(c, key) {
    updateDemoDb((db) => {
      const admin = current(db);
      db.content[c] = db.content[c].filter((r) => r.key !== key);
      log(db, admin.email, `Deleted ${c}`, key);
    });
    return wait(undefined);
  },
  async reorderContent(c, keys) {
    updateDemoDb((db) => {
      const admin = current(db);
      for (const r of db.content[c]) {
        const i = keys.indexOf(r.key);
        if (i >= 0) r.position = i;
      }
      log(db, admin.email, `Reordered ${c}`);
    });
    return wait(undefined);
  },
  async getSite() {
    const db = readDemoDb();
    current(db);
    return wait(clone(db.site));
  },
  async saveSite(site) {
    if (!site.name.trim()) throw new ApiError("The site needs a name.", 400);
    return wait(
      updateDemoDb((db) => {
        log(db, current(db).email, "Updated site settings");
        db.site = clone(site);
        return clone(site);
      }),
    );
  },
  async getPayments() {
    const db = readDemoDb();
    owner(db);
    return wait(paymentsView(db));
  },
  async savePayments(input) {
    return wait(
      updateDemoDb((db) => {
        const admin = owner(db);
        db.payments = { enabled: input.enabled, mode: input.mode, appId: input.appId.trim(), secretKey: input.secretKey?.trim() || db.payments.secretKey };
        log(db, admin.email, "Updated payment gateway settings", `${input.mode}, ${input.enabled ? "enabled" : "disabled"}`);
        return paymentsView(db);
      }),
    );
  },
  async testPayments() {
    owner(readDemoDb());
    return wait({ ok: false, message: "Demo mode can't reach Cashfree. Connect the API server (see README) to test your keys." });
  },
  async listOrders() {
    const db = readDemoDb();
    current(db);
    return wait(clone(db.orders));
  },
  async syncOrder(id) {
    const db = readDemoDb();
    current(db);
    const order = db.orders.find((o) => o.orderId === id);
    if (!order) throw new ApiError("Order not found.", 404);
    return wait(clone(order));
  },
  async refundOrder(id, reason) {
    return wait(
      updateDemoDb((db) => {
        const admin = owner(db);
        const order = db.orders.find((o) => o.orderId === id);
        if (!order) throw new ApiError("Order not found.", 404);
        if (order.status !== "paid") throw new ApiError("Only paid orders can be refunded.", 400);
        order.status = "refunded";
        order.refundId = `RF-${id}`;
        log(db, admin.email, "Refunded order", `${id}${reason ? `: ${reason}` : ""}`);
        return clone(order);
      }),
    );
  },
  async listMessages() {
    const db = readDemoDb();
    current(db);
    return wait(clone(db.messages));
  },
  async updateMessage(id, status) {
    return wait(
      updateDemoDb((db) => {
        current(db);
        const m = db.messages.find((x) => x.id === id);
        if (!m) throw new ApiError("Message not found.", 404);
        m.status = status;
        return clone(m);
      }),
    );
  },
  async deleteMessage(id) {
    updateDemoDb((db) => {
      log(db, current(db).email, "Deleted message", id);
      db.messages = db.messages.filter((m) => m.id !== id);
    });
    return wait(undefined);
  },
  async listAdmins() {
    const db = readDemoDb();
    owner(db);
    return wait(db.admins.map(strip));
  },
  async saveAdmin(input) {
    return wait(
      updateDemoDb((db) => {
        const me = owner(db);
        const email = input.email.trim().toLowerCase();
        if (input.password && input.password.length < 10) throw new ApiError("Use a password of at least 10 characters.", 400);
        if (input.id) {
          const a = db.admins.find((x) => x.id === input.id);
          if (!a) throw new ApiError("Admin not found.", 404);
          const otherOwners = db.admins.filter((x) => x.id !== a.id && x.role === "owner" && x.active).length;
          if (a.role === "owner" && (input.role !== "owner" || !input.active) && !otherOwners) throw new ApiError("Keep at least one active owner.", 400);
          Object.assign(a, { name: input.name.trim(), role: input.role, active: input.active }, input.password ? { password: input.password } : {});
          log(db, me.email, "Updated admin", a.email);
          return strip(a);
        }
        if (!input.password) throw new ApiError("Use a password of at least 10 characters.", 400);
        if (db.admins.some((a) => a.email === email)) throw new ApiError("An admin with this email already exists.", 409);
        const a = { id: newId(), email, name: input.name.trim(), role: input.role, active: input.active, lastLoginAt: null, createdAt: new Date().toISOString(), password: input.password };
        db.admins.push(a);
        log(db, me.email, "Added admin", `${email} (${a.role})`);
        return strip(a);
      }),
    );
  },
  async deleteAdmin(id) {
    updateDemoDb((db) => {
      const me = owner(db);
      if (id === me.id) throw new ApiError("You cannot remove your own account.", 400);
      const a = db.admins.find((x) => x.id === id);
      db.admins = db.admins.filter((x) => x.id !== id);
      if (a) log(db, me.email, "Removed admin", a.email);
    });
    return wait(undefined);
  },
  async changePassword(currentPassword, next) {
    updateDemoDb((db) => {
      const me = current(db);
      if (me.password !== currentPassword) throw new ApiError("Your current password is incorrect.", 400);
      if (next.length < 10) throw new ApiError("Use a password of at least 10 characters.", 400);
      me.password = next;
      log(db, me.email, "Changed own password");
    });
    return wait(undefined);
  },
  async listAudit() {
    const db = readDemoDb();
    current(db);
    return wait(clone(db.audit));
  },
};
