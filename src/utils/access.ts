import type { AccessStatus, LearnerAccess, LearnerOffer } from "../types";

// The same rules as server/src/services/access.ts, for the demo backend and for showing prices.

export interface AccessFields {
  active: boolean;
  accessUnlimited: boolean;
  accessUntil: string | null;
  trialEndsAt: string | null;
}

export function computeAccess(l: AccessFields, now = Date.now()): Omit<LearnerAccess, "ai"> {
  const trialEnds = l.trialEndsAt ? Date.parse(l.trialEndsAt) : 0;
  const grantedEnds = l.accessUntil ? Date.parse(l.accessUntil) : 0;
  const base = { trialEndsAt: l.trialEndsAt, accessUntil: l.accessUntil, unlimited: l.accessUnlimited };
  const state = (status: AccessStatus, full: boolean, until: string | null) => ({ ...base, status, full, until });
  if (!l.active) return state("blocked", false, null);
  if (l.accessUnlimited) return state("unlimited", true, null);
  if (grantedEnds > now && grantedEnds >= trialEnds) return state("active", true, l.accessUntil);
  if (trialEnds > now) return state("trial", true, l.trialEndsAt);
  return state("expired", false, null);
}

export function offerApplies(offer: LearnerOffer | null | undefined, courseId?: string, now = Date.now()): offer is LearnerOffer {
  if (!offer || !(offer.value > 0)) return false;
  if (offer.expiresAt && Date.parse(offer.expiresAt) < now) return false;
  return !(courseId && offer.courseId && offer.courseId !== courseId);
}

/** The price after the learner's special offer. Never below ₹1 and never above the list price. */
export function offerPrice(offer: LearnerOffer | null | undefined, courseId: string, basePrice: number): number {
  if (!offerApplies(offer, courseId)) return basePrice;
  const offered = offer.kind === "price" ? offer.value : basePrice * (1 - Math.min(100, offer.value) / 100);
  return Math.max(1, Math.min(basePrice, Math.round(offered)));
}

/** "3 hours", "5 days"… until the given time. */
export function timeLeft(until: string | null, now = Date.now()): string {
  if (!until) return "";
  const ms = Date.parse(until) - now;
  if (ms <= 0) return "0 minutes";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
