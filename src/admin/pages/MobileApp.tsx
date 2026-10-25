import { useState, type FormEvent } from "react";
import { FileUp, Save, Smartphone } from "lucide-react";
import { adminApi, type AppRelease } from "../api";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { formatBytes, formatDateTime } from "../../utils/format";

/** Publish a new APK: phones with an older build show "Update available" on their next start. */
function Publish({ current, onDone }: { current: AppRelease | null; onDone: (r: AppRelease) => void }) {
  const { toast } = useAdmin();
  const [file, setFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [force, setForce] = useState(false);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!file) return setError("Choose the APK file.");
    if (!file.name.toLowerCase().endsWith(".apk")) return setError("The file must be an .apk.");
    const build = Number(buildNumber);
    if (!Number.isInteger(build) || build < 1) return setError("Enter the build number.");
    if (current && build <= current.buildNumber) return setError(`The build number must be higher than ${current.buildNumber}, the build phones have now.`);
    setBusy(true);
    setProgress(0);
    try {
      const release = await adminApi.uploadApk(file, { versionName: versionName.trim(), buildNumber: build, minBuild: force ? build : 0, notes }, setProgress);
      toast(`Version ${release.versionName} published`);
      setFile(null);
      setVersionName("");
      setBuildNumber("");
      setNotes("");
      setForce(false);
      onDone(release);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Panel title="Publish a new version" className="mb-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold sm:col-span-2">
          APK file
          <input type="file" accept=".apk,application/vnd.android.package-archive" className={`${inputClass} mt-1.5 font-normal`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="mt-1 block text-xs font-normal text-muted">
            Download <strong>english-bridgeway-apk</strong> from the GitHub Actions run (Actions → Mobile app), unzip it and choose app-release.apk.
            Use a run signed with the upload key (its summary says so), or phones can't install it over their app.
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Version
          <input className={`${inputClass} mt-1.5 font-normal`} value={versionName} onChange={(e) => setVersionName(e.target.value)} required pattern="\d+(\.\d+){0,3}" placeholder="e.g. 1.0.0" />
          <span className="mt-1 block text-xs font-normal text-muted">Shown to learners. The run summary on GitHub lists it.</span>
        </label>
        <label className="block text-sm font-semibold">
          Build number
          <input className={`${inputClass} mt-1.5 font-normal`} value={buildNumber} onChange={(e) => setBuildNumber(e.target.value.replace(/\D/g, ""))} required inputMode="numeric" placeholder="e.g. 42" />
          <span className="mt-1 block text-xs font-normal text-muted">The GitHub Actions run number (#42). It must match the APK, or phones keep asking to update.</span>
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          What's new <span className="font-normal text-muted">(optional, shown in the update popup)</span>
          <textarea className={`${inputClass} mt-1.5 font-normal`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder={"New dashboard on Home\nAI tutor explains mistakes in Marathi"} />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink-700" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span><span className="font-semibold">Required update</span> <span className="text-muted">(older versions can't be used until they update; use it only when the old app stops working)</span></span>
        </label>
        {progress !== null && (
          <div className="sm:col-span-2" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-ink-50"><div className="h-full bg-brand-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-muted">Uploading the APK… {Math.round(progress * 100)}%</p>
          </div>
        )}
        {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}><FileUp className="h-4 w-4" aria-hidden="true" /> {busy ? "Publishing…" : "Publish update"}</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Change the popup text or make the published version required, without a new upload. */
function Current({ release, onDone }: { release: AppRelease; onDone: (r: AppRelease) => void }) {
  const { toast } = useAdmin();
  const [notes, setNotes] = useState(release.notes);
  const [force, setForce] = useState(release.minBuild >= release.buildNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await adminApi.updateAppRelease({ notes, minBuild: force ? release.buildNumber : 0 }));
      toast("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Published version" className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-700"><Smartphone className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <p className="font-semibold">Version {release.versionName} <span className="font-normal text-muted">(build {release.buildNumber})</span></p>
          <p className="text-xs text-muted">{formatBytes(release.fileSize)} · published {formatDateTime(release.uploadedAt)}</p>
        </div>
      </div>
      <form onSubmit={save} className="grid gap-4">
        <label className="block text-sm font-semibold">
          What's new
          <textarea className={`${inputClass} mt-1.5 font-normal`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink-700" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span><span className="font-semibold">Required update</span> <span className="text-muted">(phones on an older build must update before using the app)</span></span>
        </label>
        {error && <ErrorNote message={error} />}
        <div><Button type="submit" variant="outline" disabled={busy}><Save className="h-4 w-4" aria-hidden="true" /> {busy ? "Saving…" : "Save"}</Button></div>
      </form>
    </Panel>
  );
}

/** Admin → Mobile app: the APK that phones outside Google Play update to. */
export default function MobileAppPage() {
  // Wrapped, so "no version yet" (null) isn't mistaken for "still loading".
  const loaded = useLoad(() => adminApi.getAppRelease().then((release) => ({ release })));
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />;
  if (!loaded.data) return <Loading />;
  const current = loaded.data.release;
  const done = (r: AppRelease) => loaded.setData({ release: r });
  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Mobile app"
        description="Learners who installed the APK see an “Update available” popup when you publish a newer build here. Google Play installs update through the Play Store."
      />
      {adminApi.mode === "demo" && (
        <Alert tone="warning" title="Demo mode" className="mb-6">The APK is stored on the server, so publishing needs the live site (VITE_API_BASE).</Alert>
      )}
      {current ? <Current key={current.buildNumber} release={current} onDone={done} /> : (
        <Alert tone="info" title="No version published yet" className="mb-6">Phones won't see an update until you publish the first APK.</Alert>
      )}
      <Publish current={current} onDone={done} />
    </div>
  );
}
