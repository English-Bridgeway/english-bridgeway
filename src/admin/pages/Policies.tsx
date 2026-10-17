import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { adminApi } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button, buttonClasses } from "../../components/Button";
import { getBundledContent } from "../../data/content";
import { policyPages, type BusinessDetails, type Policies, type PolicyKey } from "../../data/policies";

const defaults = getBundledContent().policies!;

const businessFields: { key: keyof BusinessDetails; label: string; hint: string; wide?: boolean }[] = [
  { key: "legalName", label: "Legal business name", hint: "Exactly as registered with Cashfree and on your bank account, e.g. “English Bridgeway” or the proprietor's name. Empty uses the site name." },
  { key: "email", label: "Support email", hint: "Empty uses the contact email from Site settings." },
  { key: "phone", label: "Support phone", hint: "With country code, e.g. +91 98765 43210. Empty uses the WhatsApp number." },
  { key: "gstin", label: "GSTIN (optional)", hint: "Shown on the Contact page when filled." },
  { key: "jurisdiction", label: "City for legal disputes", hint: "Used in the Terms, e.g. Pune. Empty uses the first part of the location." },
  { key: "address", label: "Registered address", hint: "Full postal address with PIN code. Empty uses the location from Site settings.", wide: true },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Saved values over the defaults, so the form always shows the text visitors see. */
function withDefaults(saved: Partial<Policies>): Policies {
  const doc = (k: PolicyKey) => {
    const d = saved[k];
    return d?.body?.trim() ? { title: d.title?.trim() || defaults[k].title, updated: d.updated || defaults[k].updated, body: d.body } : { ...defaults[k] };
  };
  return {
    business: { ...defaults.business, ...(saved.business ?? {}) },
    pricingNote: saved.pricingNote ?? defaults.pricingNote,
    terms: doc("terms"),
    refunds: doc("refunds"),
    privacy: doc("privacy"),
  };
}

export default function PoliciesPage() {
  const { toast } = useAdmin();
  const [value, setValue] = useState<Policies | null>(null);
  const [loaded, setLoaded] = useState<Policies | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getPolicies()
      .then((p) => { const v = withDefaults(p ?? {}); setValue(v); setLoaded(v); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!value || !loaded) return <Loading />;

  const setBusiness = (k: keyof BusinessDetails, v: string) => setValue({ ...value, business: { ...value.business, [k]: v } });
  const setDoc = (k: PolicyKey, patch: Partial<Policies[PolicyKey]>) => setValue({ ...value, [k]: { ...value[k], ...patch } });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = { ...value };
      for (const { key } of policyPages) {
        const doc = value[key];
        // An edited text gets today's date; text left as the default is stored blank, so it follows future default wording.
        const changed = doc.body !== loaded[key].body || doc.title !== loaded[key].title;
        const updated = changed && doc.updated === loaded[key].updated ? today() : doc.updated;
        next[key] = doc.body.trim() === defaults[key].body.trim() && doc.title === defaults[key].title ? { title: "", updated: "", body: "" } : { ...doc, updated };
      }
      await adminApi.savePolicies(next);
      const shown = withDefaults(next);
      setValue(shown);
      setLoaded(shown);
      toast("Policies saved. Visitors see them on their next visit.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageTitle
        title="Policies & business"
        description="Business details and the Terms, Refunds and Privacy pages. Payment gateways such as Cashfree check these before approving the website."
        actions={<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
      />
      <div className="space-y-6">
        <Panel title="Business details">
          <p className="mb-4 text-sm text-muted">Shown on the Contact page and filled into every policy page wherever the text says {"{business}"}, {"{address}"}, {"{email}"}, {"{phone}"} or {"{jurisdiction}"}.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {businessFields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                <label htmlFor={`biz-${f.key}`} className="mb-1.5 block text-sm font-semibold">{f.label}</label>
                {f.wide
                  ? <textarea id={`biz-${f.key}`} className={`${inputClass} min-h-20`} value={value.business[f.key]} onChange={(e) => setBusiness(f.key, e.target.value)} />
                  : <input id={`biz-${f.key}`} className={inputClass} value={value.business[f.key]} onChange={(e) => setBusiness(f.key, e.target.value)} />}
                <p className="mt-1 text-xs text-muted">{f.hint}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pricing page">
          <label htmlFor="pricing-note" className="mb-1.5 block text-sm font-semibold">Note under the prices</label>
          <textarea id="pricing-note" className={`${inputClass} min-h-16`} value={value.pricingNote} onChange={(e) => setValue({ ...value, pricingNote: e.target.value })} />
          <p className="mt-1 text-xs text-muted">Course prices are set on each course (Content → Courses) and plan prices in Subscription plans.</p>
        </Panel>

        {policyPages.map(({ key, path, label }) => {
          const doc = value[key];
          const isDefault = doc.body.trim() === defaults[key].body.trim();
          return (
            <Panel
              key={key}
              title={label}
              actions={
                <div className="flex flex-wrap gap-2">
                  <a href={path} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "sm")}><ExternalLink className="h-4 w-4" aria-hidden="true" /> View page</a>
                  {!isDefault && (
                    <Button size="sm" variant="outline" onClick={() => setDoc(key, { ...defaults[key] })}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Default wording</Button>
                  )}
                </div>
              }
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                <div>
                  <label htmlFor={`${key}-title`} className="mb-1.5 block text-sm font-semibold">Page title</label>
                  <input id={`${key}-title`} className={inputClass} value={doc.title} onChange={(e) => setDoc(key, { title: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor={`${key}-updated`} className="mb-1.5 block text-sm font-semibold">Last updated</label>
                  <input id={`${key}-updated`} type="date" className={inputClass} value={doc.updated} onChange={(e) => setDoc(key, { updated: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${key}-body`} className="mb-1.5 block text-sm font-semibold">Text</label>
                  <textarea id={`${key}-body`} className={`${inputClass} min-h-96 font-mono text-[13px] leading-relaxed`} value={doc.body} onChange={(e) => setDoc(key, { body: e.target.value })} required />
                  <p className="mt-1 text-xs text-muted">
                    “## ” at the start of a line makes a heading, “- ” a bullet point, and an empty line starts a new paragraph.
                    The date changes to today when you save edited text.
                  </p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </form>
  );
}
