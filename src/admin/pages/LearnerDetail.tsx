import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CalendarClock, Clock, Infinity as InfinityIcon, Mail, Phone, ShieldCheck, Tag, Trash2, Unlock } from "lucide-react";
import { adminApi, type AccessChange, type LearnerDetail as Detail } from "../api";
import { useAdmin } from "../AdminContext";
import { Confirm, ErrorNote, Loading, Panel, StatusPill, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { UserAvatar } from "../../portal/Avatar";
import { AccessPill } from "./Learners";
import { courses } from "../../data/courses";
import { formatDate, formatDateTime, timeLeft } from "../../utils/access";
import { formatPrice } from "../../utils/format";
import { cn } from "../../utils/cn";
import { formatDuration } from "../../voice/callUi";
import type { CallLogEntry, UsageSummary } from "../../types";

const PROFILE_LABELS: [keyof Detail["profile"], string][] = [
  ["whatsapp", "WhatsApp"], ["dateOfBirth", "Date of birth"], ["gender", "Gender"], ["city", "City"], ["state", "State"], ["country", "Country"],
  ["occupation", "Occupation"], ["englishLevel", "English level"], ["goal", "Learning goal"], ["about", "About"],
];

const today = () => new Date().toISOString().slice(0, 10);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

function AccessPanel({ l, onChange }: { l: Detail; onChange: (change: AccessChange) => Promise<unknown> }) {
  const { isOwner } = useAdmin();
  const [months, setMonths] = useState(3);
  const [until, setUntil] = useState("");
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const run = async (c: AccessChange) => {
    setBusy(true);
    try {
      await onChange(c);
    } finally {
      setBusy(false);
    }
  };
  const a = l.access;
  return (
    <Panel title="Course access">
      <div className="flex flex-wrap items-center gap-2"><AccessPill access={a} /></div>
      <dl className="mt-3 divide-y divide-line">
        <Row label="Free trial">{a.trialEndsAt ? `${Date.parse(a.trialEndsAt) > Date.now() ? "Ends" : "Ended"} ${formatDateTime(a.trialEndsAt)}` : "None"}</Row>
        <Row label="Access given">{a.unlimited ? "Unlimited" : a.accessUntil ? `${Date.parse(a.accessUntil) > Date.now() ? `Until ${formatDate(a.accessUntil)} (${timeLeft(a.accessUntil)} left)` : `Ended ${formatDate(a.accessUntil)}`}` : "None"}</Row>
        <Row label="Bought courses">{l.paidOrders ? `${l.paidOrders} · ${formatPrice(l.totalSpent)} in total (always open)` : "None"}</Row>
      </dl>
      {isOwner ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <p className="text-sm text-muted">Full access opens every course, with the paid daily AI and call allowances. A free trial opens only the first lesson(s) of each course.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-semibold">Give months</span>
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={cn(inputClass, "mt-1 w-32")}>
                {[1, 2, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
              </select>
            </label>
            <Button size="sm" disabled={busy} onClick={() => run({ mode: "months", months })}><CalendarClock className="h-4 w-4" aria-hidden="true" /> Add {months} month{months > 1 ? "s" : ""}</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-semibold">Or until a date</span>
              <input type="date" min={today()} value={until} onChange={(e) => setUntil(e.target.value)} className={cn(inputClass, "mt-1 w-44")} />
            </label>
            <Button size="sm" variant="outline" disabled={busy || !until} onClick={() => run({ mode: "until", date: until })}>Set end date</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-semibold">Restart free trial (hours)</span>
              <input type="number" min={1} max={2160} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={cn(inputClass, "mt-1 w-28")} />
            </label>
            <Button size="sm" variant="outline" disabled={busy || !(hours >= 1)} onClick={() => run({ mode: "trial", hours })}><Clock className="h-4 w-4" aria-hidden="true" /> Start trial</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy || a.unlimited} onClick={() => run({ mode: "unlimited" })}><InfinityIcon className="h-4 w-4" aria-hidden="true" /> Give unlimited access</Button>
            <Button size="sm" variant="danger-ghost" disabled={busy || !a.full} onClick={() => run({ mode: "none" })}>Remove access</Button>
          </div>
        </div>
      ) : <p className="mt-4 text-xs text-muted">Only the site owner can change access.</p>}
    </Panel>
  );
}

function OfferPanel({ l, onSave }: { l: Detail; onSave: (o: Parameters<typeof adminApi.setLearnerOffer>[1]) => Promise<unknown> }) {
  const { isOwner } = useAdmin();
  const paid = courses.filter((c) => c.price && c.price > 0);
  const [kind, setKind] = useState<"price" | "percent">(l.offer?.kind ?? "percent");
  const [value, setValue] = useState(String(l.offer?.value ?? 20));
  const [courseId, setCourseId] = useState(l.offer?.courseId ?? "");
  const [note, setNote] = useState(l.offer?.note ?? "");
  const [expires, setExpires] = useState(l.offer?.expiresAt ? l.offer.expiresAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ kind, value: Number(value), courseId: courseId || null, note, expiresAt: expires || null });
    } finally {
      setBusy(false);
    }
  };
  const preview = paid.filter((c) => !courseId || c.id === courseId).map((c) => {
    const p = c.price!;
    const v = Number(value) || 0;
    const after = Math.max(1, Math.min(p, Math.round(kind === "price" ? v : p * (1 - Math.min(100, v) / 100))));
    return `${c.title}: ${formatPrice(p)} → ${formatPrice(after)}`;
  });
  return (
    <Panel title="Special offer">
      {l.offer ? (
        <p className={cn("mb-4 flex items-center gap-2 rounded-xl p-3 text-sm", l.offerActive ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-700")}>
          <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
          {l.offer.kind === "percent" ? `${l.offer.value}% off` : `Price ₹${l.offer.value}`} on {l.offer.courseId ? courses.find((c) => c.id === l.offer!.courseId)?.title ?? l.offer.courseId : "every paid course"}
          {l.offer.expiresAt ? `, until ${formatDate(l.offer.expiresAt)}` : ""}{l.offerActive ? "" : " (expired)"}
        </p>
      ) : <p className="mb-4 text-sm text-muted">No offer. The learner sees it on the buy button and pays the offer price.</p>}
      {isOwner ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="font-semibold">Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as "price" | "percent")} className={cn(inputClass, "mt-1")}>
                <option value="percent">Percent off</option>
                <option value="price">Fixed price (₹)</option>
              </select>
            </label>
            <label className="text-sm"><span className="font-semibold">{kind === "percent" ? "Discount %" : "Price in ₹"}</span>
              <input type="number" min={1} max={kind === "percent" ? 100 : undefined} value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputClass, "mt-1")} />
            </label>
            <label className="text-sm"><span className="font-semibold">Course</span>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={cn(inputClass, "mt-1")}>
                <option value="">Every paid course</option>
                {paid.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="font-semibold">Ends on (optional)</span>
              <input type="date" min={today()} value={expires} onChange={(e) => setExpires(e.target.value)} className={cn(inputClass, "mt-1")} />
            </label>
          </div>
          <label className="block text-sm"><span className="font-semibold">Message to the learner (optional)</span>
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Diwali special, just for you" className={cn(inputClass, "mt-1")} />
          </label>
          {preview.length > 0 && <p className="text-xs text-muted">{preview.join(" · ")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || !(Number(value) >= 1)}>{l.offer ? "Update offer" : "Give offer"}</Button>
            {l.offer && <Button size="sm" variant="danger-ghost" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(null); } finally { setBusy(false); } }}>Remove offer</Button>}
          </div>
        </form>
      ) : <p className="text-xs text-muted">Only the site owner can give offers.</p>}
    </Panel>
  );
}

/** Admin → Learners → one learner: their details, photo, access, offer, block, note and payments. */
const TIER_LABEL = { paid: "Paid", trial: "Free trial", none: "No access" } as const;

function UsagePanel({ usage }: { usage: UsageSummary }) {
  const period = (p: string) => (p === "day" ? "today" : p === "trial" ? "in the free trial" : "");
  const line = (used: string, limit: string | null, p: string) => (limit === null ? `${used} ${period(p)} · no limit` : `${used} of ${limit} ${period(p)}`);
  return (
    <Panel title="Usage">
      <dl className="divide-y divide-line">
        <Row label="Plan">{TIER_LABEL[usage.tier]}{usage.tier === "trial" && usage.freeLessons !== null ? ` · first ${usage.freeLessons} lesson${usage.freeLessons === 1 ? "" : "s"} of each course` : ""}</Row>
        <Row label="AI chat messages">{line(String(usage.ai.used), usage.ai.limit === null ? null : String(usage.ai.limit), usage.ai.period)}</Row>
        <Row label="Live call time">{line(formatDuration(usage.call.used), usage.call.limit === null ? null : formatDuration(usage.call.limit), usage.call.period)}</Row>
      </dl>
      <p className="mt-2 text-xs text-muted">Change the allowances in Learners → Free trial and limits.</p>
    </Panel>
  );
}

const OUTCOME_LABEL: Record<CallLogEntry["outcome"], string> = {
  completed: "Completed", "no-answer": "No answer", declined: "Declined", missed: "Missed", cancelled: "Cancelled", limit: "Minutes ran out", dropped: "Connection lost",
};
const DIRECTION_LABEL: Record<CallLogEntry["direction"], string> = { outgoing: "Outgoing", incoming: "Incoming", room: "Team room" };

function CallsPanel({ calls }: { calls?: CallLogEntry[] }) {
  const total = (calls ?? []).reduce((s, c) => s + c.talkSeconds, 0);
  return (
    <Panel title={`Call history${calls?.length ? ` · ${formatDuration(total)} talked` : ""}`}>
      {calls?.length ? (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="px-1 py-2 font-medium">When</th><th className="px-1 py-2 font-medium">With</th><th className="px-1 py-2 font-medium">Type</th><th className="px-1 py-2 font-medium">Result</th><th className="px-1 py-2 text-right font-medium">Duration</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-1 py-2">{formatDateTime(c.startedAt)}</td>
                  <td className="px-1 py-2"><span className="line-clamp-1">{c.withNames || c.roomName}</span></td>
                  <td className="whitespace-nowrap px-1 py-2 text-muted">{DIRECTION_LABEL[c.direction]}</td>
                  <td className="whitespace-nowrap px-1 py-2">{OUTCOME_LABEL[c.outcome]}</td>
                  <td className="whitespace-nowrap px-1 py-2 text-right font-mono tabular-nums">{c.talkSeconds ? formatDuration(c.talkSeconds) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-muted">No live calls yet.</p>}
    </Panel>
  );
}

export default function LearnerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOwner, toast } = useAdmin();
  const { data: l, setData, error, reload } = useLoad(() => adminApi.getLearner(id), [id]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!l) return <Loading />;

  const act = async (fn: () => Promise<Detail>, done: string): Promise<boolean> => {
    try {
      setData(await fn());
      toast(done);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
      return false;
    }
  };
  const filled = PROFILE_LABELS.filter(([k]) => l.profile[k]);

  return (
    <>
      <Link to="/admin/learners" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All learners</Link>

      <div className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-white p-5 shadow-card">
        {l.avatarUrl ? (
          <a href={l.avatarUrl} target="_blank" rel="noreferrer" title="Open photo"><UserAvatar user={l} className="h-20 w-20 text-xl" /></a>
        ) : <UserAvatar user={l} className="h-20 w-20 text-xl" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{l.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-ink-900"><Mail className="h-4 w-4" aria-hidden="true" />{l.email}</a>
            {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-ink-900"><Phone className="h-4 w-4" aria-hidden="true" />{l.phone}</a>}
          </p>
          <p className="mt-1 text-xs text-muted">Joined {formatDateTime(l.createdAt)} · Last login {l.lastLoginAt ? formatDateTime(l.lastLoginAt) : "never"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AccessPill access={l.access} />
          {isOwner && (l.active ? (
            <Button size="sm" variant="danger-ghost" onClick={() => { setReason(""); setBlockOpen(true); }}><Ban className="h-4 w-4" aria-hidden="true" /> Block</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => act(() => adminApi.setLearnerBlocked(l.id, false), "Learner unblocked")}><Unlock className="h-4 w-4" aria-hidden="true" /> Unblock</Button>
          ))}
        </div>
      </div>
      {!l.active && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <ShieldCheck className="mr-1.5 inline h-4 w-4" aria-hidden="true" />Blocked: this learner cannot log in{l.blockedReason ? `. Reason: ${l.blockedReason}` : "."}
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <AccessPanel l={l} onChange={(c) => act(() => adminApi.setLearnerAccess(l.id, c), "Access updated")} />
          <OfferPanel l={l} onSave={(o) => act(() => adminApi.setLearnerOffer(l.id, o), o ? "Offer saved" : "Offer removed")} />
          {l.usage && <UsagePanel usage={l.usage} />}
        </div>
        <div className="space-y-6">
          <Panel title="Personal details">
            {filled.length ? (
              <dl className="divide-y divide-line">{filled.map(([k, label]) => <Row key={k} label={label}>{l.profile[k]}</Row>)}</dl>
            ) : <p className="text-sm text-muted">The learner hasn't filled in their profile yet.</p>}
          </Panel>
          <Panel title="Payments">
            {l.orders.length ? (
              <ul className="divide-y divide-line">
                {l.orders.map((o) => (
                  <li key={o.orderId} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-medium">{o.courseTitle}</span><span className="block text-xs text-muted">{formatDateTime(o.paidAt ?? o.createdAt)} · {o.orderId}</span></span>
                    <span className="tabular-nums">{formatPrice(o.amount)}</span>
                    <StatusPill status={o.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No orders yet.</p>}
          </Panel>
          <Panel title="Private note">
            <textarea value={note ?? l.adminNote ?? ""} onChange={(e) => setNote(e.target.value)} disabled={!isOwner} rows={4} placeholder="Only admins see this." className={cn(inputClass, "resize-y")} />
            {isOwner && note !== null && note !== (l.adminNote ?? "") && (
              <Button size="sm" className="mt-2" onClick={() => act(() => adminApi.saveLearnerNote(l.id, note), "Note saved").then((ok) => ok && setNote(null))}>Save note</Button>
            )}
          </Panel>
          {isOwner && (
            <Panel title="Delete account">
              <p className="text-sm text-muted">Removes the login, profile and photo. Their orders stay in Orders & payments.</p>
              <Button size="sm" variant="danger-ghost" className="mt-3" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete learner</Button>
            </Panel>
          )}
        </div>
      </div>

      <div className="mt-6"><CallsPanel calls={l.calls} /></div>

      <Confirm open={blockOpen} title={`Block ${l.name}?`} confirmLabel="Block learner" onClose={() => setBlockOpen(false)}
        body="They are signed out on every device straight away and can't log in until you unblock them."
        onConfirm={async () => { await act(() => adminApi.setLearnerBlocked(l.id, true, reason), "Learner blocked"); setBlockOpen(false); }}>
        <label className="mt-4 block text-sm"><span className="font-semibold">Reason (shown to them when they try to log in)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1")} placeholder="Optional" />
        </label>
      </Confirm>
      <Confirm open={deleteOpen} title={`Delete ${l.name}?`} confirmLabel="Delete" onClose={() => setDeleteOpen(false)}
        body="This can't be undone."
        onConfirm={async () => {
          try {
            await adminApi.deleteLearner(l.id);
            toast("Learner deleted");
            navigate("/admin/learners");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Could not delete.", "error");
          }
        }} />
    </>
  );
}
