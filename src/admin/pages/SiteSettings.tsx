import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminApi } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { site as defaults, type SiteSettings } from "../../data/site";

const fields: { key: keyof SiteSettings; label: string; hint?: string; wide?: boolean }[] = [
  { key: "name", label: "Site name", hint: "Shown in the logo, page titles and emails." },
  { key: "tagline", label: "Tagline" },
  { key: "description", label: "Description", hint: "Used by search engines and social previews.", wide: true },
  { key: "url", label: "Website address", hint: "e.g. https://www.englishbridgeway.com" },
  { key: "email", label: "Contact email" },
  { key: "whatsapp", label: "WhatsApp number (shown)" },
  { key: "whatsappLink", label: "WhatsApp link", hint: "https://wa.me/91XXXXXXXXXX" },
  { key: "location", label: "Location" },
  { key: "hours", label: "Support hours" },
];

export default function SiteSettingsPage() {
  const { toast } = useAdmin();
  const [value, setValue] = useState<SiteSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getSite()
      // Saved settings may be missing newer fields; fill them from the defaults.
      .then((s) => setValue({ ...JSON.parse(JSON.stringify(defaults)), ...s, social: { ...defaults.social, ...(s?.social ?? {}) } }))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!value) return <Loading />;

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setValue({ ...value, [k]: v });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.saveSite(value);
      toast("Site settings saved. Visitors see them on their next visit.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageTitle title="Site settings" description="Name, contact details, social links and home-page numbers." actions={<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>} />
      <div className="space-y-6">
        <Panel title="General and contact">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                <label htmlFor={`site-${f.key}`} className="mb-1.5 block text-sm font-semibold">{f.label}</label>
                {f.wide
                  ? <textarea id={`site-${f.key}`} className={`${inputClass} min-h-20`} value={String(value[f.key])} onChange={(e) => set(f.key, e.target.value as never)} />
                  : <input id={`site-${f.key}`} className={inputClass} value={String(value[f.key])} onChange={(e) => set(f.key, e.target.value as never)} required={f.key === "name"} />}
                {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Social links">
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(value.social) as (keyof SiteSettings["social"])[]).map((k) => (
              <div key={k}>
                <label htmlFor={`social-${k}`} className="mb-1.5 block text-sm font-semibold capitalize">{k}</label>
                <input id={`social-${k}`} type="url" className={inputClass} value={value.social[k]} onChange={(e) => set("social", { ...value.social, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Home page numbers" actions={<Button size="sm" variant="outline" onClick={() => set("stats", [...value.stats, { label: "", value: "", icon: "Star" }])}><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>}>
          <div className="space-y-3">
            {value.stats.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                {(["value", "label", "icon"] as const).map((k) => (
                  <div key={k}>
                    <label htmlFor={`stat-${i}-${k}`} className="mb-1 block text-xs font-semibold capitalize text-muted">{k === "icon" ? "Icon (Lucide name)" : k}</label>
                    <input id={`stat-${i}-${k}`} className={inputClass} value={s[k]} onChange={(e) => set("stats", value.stats.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                  </div>
                ))}
                <button type="button" onClick={() => set("stats", value.stats.filter((_, j) => j !== i))} className="grid h-10 w-10 place-items-center rounded-lg text-red-700 hover:bg-red-50" aria-label={`Remove ${s.label || "number"}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </form>
  );
}
