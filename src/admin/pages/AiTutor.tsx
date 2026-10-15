import { Link } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { Bot, CircleCheck, CircleX, ExternalLink, PlugZap } from "lucide-react";
import { adminApi, type AiSettings } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { cn } from "../../utils/cn";

// OpenAI-compatible providers. Model names change over time; check the provider's model list.
const PRESETS = [
  { name: "Groq (free tier)", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant", keys: "https://console.groq.com/keys" },
  { name: "Google Gemini (free tier)", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", keys: "https://aistudio.google.com/apikey" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", keys: "https://openrouter.ai/keys" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", keys: "https://platform.openai.com/api-keys" },
  { name: "Ollama (your own server)", baseUrl: "http://localhost:11434/v1", model: "llama3.1", keys: "https://ollama.com" },
];

/** Admin → AI tutor: the AI behind "Speak with AI" in the learner portal. Owner only. */
export default function AiTutor() {
  const { toast } = useAdmin();
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [form, setForm] = useState({ enabled: false, baseUrl: "", model: "", apiKey: "", instructions: "", dailyLimit: 200 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const load = (s: AiSettings) => {
    setSaved(s);
    setForm({ enabled: s.enabled, baseUrl: s.baseUrl, model: s.model, apiKey: "", instructions: s.instructions, dailyLimit: s.dailyLimit });
  };
  useEffect(() => {
    adminApi.getAi().then(load).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);
  if (error) return <ErrorNote message={error} />;
  if (!saved) return <Loading />;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.enabled && !form.apiKey.trim() && !saved.apiKeyMasked && !/localhost|127\.0\.0\.1/.test(form.baseUrl)) {
      toast("Add an API key before switching the AI tutor on.", "error");
      return;
    }
    setSaving(true);
    try {
      load(await adminApi.saveAi({ ...form, apiKey: form.apiKey || undefined }));
      setTest(null);
      toast("AI tutor settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };
  const runTest = async () => {
    setTesting(true);
    try {
      setTest(await adminApi.testAi());
    } catch (err) {
      setTest({ ok: false, message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setTesting(false);
    }
  };
  const preset = PRESETS.find((p) => p.baseUrl === form.baseUrl);

  return (
    <>
      <PageTitle title="AI tutor" description="The AI that learners talk to in Speak with AI. Use a free provider or your own API key." />
      {adminApi.mode === "demo" && (
        <Alert tone="info" className="mb-6" title="Demo mode">The key is kept in this browser and the browser calls the provider directly. On the live site the key stays on the server.</Alert>
      )}
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Provider">
            <label className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 text-sm font-semibold">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-5 w-5" />
              Speak with AI is on
            </label>
            <p className="mt-4 text-sm font-semibold">Quick setup</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => setForm((f) => ({ ...f, baseUrl: p.baseUrl, model: p.model }))}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", form.baseUrl === p.baseUrl ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-800 ring-line hover:bg-ink-50")}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2"><span className="font-semibold">API base URL</span>
                <input value={form.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://api.groq.com/openai/v1" className={cn(inputClass, "mt-1 font-mono")} />
                <span className="mt-1 block text-xs text-muted">Any OpenAI-compatible API. The site calls <code>{form.baseUrl || "…"}/chat/completions</code>.</span>
              </label>
              <label className="text-sm"><span className="font-semibold">Model</span>
                <input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="llama-3.1-8b-instant" className={cn(inputClass, "mt-1 font-mono")} />
              </label>
              <label className="text-sm"><span className="font-semibold">API key</span>
                <input type="password" autoComplete="off" value={form.apiKey} onChange={(e) => set("apiKey", e.target.value)} placeholder={saved.apiKeyMasked ? `Saved: ${saved.apiKeyMasked}` : "Paste your key"} className={cn(inputClass, "mt-1 font-mono")} />
                <span className="mt-1 block text-xs text-muted">{saved.apiKeyMasked ? "Leave empty to keep the saved key." : "Stored encrypted on the server, never shown to learners."}</span>
              </label>
            </div>
            {preset && (
              <a href={preset.keys} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-700 hover:underline">
                Get a {preset.name.replace(/ \(.*\)/, "")} key <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </Panel>
          <Panel title="Tutor behaviour">
            <p className="text-sm text-muted">
              Message limits (free trial and paid per day) are set in <Link to="/admin/learners" className="font-semibold text-ink-700 underline">Learners → Free trial and limits</Link>.
            </p>
            <label className="mt-4 block text-sm"><span className="font-semibold">Extra instructions (optional)</span>
              <textarea rows={4} maxLength={2000} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g. Use British spelling. Mention our Spoken English course when it fits." className={cn(inputClass, "mt-1 resize-y")} />
              <span className="mt-1 block text-xs text-muted">Added to the built-in tutor rules: short spoken replies, gentle corrections, one question at a time.</span>
            </label>
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
            <Button variant="outline" onClick={runTest} disabled={testing}><PlugZap className="h-4 w-4" aria-hidden="true" /> {testing ? "Testing…" : "Test saved settings"}</Button>
          </div>
          {test && (
            <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", test.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900")} role="status">
              {test.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}{test.message}
            </p>
          )}
        </div>
        <aside>
          <Panel title="How to set it up">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Pick a provider above. Groq and Google Gemini have free tiers that are enough to start.</li>
              <li>Create an API key on the provider's site and paste it here.</li>
              <li>Tick <b>Speak with AI is on</b>, save, then press <b>Test saved settings</b>.</li>
              <li>Learners find it in <b>My learning → Speak with AI</b>. They talk with the microphone (Chrome, Edge or Safari) and hear replies in the site's Listen voice.</li>
            </ol>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Bot className="h-4 w-4 shrink-0" aria-hidden="true" /> Who can use it is set in Learners: everyone on a free trial or with access, and optionally anyone who bought a course.</p>
          </Panel>
        </aside>
      </form>
    </>
  );
}
