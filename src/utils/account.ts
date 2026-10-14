/**
 * Learner accounts for the public site. Live: the server in server/ (/api/auth, /api/me).
 * Demo mode (no VITE_API_BASE): accounts are kept in this browser only, so the preview build
 * can still show sign-up, log-in and course purchases end to end.
 */
import type { LearnerAccess, LearnerOffer, LearnerProfile, User } from "../types";
import type { Order } from "../admin/api/types";
import { API_BASE, apiFetch, HttpError, isLive } from "./backend";
import { DEMO_ACCESS_DEFAULTS, newId, readDemoDb } from "./demoStore";
import { publicUser, readDemoLearners, updateDemoLearner, writeDemoLearners, type DemoLearner } from "./demoLearners";
import { computeAccess, offerApplies } from "./access";
import { storage } from "./storage";

export interface LearnerSession {
  token: string;
  expiresAt: number;
  user: User;
}

export class AccountError extends Error {
  constructor(message: string, public readonly field?: "name" | "email" | "password" | "phone") {
    super(message);
  }
}

// Kept in localStorage so learners stay logged in for 30 days on this device.
const SESSION_KEY = "english-bridgeway:learner-session";

export function getLearnerSession(): LearnerSession | null {
  const s = storage.get<LearnerSession | null>(SESSION_KEY, null);
  return s && s.token && s.expiresAt > Date.now() ? s : null;
}

export const getLearnerToken = () => getLearnerSession()?.token ?? null;

export function saveSession(s: LearnerSession) {
  storage.set(SESSION_KEY, s);
  return s;
}

export function clearLearnerSession() {
  storage.remove(SESSION_KEY);
}

const toAccountError = (e: unknown) => {
  if (e instanceof HttpError) {
    return new AccountError(e.message, e.field);
  }
  return e instanceof Error ? e : new Error("Something went wrong. Please try again.");
};

/** The server sends photo paths relative to the API (/avatars/…); the browser needs the full URL. */
export function withAvatarBase(user: User): User {
  const url = user.avatarUrl;
  return url && url.startsWith("/avatars/") ? { ...user, avatarUrl: `${API_BASE}${url}` } : user;
}

const fixSession = (s: LearnerSession): LearnerSession => ({ ...s, user: withAvatarBase(s.user) });

export async function register(name: string, email: string, password: string): Promise<LearnerSession> {
  if (!isLive) return saveSession(await demo.register(name, email, password));
  try {
    return saveSession(fixSession(await apiFetch<LearnerSession>("/auth/register", { method: "POST", json: { name, email, password } })));
  } catch (e) {
    throw toAccountError(e);
  }
}

export async function login(email: string, password: string): Promise<LearnerSession> {
  if (!isLive) return saveSession(await demo.login(email, password));
  try {
    return saveSession(fixSession(await apiFetch<LearnerSession>("/auth/login", { method: "POST", json: { email, password } })));
  } catch (e) {
    throw toAccountError(e);
  }
}

export interface MeResponse {
  user: User;
  purchasedCourseIds: string[];
  access: LearnerAccess;
  offer: LearnerOffer | null;
}

/** The signed-in learner, their paid courses, access and offer. Throws HttpError 401 when the session ended. */
export async function fetchMe(token: string): Promise<MeResponse> {
  if (!isLive) return demo.me(token);
  const me = await apiFetch<MeResponse>("/me", { token });
  return { ...me, user: withAvatarBase(me.user) };
}

export interface ProfileInput {
  name?: string;
  phone?: string;
  profile?: LearnerProfile;
}

export async function updateProfile(token: string, input: ProfileInput): Promise<User> {
  if (!isLive) return demo.updateProfile(token, input);
  try {
    return withAvatarBase((await apiFetch<{ user: User }>("/me", { method: "PATCH", token, json: input })).user);
  } catch (e) {
    throw toAccountError(e);
  }
}

/** Shrinks a picture to a 256×256 JPEG (centre-cropped) so uploads stay small. */
export async function shrinkImage(file: File, size = 256): Promise<string> {
  if (!/^image\//.test(file.type)) throw new AccountError("Choose an image file (JPG, PNG or WebP).");
  if (file.size > 15 * 1024 * 1024) throw new AccountError("That picture is too large. Please choose one under 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new AccountError("That picture could not be opened. Try another one."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadAvatar(token: string, dataUrl: string): Promise<User> {
  if (!isLive) return demo.setAvatar(token, dataUrl);
  try {
    return withAvatarBase((await apiFetch<{ user: User }>("/me/avatar", { method: "PUT", token, json: { dataUrl } })).user);
  } catch (e) {
    throw toAccountError(e);
  }
}

export async function removeAvatar(token: string): Promise<User> {
  if (!isLive) return demo.setAvatar(token, null);
  return withAvatarBase((await apiFetch<{ user: User }>("/me/avatar", { method: "DELETE", token })).user);
}

export type MyOrder = Pick<Order, "orderId" | "courseId" | "courseTitle" | "amount" | "status" | "createdAt" | "paidAt">;

export async function fetchMyOrders(token: string): Promise<MyOrder[]> {
  if (!isLive) {
    const id = demo.find(token).id;
    return readDemoDb().orders.filter((o) => o.userId === id);
  }
  return apiFetch("/me/orders", { token });
}

// ---- Demo accounts (this browser only) ----

async function sha256(text: string) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return text; // No WebCrypto (insecure context): the demo still works, the data never leaves this browser.
  }
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "ST";

/** Demo access, worked out the same way as the server does it. */
export function demoAccessFor(l: DemoLearner): LearnerAccess {
  const state = computeAccess(l);
  const { aiForBuyers } = readDemoDb().access ?? DEMO_ACCESS_DEFAULTS;
  const bought = readDemoDb().orders.some((o) => o.userId === l.id && o.status === "paid");
  return { ...state, ai: state.full || (aiForBuyers && bought) };
}

const demo = {
  session(l: DemoLearner): LearnerSession {
    return { token: `demo:${l.id}`, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, user: publicUser(l) };
  },
  find(token: string) {
    const l = readDemoLearners().find((x) => `demo:${x.id}` === token);
    if (!l || !l.active) throw new HttpError("Please log in to continue.", 401);
    return l;
  },
  async register(name: string, email: string, password: string) {
    const all = readDemoLearners();
    const e = email.trim().toLowerCase();
    if (all.some((l) => l.email === e)) throw new AccountError("An account with this email already exists. Log in instead.", "email");
    const { trialHours } = readDemoDb().access ?? DEMO_ACCESS_DEFAULTS;
    const now = new Date();
    const l: DemoLearner = {
      id: newId(), name: name.trim(), email: e, avatarInitials: initialsOf(name), avatarUrl: null, passwordHash: await sha256(password),
      profile: {}, createdAt: now.toISOString(), lastLoginAt: now.toISOString(), active: true, blockedReason: null,
      trialEndsAt: trialHours > 0 ? new Date(now.getTime() + trialHours * 3600_000).toISOString() : null,
      accessUntil: null, accessUnlimited: false, offer: null, adminNote: null,
    };
    writeDemoLearners([...all, l]);
    return demo.session(l);
  },
  async login(email: string, password: string) {
    const l = readDemoLearners().find((x) => x.email === email.trim().toLowerCase());
    if (!l || l.passwordHash !== (await sha256(password))) throw new AccountError("Wrong email or password.");
    if (!l.active) throw new AccountError(`This account has been blocked${l.blockedReason ? `: ${l.blockedReason}` : ""}. Please contact us.`);
    updateDemoLearner(l.id, (x) => (x.lastLoginAt = new Date().toISOString()));
    return demo.session(l);
  },
  async me(token: string): Promise<MeResponse> {
    const l = demo.find(token);
    const purchasedCourseIds = [...new Set(readDemoDb().orders.filter((o) => o.userId === l.id && o.status === "paid").map((o) => o.courseId))];
    return { user: publicUser(l), purchasedCourseIds, access: demoAccessFor(l), offer: offerApplies(l.offer) ? l.offer : null };
  },
  async updateProfile(token: string, input: ProfileInput) {
    const l = demo.find(token);
    if (input.name !== undefined && input.name.trim().length < 2) throw new AccountError("Please enter your name.", "name");
    return publicUser(
      updateDemoLearner(l.id, (x) => {
        if (input.name !== undefined) {
          x.name = input.name.trim().replace(/\s+/g, " ");
          x.avatarInitials = initialsOf(x.name);
        }
        if (input.phone !== undefined) x.phone = input.phone.replace(/[^\d+]/g, "") || null;
        if (input.profile) {
          const next = { ...x.profile, ...input.profile };
          for (const k of Object.keys(next) as (keyof LearnerProfile)[]) if (!next[k]?.trim()) delete next[k];
          x.profile = next;
        }
      }),
    );
  },
  async setAvatar(token: string, dataUrl: string | null) {
    const l = demo.find(token);
    return publicUser(updateDemoLearner(l.id, (x) => (x.avatarUrl = dataUrl)));
  },
};
