import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Search, Tag } from "lucide-react";
import { adminApi, type AccessSettings, type LearnerSummary } from "../api";
import { useAdmin } from "../AdminContext";
import { Empty, ErrorNote, Loading, PageTitle, Panel, TableWrap, Td, Th, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { UserAvatar } from "../../portal/Avatar";
import { formatDate, timeLeft } from "../../utils/access";
import { formatPrice } from "../../utils/format";
import { cn } from "../../utils/cn";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "trial", label: "On free trial" },
  { id: "access", label: "Has access" },
  { id: "expired", label: "Trial ended" },
  { id: "buyers", label: "Bought a course" },
  { id: "offer", label: "Special offer" },
  { id: "blocked", label: "Blocked" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const matches = (l: LearnerSummary, f: Filter) =>
  f === "all" ? true
    : f === "trial" ? l.access.status === "trial"
    : f === "access" ? l.access.status === "active" || l.access.status === "unlimited"
    : f === "expired" ? l.access.status === "expired"
    : f === "buyers" ? l.paidOrders > 0
    : f === "offer" ? l.offerActive
    : l.access.status === "blocked";

export function AccessPill({ access }: { access: LearnerSummary["access"] }) {
  const map = {
    trial: { c: "bg-amber-50 text-amber-800 ring-amber-200", label: `Trial · ${timeLeft(access.until)} left` },
    active: { c: "bg-emerald-50 text-emerald-800 ring-emerald-200", label: `Access until ${formatDate(access.until)}` },
    unlimited: { c: "bg-emerald-50 text-emerald-800 ring-emerald-200", label: "Unlimited access" },
    expired: { c: "bg-slate-100 text-slate-700 ring-slate-200", label: access.trialEndsAt ? "Trial ended" : "No access" },
    blocked: { c: "bg-red-50 text-red-800 ring-red-200", label: "Blocked" },
  } as const;
  const m = map[access.status];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", m.c)}>{m.label}</span>;
}

function TrialSettings() {
  const { isOwner, toast } = useAdmin();
  const [s, setS] = useState<AccessSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    adminApi.getAccessSettings().then(setS).catch(() => undefined);
  }, []);
  if (!s) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      setS(await adminApi.saveAccessSettings(s));
      toast("Free trial settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Panel title="Free trial for new sign-ups" className="mb-6">
      <form onSubmit={save} className="flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="font-semibold">Trial length (hours)</span>
          <input type="number" min={0} max={2160} value={s.trialHours} disabled={!isOwner} onChange={(e) => setS({ ...s, trialHours: Number(e.target.value) })} className={cn(inputClass, "mt-1 w-32")} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={s.aiForBuyers} disabled={!isOwner} onChange={(e) => setS({ ...s, aiForBuyers: e.target.checked })} className="h-4 w-4" />
          Learners who bought any course can also use Speak with AI
        </label>
        {isOwner && <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
      </form>
      <p className="mt-3 text-xs text-muted">
        During the trial every course and Speak with AI are open. Afterwards learners see the buy screen for paid courses. 0 turns the trial off. Applies to new sign-ups; change one learner's access on their page.
      </p>
    </Panel>
  );
}

/** Admin → Learners: every student account with their access, offers and purchases. */
export default function Learners() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, reload } = useLoad(() => adminApi.listLearners(), []);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((l) => matches(l, filter) && (!needle || [l.name, l.email, l.phone ?? "", l.profile.city ?? ""].some((v) => v.toLowerCase().includes(needle))));
  }, [data, q, filter]);

  return (
    <>
      <PageTitle title="Learners" description="Everyone who signed up on the website: their details, access, offers and payments." />
      <TrialSettings />
      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search learners</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or city" className={cn(inputClass, "pl-9")} />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold", filter === f.id ? "bg-ink-900 text-white" : "bg-white text-ink-800 ring-1 ring-line hover:bg-ink-50")}>
                  {f.label} <span className="opacity-60">{data.filter((l) => matches(l, f.id)).length}</span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? <Empty>{data.length ? "No learners match." : "No one has signed up yet."}</Empty> : (
            <TableWrap>
              <thead className="bg-ink-50/50"><tr><Th>Learner</Th><Th>Phone</Th><Th>Joined</Th><Th>Access</Th><Th className="text-right">Paid</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50/40">
                    <Td>
                      <Link to={`/admin/learners/${l.id}`} className="flex items-center gap-3">
                        <UserAvatar user={l} className="h-9 w-9 text-xs" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink-900 hover:underline">{l.name}</span>
                          <span className="block text-xs text-muted">{l.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{l.phone || <span className="text-muted">—</span>}</Td>
                    <Td className="whitespace-nowrap">{formatDate(l.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AccessPill access={l.access} />
                        {l.offerActive && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Tag className="h-3 w-3" aria-hidden="true" />Offer</span>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">{l.paidOrders ? `${formatPrice(l.totalSpent)} · ${l.paidOrders}` : <span className="text-muted">—</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </>
      )}
    </>
  );
}
