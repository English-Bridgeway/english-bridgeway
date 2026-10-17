import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Volume2 } from "lucide-react";
import { adminApi } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { site as defaults, type SiteSettings } from "../../data/site";
import { canSpeak, englishVoices, pickVoice, speak } from "../../utils/speech";

const fields: { key: keyof SiteSettings; label: string; hint?: string; wide?: boolean }[] = [
  { key: "name", label: "Site name", hint: "Shown in the logo, page titles and emails." },
  { key: "tagline", label: "Tagline" },
  { key: "description", label: "Description", hint: "Used by search engines and social previews.", wide: true },
  { key: "url", label: "Website address", hint: "Used for canonical links, sitemap.xml and social previews, e.g. https://englishbridgeway.com (no slash at the end)." },
  { key: "email", label: "Contact email" },
  { key: "whatsapp", label: "WhatsApp number (shown)" },
  { key: "whatsappLink", label: "WhatsApp link", hint: "https://wa.me/91XXXXXXXXXX (country code, no + or spaces). The home page WhatsApp button chats with this number." },
  { key: "whatsappMessage", label: "WhatsApp message", hint: "Pre-filled in the chat when a visitor taps the home page WhatsApp button.", wide: true },
  { key: "location", label: "Location" },
  { key: "hours", label: "Support hours" },
];

const seoFields: { key: keyof SiteSettings["seo"]; label: string; hint?: string; placeholder?: string }[] = [
  { key: "googleVerification", label: "Google Search Console code", hint: "Search Console → Add property → URL prefix → HTML tag.", placeholder: "e.g. AbC123xYz…" },
  { key: "bingVerification", label: "Bing Webmaster code", hint: "Bing Webmaster Tools → Add site → HTML Meta Tag (msvalidate.01)." },
  { key: "ogImage", label: "Default social share image", hint: "Shown when a page is shared on WhatsApp, Facebook or X. 1200 × 630 px.", placeholder: "/og-image.png" },
  { key: "twitter", label: "X (Twitter) handle", placeholder: "@englishbridgeway" },
];

export default function SiteSettingsPage() {
  const { toast } = useAdmin();
  const [value, setValue] = useState<SiteSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState(() => englishVoices());

  useEffect(() => {
    if (!canSpeak()) return;
    const refresh = () => setVoices(englishVoices());
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    const t = setTimeout(refresh, 300);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", refresh); clearTimeout(t); };
  }, []);

  useEffect(() => {
    adminApi.getSite()
      // Saved settings may be missing newer fields; fill them from the defaults.
      .then((s) => setValue({ ...JSON.parse(JSON.stringify(defaults)), ...s, social: { ...defaults.social, ...(s?.social ?? {}) }, voice: { ...defaults.voice, ...(s?.voice ?? {}) }, seo: { ...defaults.seo, ...(s?.seo ?? {}) } }))
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
        <Panel title="Search engines">
          <p className="mb-4 text-sm text-muted">
            Verification codes prove to Google and Bing that you own the site. Paste only the code from the meta tag they give you
            (the part inside <code>content="…"</code>). Each page's own title and description are set on the page in Content.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {seoFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`seo-${f.key}`} className="mb-1.5 block text-sm font-semibold">{f.label}</label>
                <input id={`seo-${f.key}`} className={inputClass} value={value.seo[f.key]} placeholder={f.placeholder} onChange={(e) => set("seo", { ...value.seo, [f.key]: e.target.value.trim() })} />
                {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Sitemap for Search Console: <code>{(value.url || "https://englishbridgeway.com").replace(/\/+$/, "")}/sitemap.xml</code>
          </p>
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
        <Panel title="Listen voice">
          <p className="mb-4 text-sm text-muted">
            The voice used by every Listen button. Automatic picks a friendly female English voice on each visitor's device.
            A named voice is used only on devices that have it; others fall back to Automatic.
          </p>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="voice-name" className="mb-1.5 block text-sm font-semibold">Voice</label>
              <select id="voice-name" className={inputClass} value={value.voice.name} onChange={(e) => set("voice", { ...value.voice, name: e.target.value })}>
                <option value="">Automatic (friendly female voice{voices.length ? `: ${pickVoice("")?.name ?? "browser default"}` : ""})</option>
                {value.voice.name && !voices.some((v) => v.name === value.voice.name) && <option value={value.voice.name}>{value.voice.name} (not on this device)</option>}
                {voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="voice-pitch" className="mb-1.5 block text-sm font-semibold">Pitch {value.voice.pitch.toFixed(2)}</label>
              <input id="voice-pitch" type="range" min="0.8" max="1.6" step="0.05" className="w-full" value={value.voice.pitch} onChange={(e) => set("voice", { ...value.voice, pitch: Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="voice-rate" className="mb-1.5 block text-sm font-semibold">Speed {value.voice.rate.toFixed(2)}</label>
              <input id="voice-rate" type="range" min="0.6" max="1.3" step="0.02" className="w-full" value={value.voice.rate} onChange={(e) => set("voice", { ...value.voice, rate: Number(e.target.value) })} />
            </div>
            <Button size="sm" variant="outline" disabled={!canSpeak()} onClick={() => speak("Hello! Welcome to English-Bridgeway. Let's practise speaking English together.", { voiceName: value.voice.name, pitch: value.voice.pitch, rate: value.voice.rate })}>
              <Volume2 className="h-4 w-4" aria-hidden="true" /> Try it
            </Button>
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
