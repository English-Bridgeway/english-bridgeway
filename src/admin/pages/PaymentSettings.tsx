import { useEffect, useState, type FormEvent } from "react";
import { CircleCheck, CircleX, Copy, ExternalLink, PlugZap } from "lucide-react";
import { adminApi, type PaymentSettings } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";

export default function PaymentSettingsPage() {
  const { toast } = useAdmin();
  const [saved, setSaved] = useState<PaymentSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"sandbox" | "production">("sandbox");
  const [appId, setAppId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = (p: PaymentSettings) => {
    setSaved(p);
    setEnabled(p.enabled);
    setMode(p.mode);
    setAppId(p.appId);
    setSecretKey("");
  };

  useEffect(() => {
    adminApi.getPayments().then(load).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!saved) return <Loading />;

  const demo = adminApi.mode === "demo";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (enabled && !demo && (!appId.trim() || (!secretKey.trim() && !saved.secretKeyMasked))) {
      toast("Add the App ID and Secret key before turning payments on.", "error");
      return;
    }
    setSaving(true);
    try {
      load(await adminApi.savePayments({ enabled, mode, appId, secretKey: secretKey || undefined }));
      setTest(null);
      toast("Payment settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      setTest(await adminApi.testPayments());
    } catch (err) {
      setTest({ ok: false, message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageTitle title="Payment gateway" description="Cashfree takes course payments by UPI, cards, net banking and wallets." actions={<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>} />
      {demo && (
        <Alert tone="info" title="Demo mode" className="mb-6">
          Checkout is simulated in this preview, so no keys are needed. On the live site (API server connected), enter your Cashfree keys here.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Status">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-ink-700" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className="text-sm"><span className="font-semibold">Accept online payments</span><br /><span className="text-muted">When off, paid courses show “Contact us to enrol” instead of a Buy button.</span></span>
            </label>
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">Mode</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["sandbox", "production"] as const).map((m) => (
                  <label key={m} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${mode === m ? "border-ink-500 bg-ink-50" : "border-line"}`}>
                    <input type="radio" name="mode" className="mt-0.5 accent-ink-700" checked={mode === m} onChange={() => setMode(m)} />
                    <span><span className="font-semibold">{m === "sandbox" ? "Test (sandbox)" : "Live (production)"}</span><br /><span className="text-muted">{m === "sandbox" ? "Test cards and UPI. No real money." : "Real payments into your Cashfree account."}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Panel>
          <Panel title="Cashfree API keys">
            <div className="grid gap-4">
              <div>
                <label htmlFor="cf-app" className="mb-1.5 block text-sm font-semibold">App ID (Client ID)</label>
                <input id="cf-app" className={inputClass} value={appId} onChange={(e) => setAppId(e.target.value)} autoComplete="off" spellCheck={false} />
              </div>
              <div>
                <label htmlFor="cf-secret" className="mb-1.5 block text-sm font-semibold">Secret key</label>
                <input id="cf-secret" type="password" className={inputClass} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} autoComplete="new-password" spellCheck={false}
                  placeholder={saved.secretKeyMasked ? `Saved (${saved.secretKeyMasked}). Leave empty to keep it.` : "Paste your secret key"} />
                <p className="mt-1 text-xs text-muted">Stored encrypted on the server and never shown again in full.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={runTest} disabled={testing}><PlugZap className="h-4 w-4" aria-hidden="true" /> {testing ? "Testing…" : "Test saved keys"}</Button>
                {test && (
                  <span className={`inline-flex items-center gap-1.5 text-sm ${test.ok ? "text-emerald-700" : "text-red-700"}`}>
                    {test.ok ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <CircleX className="h-4 w-4" aria-hidden="true" />} {test.message}
                  </span>
                )}
              </div>
            </div>
          </Panel>
        </div>
        <Panel title="Setup steps" className="self-start">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>Sign in to the <a className="font-semibold text-ink-700 underline" href="https://merchant.cashfree.com/" target="_blank" rel="noreferrer">Cashfree dashboard <ExternalLink className="inline h-3 w-3" aria-hidden="true" /></a> and open Developers → API Keys. Use the Test keys with Sandbox mode, and the Live keys with Production mode.</li>
            <li>Paste the App ID and Secret key here, save, then press “Test saved keys”.</li>
            <li>
              In Developers → Webhooks, add this URL for payment events:
              {saved.webhookUrl ? (
                <span className="mt-1.5 flex items-center gap-1 rounded-lg bg-canvas p-2 font-mono text-xs break-all">
                  {saved.webhookUrl}
                  <button type="button" className="ml-auto shrink-0 rounded p-1 hover:bg-white" aria-label="Copy webhook URL" onClick={() => navigator.clipboard?.writeText(saved.webhookUrl!).then(() => toast("Copied"))}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </span>
              ) : <span className="block text-muted">(set API_PUBLIC_URL on the server to show it)</span>}
            </li>
            <li>Give a course a price in Content → Courses. A Buy button appears on its page.</li>
            <li>Test a purchase in Sandbox, then switch to Production.</li>
          </ol>
        </Panel>
      </div>
    </form>
  );
}
