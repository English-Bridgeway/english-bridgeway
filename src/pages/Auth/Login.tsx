import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { safeNext } from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { AccountError } from "../../utils/account";

export default function Login() {
  const { signIn, isAuthenticated } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const next = safeNext(search);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated && !busy) return <Navigate to={next} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) er.email = "Enter a valid email address.";
    if (!password) er.password = "Enter your password.";
    setErrors(er);
    setFailure(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setFailure(err instanceof AccountError || err instanceof Error ? err.message : "Could not log in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue learning." footer={<>New to English-Bridgeway? <Link to={`/register${search}`} className="font-semibold text-ink-700">Create an account</Link></>}>
      {failure && <Alert tone="error" className="mb-5">{failure}</Alert>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
      </form>
    </AuthCard>
  );
}
