import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useAdmin } from "../AdminContext";
import { adminApi } from "../api";
import { DEMO_ADMIN } from "../../utils/demoStore";
import { site } from "../../data/site";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { TextField } from "../../components/FormField";

export default function AdminLogin() {
  const { signIn } = useAdmin();
  const demo = adminApi.mode === "demo";
  const [email, setEmail] = useState(demo ? DEMO_ADMIN.email : "");
  const [password, setPassword] = useState(demo ? DEMO_ADMIN.password : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-4 py-10">
      <title>{`Admin sign in | ${site.name}`}</title>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-ink-700" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-bold">{site.name} admin</h1>
            <p className="text-xs text-muted">Staff only. Every change is logged.</p>
          </div>
        </div>
        {demo && (
          <Alert tone="info" title="Demo mode">
            No server is connected, so changes are saved in this browser only. The demo login is filled in for you.
          </Alert>
        )}
        <TextField id="admin-email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField id="admin-password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
