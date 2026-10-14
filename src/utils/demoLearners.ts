import type { LearnerOffer, LearnerProfile, User } from "../types";
import { storage } from "./storage";

/**
 * Demo-mode learner accounts (no VITE_API_BASE): kept in this browser only, shared by the
 * public site (utils/account.ts) and the demo admin panel (admin/api/local.ts).
 */
export interface DemoLearner extends User {
  passwordHash: string;
  profile: LearnerProfile;
  createdAt: string;
  lastLoginAt: string | null;
  active: boolean;
  blockedReason: string | null;
  trialEndsAt: string | null;
  accessUntil: string | null;
  accessUnlimited: boolean;
  offer: LearnerOffer | null;
  adminNote: string | null;
}

const KEY = "english-bridgeway:demo-learners";

/** Accounts made before these fields existed get sensible defaults. */
function upgrade(l: Partial<DemoLearner> & User & { passwordHash: string }): DemoLearner {
  return {
    profile: {},
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    active: true,
    blockedReason: null,
    trialEndsAt: null,
    accessUntil: null,
    accessUnlimited: false,
    offer: null,
    adminNote: null,
    avatarUrl: null,
    ...l,
  };
}

export const readDemoLearners = (): DemoLearner[] => storage.get<DemoLearner[]>(KEY, []).map(upgrade);
export const writeDemoLearners = (all: DemoLearner[]) => storage.set(KEY, all);

export function updateDemoLearner(id: string, fn: (l: DemoLearner) => void): DemoLearner {
  const all = readDemoLearners();
  const l = all.find((x) => x.id === id);
  if (!l) throw new Error("Learner not found.");
  fn(l);
  writeDemoLearners(all);
  return l;
}

export function publicUser(l: DemoLearner): User {
  return { id: l.id, name: l.name, email: l.email, phone: l.phone ?? null, avatarInitials: l.avatarInitials, avatarUrl: l.avatarUrl ?? null, profile: l.profile, createdAt: l.createdAt };
}
