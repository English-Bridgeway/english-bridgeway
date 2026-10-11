import { useState, type FormEvent } from "react";
import { adminApi } from "../api";
import { useAdmin } from "../AdminContext";
import { PageTitle, Panel, StatusPill, inputClass } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { resetDemoDb } from "../../utils/demoStore";

export default function Account() {
  const { admin, toast, signOut } = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await adminApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast("Password changed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    }
  };

  return (
    <>
      <PageTitle title="My account" />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Profile">
          <p className="font-semibold">{admin?.name}</p>
          <p className="text-sm text-muted">{admin?.email}</p>
          <div className="mt-2"><StatusPill status={admin?.role ?? "editor"} /></div>
        </Panel>
        <Panel title="Change password">
          <form onSubmit={submit} className="grid gap-4 sm:max-w-sm">
            <div>
              <label htmlFor="pw-current" className="mb-1.5 block text-sm font-semibold">Current password</label>
              <input id="pw-current" type="password" autoComplete="current-password" className={inputClass} required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pw-next" className="mb-1.5 block text-sm font-semibold">New password</label>
              <input id="pw-next" type="password" autoComplete="new-password" minLength={10} className={inputClass} required value={next} onChange={(e) => setNext(e.target.value)} />
              <p className="mt-1 text-xs text-muted">At least 10 characters.</p>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" className="justify-self-start">Change password</Button>
          </form>
        </Panel>
        {adminApi.mode === "demo" && (
          <Panel title="Demo data">
            <p className="text-sm text-muted">Put all content, orders, messages and settings back to how they started.</p>
            <Button variant="outline" className="mt-3" onClick={() => { resetDemoDb(); signOut(); }}>Reset demo data</Button>
          </Panel>
        )}
      </div>
    </>
  );
}
