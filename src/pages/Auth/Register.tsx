import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  usePageMeta({ title: "Create your account", description: "Create a free English-Bridgeway account to save progress across devices." });
  const { signUp } = useAuth();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<typeof v>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<typeof v> = {};
    if (v.name.trim().length < 2) er.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) er.email = "Enter a valid email address.";
    if (v.password.length < 8) er.password = "Use at least 8 characters.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const res = await signUp(v.name, v.email, v.password);
    setBusy(false);
    setNotice(res.message);
  };

  return (
    <AuthCard title="Create your free account" subtitle="Save your progress, streak and favourite words." footer={<>Already have an account? <Link to="/login" className="font-semibold text-ink-700">Log in</Link></>}>
      {notice && <Alert tone="info" className="mb-5">{notice} <Link to="/courses/beginner-english" className="font-semibold underline">Start learning now</Link></Alert>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField id="reg-name" label="Full name" autoComplete="name" value={v.name} onChange={set("name")} error={errors.name} />
        <TextField id="reg-email" label="Email" type="email" autoComplete="email" value={v.email} onChange={set("email")} error={errors.email} />
        <TextField id="reg-password" label="Password" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}
