import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { safeNext } from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { AccountError } from "../../utils/account";

export default function Register() {
  const { signUp, isAuthenticated } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const next = safeNext(search);
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<typeof v>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  if (isAuthenticated && !busy) return <Navigate to={next} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<typeof v> = {};
    if (v.name.trim().length < 2) er.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) er.email = "Enter a valid email address.";
    if (v.password.length < 8) er.password = "Use at least 8 characters.";
    setErrors(er);
    setFailure(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await signUp(v.name, v.email, v.password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof AccountError && err.field) setErrors({ [err.field]: err.message });
      else setFailure(err instanceof Error ? err.message : "Could not create the account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your free account" subtitle="Buy courses, track your progress and practise speaking live with other learners." footer={<>Already have an account? <Link to={`/login${search}`} className="font-semibold text-ink-700">Log in</Link></>}>
      {failure && <Alert tone="error" className="mb-5">{failure}</Alert>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField id="reg-name" label="Full name" autoComplete="name" value={v.name} onChange={set("name")} error={errors.name} />
        <TextField id="reg-email" label="Email" type="email" autoComplete="email" value={v.email} onChange={set("email")} error={errors.email} />
        <TextField id="reg-password" label="Password" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}
