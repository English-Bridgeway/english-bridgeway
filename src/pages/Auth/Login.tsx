import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  usePageMeta({ title: "Log in", description: "Log in to English-Bridgeway to continue your lessons." });
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = "Enter a valid email address.";
    if (password.length < 6) er.password = "Password must be at least 6 characters.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    setNotice(res.message);
  };

  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue learning." footer={<>New to English-Bridgeway? <Link to="/register" className="font-semibold text-ink-700">Create an account</Link></>}>
      {notice && <Alert tone="info" className="mb-5">{notice} <Link to="/dashboard" className="font-semibold underline">Open your dashboard</Link></Alert>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
      </form>
    </AuthCard>
  );
}
