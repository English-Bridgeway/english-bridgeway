/**
 * Learner accounts for the public site. Live: the server in server/ (/api/auth, /api/me).
 * Demo mode (no VITE_API_BASE): accounts are kept in this browser only, so the preview build
 * can still show sign-up, log-in and course purchases end to end.
 */
import type { User } from "../types";
import { apiFetch, HttpError, isLive } from "./backend";
import { newId, readDemoDb } from "./demoStore";
import { storage } from "./storage";

export interface LearnerSession {
  token: string;
  expiresAt: number;
  user: User;
}

export class AccountError extends Error {
  constructor(message: string, public readonly field?: "name" | "email" | "password") {
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

function saveSession(s: LearnerSession) {
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

export async function register(name: string, email: string, password: string): Promise<LearnerSession> {
  if (!isLive) return saveSession(await demo.register(name, email, password));
  try {
    return saveSession(await apiFetch<LearnerSession>("/auth/register", { method: "POST", json: { name, email, password } }));
  } catch (e) {
    throw toAccountError(e);
  }
}

export async function login(email: string, password: string): Promise<LearnerSession> {
  if (!isLive) return saveSession(await demo.login(email, password));
  try {
    return saveSession(await apiFetch<LearnerSession>("/auth/login", { method: "POST", json: { email, password } }));
  } catch (e) {
    throw toAccountError(e);
  }
}

/** The signed-in learner and the paid courses they own. Throws HttpError 401 when the session ended. */
export async function fetchMe(token: string): Promise<{ user: User; purchasedCourseIds: string[] }> {
  if (!isLive) return demo.me(token);
  return apiFetch("/me", { token });
}

// ---- Demo accounts (this browser only) ----

interface DemoLearner extends User {
  passwordHash: string;
}
const DEMO_KEY = "english-bridgeway:demo-learners";

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

const demo = {
  learners: () => storage.get<DemoLearner[]>(DEMO_KEY, []),
  session(l: DemoLearner): LearnerSession {
    const { passwordHash: _ignored, ...user } = l;
    return { token: `demo:${l.id}`, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, user };
  },
  async register(name: string, email: string, password: string) {
    const all = demo.learners();
    const e = email.trim().toLowerCase();
    if (all.some((l) => l.email === e)) throw new AccountError("An account with this email already exists. Log in instead.", "email");
    const l: DemoLearner = { id: newId(), name: name.trim(), email: e, avatarInitials: initialsOf(name), passwordHash: await sha256(password) };
    storage.set(DEMO_KEY, [...all, l]);
    return demo.session(l);
  },
  async login(email: string, password: string) {
    const l = demo.learners().find((x) => x.email === email.trim().toLowerCase());
    if (!l || l.passwordHash !== (await sha256(password))) throw new AccountError("Wrong email or password.");
    return demo.session(l);
  },
  async me(token: string) {
    const l = demo.learners().find((x) => `demo:${x.id}` === token);
    if (!l) throw new HttpError("Please log in to continue.", 401);
    const { passwordHash: _ignored, ...user } = l;
    const purchasedCourseIds = [...new Set(readDemoDb().orders.filter((o) => o.userId === l.id && o.status === "paid").map((o) => o.courseId))];
    return { user, purchasedCourseIds };
  },
};
