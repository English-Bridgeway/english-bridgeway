import { collectionIdField, type CollectionKey } from "../../data/content";
import { DEMO_ACCESS_DEFAULTS, DEMO_AI_DEFAULTS, newId, readDemoDb, updateDemoDb, type DemoDb } from "../../utils/demoStore";
import { readDemoLearners, updateDemoLearner, writeDemoLearners, type DemoLearner } from "../../utils/demoLearners";
import { addMonths, computeAccess, offerApplies } from "../../utils/access";
import { ApiError, type AdminApi, type AdminUser, type DashboardStats, type LearnerDetail, type LearnerSummary } from "./types";
import { getSession } from "./session";
import { normalizePlans } from "../../utils/plans";

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

function learnerSummary(l: DemoLearner, orders: DemoDb["orders"]): LearnerSummary {
  const paid = orders.filter((o) => o.userId === l.id && o.status === "paid");
  return {
    id: l.id, name: l.name, email: l.email, phone: l.phone ?? null, avatarInitials: l.avatarInitials, avatarUrl: l.avatarUrl ?? null,
    profile: l.profile, createdAt: l.createdAt, lastLoginAt: l.lastLoginAt, active: l.active, blockedReason: l.blockedReason,
    access: computeAccess(l), offer: l.offer, offerActive: offerApplies(l.offer), paidOrders: paid.length, totalSpent: paid.reduce((s, o) => s + o.amount, 0),
  };
}

function learnerDetail(id: string): LearnerDetail {
  const l = readDemoLearners().find((x) => x.id === id);
  if (!l) throw new ApiError("Learner not found.", 404);
  const { orders } = readDemoDb();
  return { ...learnerSummary(l, orders), adminNote: l.adminNote, orders: orders.filter((o) => o.userId === id) };
}

/** Runs a learner change as an owner and writes it to the activity log. */
function changeLearner(id: string, action: string, fn: (l: DemoLearner) => void): Promise<LearnerDetail> {
  const db = readDemoDb();
  const admin = owner(db);
  let email = "";
  try {
    updateDemoLearner(id, (l) => {
      fn(l);
      email = l.email;
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Learner not found.", 404);
  }
  updateDemoDb((d) => log(d, admin.email, action, email));
  return wait(learnerDetail(id));
}

const endOfDay = (date: string) => new Date(`${date}T23:59:59+05:30`).toISOString();

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
      learners: readDemoLearners().length,
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
  async getPolicies() {
    const db = readDemoDb();
    owner(db);
    return wait(clone(db.policies ?? {}));
  },
  async savePolicies(policies) {
    return wait(
      updateDemoDb((db) => {
        log(db, owner(db).email, "Updated policies and business details");
        db.policies = clone(policies);
        return clone(policies);
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
        // A refunded subscription takes its months back off the learner's access.
        if (order.planMonths && order.userId) {
          updateDemoLearner(order.userId, (l) => {
            if (!l.accessUntil || l.accessUnlimited) return;
            const back = addMonths(new Date(l.accessUntil), -order.planMonths!);
            l.accessUntil = (back.getTime() > Date.now() ? back : new Date()).toISOString();
          });
        }
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
  async listLearners(q) {
    const db = readDemoDb();
    current(db);
    const needle = q?.trim().toLowerCase() ?? "";
    const rows = readDemoLearners()
      .filter((l) => !needle || [l.name, l.email, l.phone ?? ""].some((v) => v.toLowerCase().includes(needle)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return wait(rows.map((l) => learnerSummary(l, db.orders)));
  },
  async getLearner(id) {
    current(readDemoDb());
    return wait(learnerDetail(id));
  },
  async setLearnerAccess(id, change) {
    const now = new Date();
    if (change.mode === "months" && !(change.months >= 1 && change.months <= 120)) throw new ApiError("Choose between 1 and 120 months.", 400);
    if (change.mode === "until" && !(Date.parse(endOfDay(change.date)) > now.getTime())) throw new ApiError("Choose a date in the future.", 400);
    if (change.mode === "trial" && !(change.hours >= 1 && change.hours <= 24 * 90)) throw new ApiError("Choose between 1 hour and 90 days.", 400);
    const label = change.mode === "months" ? `+${change.months} months` : change.mode === "until" ? `until ${change.date}` : change.mode === "trial" ? `trial ${change.hours}h` : change.mode === "none" ? "removed" : "unlimited";
    return changeLearner(id, `Set learner access (${label})`, (l) => {
      if (change.mode === "months") {
        const from = l.accessUntil && Date.parse(l.accessUntil) > now.getTime() ? new Date(l.accessUntil) : now;
        l.accessUnlimited = false;
        l.accessUntil = addMonths(from, Math.round(change.months)).toISOString();
      } else if (change.mode === "until") {
        l.accessUnlimited = false;
        l.accessUntil = endOfDay(change.date);
      } else if (change.mode === "unlimited") {
        l.accessUnlimited = true;
      } else if (change.mode === "trial") {
        l.trialEndsAt = new Date(now.getTime() + change.hours * 3600_000).toISOString();
      } else {
        l.accessUnlimited = false;
        l.accessUntil = null;
        if (l.trialEndsAt && Date.parse(l.trialEndsAt) > now.getTime()) l.trialEndsAt = now.toISOString();
      }
    });
  },
  async setLearnerOffer(id, offer) {
    if (offer) {
      if (offer.kind === "percent" && !(offer.value >= 1 && offer.value <= 100)) throw new ApiError("The discount must be between 1% and 100%.", 400);
      if (offer.kind === "price" && !(offer.value >= 1)) throw new ApiError("The offer price must be at least ₹1.", 400);
    }
    return changeLearner(id, offer ? `Gave special offer (${offer.kind === "percent" ? `${offer.value}% off` : `₹${offer.value}`})` : "Removed special offer", (l) => {
      l.offer = offer ? { ...offer, value: Math.round(offer.value), note: offer.note.trim(), expiresAt: offer.expiresAt ? endOfDay(offer.expiresAt) : null } : null;
    });
  },
  async setLearnerBlocked(id, blocked, reason) {
    return changeLearner(id, blocked ? "Blocked learner" : "Unblocked learner", (l) => {
      l.active = !blocked;
      l.blockedReason = blocked ? reason?.trim() || null : null;
    });
  },
  async saveLearnerNote(id, note) {
    return changeLearner(id, "Updated learner note", (l) => {
      l.adminNote = note || null;
    });
  },
  async deleteLearner(id) {
    const db = readDemoDb();
    const admin = owner(db);
    const l = readDemoLearners().find((x) => x.id === id);
    writeDemoLearners(readDemoLearners().filter((x) => x.id !== id));
    if (l) updateDemoDb((d) => log(d, admin.email, "Deleted learner account", l.email));
    return wait(undefined);
  },
  async getAccessSettings() {
    const db = readDemoDb();
    current(db);
    return wait({ ...DEMO_ACCESS_DEFAULTS, ...db.access });
  },
  async saveAccessSettings(input) {
    return wait(
      updateDemoDb((db) => {
        const admin = owner(db);
        db.access = { trialHours: Math.max(0, Math.min(24 * 90, Math.round(input.trialHours) || 0)), aiForBuyers: input.aiForBuyers };
        log(db, admin.email, "Updated learner access settings", `trial ${db.access.trialHours}h`);
        return { ...db.access };
      }),
    );
  },
  async getPlans() {
    const db = readDemoDb();
    owner(db);
    return wait(clone(db.plans ?? []));
  },
  async savePlans(input) {
    return wait(
      updateDemoDb((db) => {
        const admin = owner(db);
        let plans;
        try {
          plans = normalizePlans(input);
        } catch (e) {
          throw new ApiError(e instanceof Error ? e.message : "Invalid plans.", 400);
        }
        db.plans = plans;
        log(db, admin.email, "Updated subscription plans", plans.map((p) => `${p.name} ₹${p.price}/${p.months}m`).join(", "));
        return clone(plans);
      }),
    );
  },
  async getAi() {
    const db = readDemoDb();
    owner(db);
    const ai = { ...DEMO_AI_DEFAULTS, ...db.ai };
    return wait({ enabled: ai.enabled, baseUrl: ai.baseUrl, model: ai.model, apiKeyMasked: mask(ai.apiKey), instructions: ai.instructions, dailyLimit: ai.dailyLimit });
  },
  async saveAi(input) {
    return wait(
      updateDemoDb((db) => {
        const admin = owner(db);
        const prev = { ...DEMO_AI_DEFAULTS, ...db.ai };
        db.ai = {
          enabled: input.enabled, baseUrl: input.baseUrl.trim().replace(/\/+$/, ""), model: input.model.trim(),
          apiKey: input.clearKey ? "" : input.apiKey?.trim() || prev.apiKey, instructions: input.instructions, dailyLimit: Math.max(0, Math.round(input.dailyLimit) || 0),
        };
        log(db, admin.email, "Updated AI tutor settings", input.enabled ? "on" : "off");
        const ai = db.ai;
        return { enabled: ai.enabled, baseUrl: ai.baseUrl, model: ai.model, apiKeyMasked: mask(ai.apiKey), instructions: ai.instructions, dailyLimit: ai.dailyLimit };
      }),
    );
  },
  async testAi() {
    const db = readDemoDb();
    owner(db);
    const ai = { ...DEMO_AI_DEFAULTS, ...db.ai };
    try {
      const res = await fetch(`${ai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({ model: ai.model, max_tokens: 20, messages: [{ role: "user", content: 'Say "Hello from the AI tutor" and nothing else.' }] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: `The AI service returned an error (${res.status})${data?.error?.message ? `: ${data.error.message}` : ""}` };
      return { ok: true, message: `Connected to ${ai.model}. It said: “${String(data?.choices?.[0]?.message?.content ?? "").slice(0, 120)}”` };
    } catch {
      return { ok: false, message: "The browser could not reach the AI service. Some providers only accept calls from a server; it will work once the API server is connected." };
    }
  },
};
