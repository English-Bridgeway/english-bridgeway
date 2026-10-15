import { Link } from "react-router-dom";
import { Clock, Crown, Infinity as InfinityIcon, Lock, Tag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatDate, offerApplies, timeLeft } from "../utils/access";
import { getCourse } from "../data/courses";
import { cn } from "../utils/cn";
import { formatDuration } from "../voice/callUi";

/** The learner's plan at a glance: free trial countdown, access end date, or "trial ended, buy a course". */
export function AccessBanner({ className }: { className?: string }) {
  const { access, offer, purchasedCourseIds, usage } = useAuth();
  if (!access) return null;
  const offerLine = offerApplies(offer) && (
    <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
      <Tag className="h-4 w-4" aria-hidden="true" />
      Special offer for you: {offer.kind === "percent" ? `${offer.value}% off` : `₹${offer.value}`}
      {offer.courseId ? ` on ${getCourse(offer.courseId)?.title ?? "a course"}` : " on any course"}
      {offer.expiresAt ? `, until ${formatDate(offer.expiresAt)}` : ""}
      {offer.note ? ` · ${offer.note}` : ""}
    </p>
  );

  if (access.status === "trial") {
    return (
      <div className={cn("rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5", className)} role="status">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <Clock className="h-5 w-5" aria-hidden="true" /> Free trial: {timeLeft(access.until)} left
        </p>
        <p className="mt-1 text-sm text-amber-900/90">
          Until {formatDate(access.until)}, {new Date(access.until!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} you can try
          {usage?.freeLessons ? ` the first ${usage.freeLessons === 1 ? "lesson" : `${usage.freeLessons} lessons`} of every course,` : ""}
          {usage?.ai.limit != null ? ` ${usage.ai.remaining} of ${usage.ai.limit} AI chat messages` : " Speak with AI"}
          {usage?.call.limit != null ? (usage.call.remaining ? ` and ${formatDuration(usage.call.remaining)} of live calls left` : " (your free call minutes are used up)") : ""}.
          {" "}Subscribe or buy a course to open every lesson.
        </p>
        <Link to="/learn/billing#plans" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-900 underline">See plans</Link>
        {offerLine}
      </div>
    );
  }
  if (access.status === "unlimited" || access.status === "active") {
    return (
      <div className={cn("rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5", className)} role="status">
        <p className="flex items-center gap-2 font-semibold text-emerald-900">
          {access.status === "unlimited" ? <InfinityIcon className="h-5 w-5" aria-hidden="true" /> : <Crown className="h-5 w-5" aria-hidden="true" />}
          {access.status === "unlimited" ? "Full access, no end date" : `Full access until ${formatDate(access.until)} (${timeLeft(access.until)} left)`}
        </p>
        <p className="mt-1 text-sm text-emerald-900/90">
          Every course is open for you
          {usage?.tier === "paid" && (usage.ai.limit != null || usage.call.limit != null)
            ? `, with ${usage.ai.limit != null ? `${usage.ai.limit} AI chat messages` : "unlimited AI chat"} and ${usage.call.limit != null ? `${Math.round(usage.call.limit / 60)} minutes of live calls` : "unlimited live calls"} every day.`
            : ", with Speak with AI and live calls."}
        </p>
        {offerLine}
      </div>
    );
  }
  return (
    <div className={cn("rounded-2xl border border-ink-200 bg-ink-50 p-4 sm:p-5", className)} role="status">
      <p className="flex items-center gap-2 font-semibold text-ink-900">
        <Lock className="h-5 w-5" aria-hidden="true" /> {access.trialEndsAt ? "Your free trial has ended" : "Paid courses are locked"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {purchasedCourseIds.length
          ? "Your bought courses stay open. Buy another course, or subscribe to open them all."
          : "Buy a course, or subscribe to open every course and keep practising with the AI tutor and live calls."}{" "}
        <Link to="/learn/courses" className="font-semibold text-ink-700 underline">See courses</Link>
      </p>
      {offerLine}
    </div>
  );
}
