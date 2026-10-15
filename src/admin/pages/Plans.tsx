import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { adminApi, type AdminPlan } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { PLAN_PERIODS } from "../../utils/plans";
import { formatPrice } from "../../utils/format";

const blank = (): AdminPlan => ({ id: "", name: "", description: "", price: 0, months: 1, active: true, highlight: false });

/** Subscription plans: learners pay once and every course is open until the plan ends. */
export default function PlansPage() {
  const { toast } = useAdmin();
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getPlans().then(setPlans).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!plans) return <Loading />;

  const update = (i: number, patch: Partial<AdminPlan>) => setPlans(plans.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...plans];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setPlans(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      setPlans(await adminApi.savePlans(plans));
      toast("Plans saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageTitle
        title="Subscription plans"
        description="Learners pay once and every course and Speak with AI open until the plan ends. Single courses can still be bought on their own."
        actions={<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
      />
      <Alert tone="info" title="How plans work" className="mb-6">
        A paid plan moves the learner's access end date forward (from today, or from their current end date if it is later), the same date you can set by hand in Learners.
        It does not renew by itself. Refunding a plan order takes the months back off. A learner's “% off any course” offer also applies to plans.
        Payments go through the Cashfree account in Payment gateway, which must be switched on.
      </Alert>

      {plans.length === 0 && (
        <p className="mb-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No plans yet, so learners only see “Buy this course”. Add a plan to show “Subscribe” on course pages and in the learner portal.
        </p>
      )}

      <div className="space-y-4">
        {plans.map((p, i) => (
          <Panel
            key={i}
            title={p.name || "New plan"}
            actions={
              <div className="flex items-center gap-1">
                <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-ink-50 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-ink-50 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === plans.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-red-700 hover:bg-red-50" onClick={() => setPlans(plans.filter((_, j) => j !== i))} aria-label={`Delete ${p.name || "plan"}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-semibold sm:col-span-2">
                Name
                <input className={`${inputClass} mt-1.5 font-normal`} value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Monthly" required maxLength={60} />
              </label>
              <label className="block text-sm font-semibold">
                Duration
                <select className={`${inputClass} mt-1.5 font-normal`} value={p.months} onChange={(e) => update(i, { months: Number(e.target.value) })}>
                  {PLAN_PERIODS.map((o) => <option key={o.months} value={o.months}>{o.label} ({o.months === 12 ? "12 months" : `${o.months} month${o.months > 1 ? "s" : ""}`})</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Price (₹)
                <input type="number" min={1} step={1} className={`${inputClass} mt-1.5 font-normal`} value={p.price || ""} onChange={(e) => update(i, { price: Number(e.target.value) })} required />
                {p.price > 0 && p.months > 1 && <span className="mt-1 block text-xs font-normal text-muted">{formatPrice(Math.round(p.price / p.months))} a month</span>}
              </label>
              <label className="block text-sm font-semibold sm:col-span-2 lg:col-span-4">
                Description <span className="font-normal text-muted">(optional)</span>
                <input className={`${inputClass} mt-1.5 font-normal`} value={p.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="e.g. Save 30% compared with monthly" maxLength={300} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-ink-700" checked={p.active} onChange={(e) => update(i, { active: e.target.checked })} />
                <span><span className="font-semibold">On sale</span> <span className="text-muted">(learners can buy it)</span></span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-ink-700" checked={p.highlight} onChange={(e) => update(i, { highlight: e.target.checked })} />
                <span><span className="font-semibold">Best value</span> <span className="text-muted">badge</span></span>
              </label>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPlans([...plans, blank()])}><Plus className="h-4 w-4" aria-hidden="true" /> Add plan</Button>
        {plans.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPlans([
              { ...blank(), name: "Monthly", price: 299, months: 1 },
              { ...blank(), name: "Quarterly", price: 799, months: 3, description: "Save about 10% compared with monthly" },
              { ...blank(), name: "Yearly", price: 2499, months: 12, highlight: true, description: "Best value: about ₹208 a month" },
            ])}
          >
            Start with example plans
          </Button>
        )}
      </div>
    </form>
  );
}
