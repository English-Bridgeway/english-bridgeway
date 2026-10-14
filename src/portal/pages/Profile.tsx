import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { SelectField, TextArea, TextField } from "../../components/FormField";
import { UserAvatar } from "../Avatar";
import { AccountError, removeAvatar, shrinkImage, updateProfile, uploadAvatar } from "../../utils/account";
import type { LearnerProfile } from "../../types";

const LEVELS = ["Beginner", "Elementary", "Intermediate", "Upper intermediate", "Advanced"];

/** The learner's photo and personal details. The admin panel shows them under Learners. */
export default function Profile() {
  const { user, token, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profile, setProfile] = useState<LearnerProfile>(user?.profile ?? {});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string; field?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user || !token) return null;

  const field = (k: keyof LearnerProfile) => ({
    value: profile[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setProfile((p) => ({ ...p, [k]: e.target.value })),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      // Every field is sent so cleared ones are removed on the server too.
      const all = Object.fromEntries((["whatsapp", "dateOfBirth", "gender", "city", "state", "country", "occupation", "englishLevel", "goal", "about"] as const).map((k) => [k, profile[k] ?? ""]));
      setUser(await updateProfile(token, { name, phone, profile: all }));
      setMessage({ tone: "success", text: "Your details are saved." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save.", field: err instanceof AccountError ? err.field : undefined });
    } finally {
      setSaving(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      setUser(await uploadAvatar(token, await shrinkImage(file)));
      setMessage({ tone: "success", text: "Your photo is updated." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not upload the photo." });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dropPhoto = async () => {
    setPhotoBusy(true);
    try {
      setUser(await removeAvatar(token));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">My profile</h1>
      <p className="mt-1 text-muted">Your photo and details help your teachers know you. Only you and the site team can see them.</p>

      <section className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="relative">
          <UserAvatar user={user} className="h-24 w-24 text-2xl" />
          {photoBusy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70"><Loader2 className="h-6 w-6 animate-spin" aria-label="Uploading" /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo" onChange={(e) => pick(e.target.files?.[0])} />
            <label htmlFor="photo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-3.5 text-sm font-semibold text-white hover:bg-brand-primary/90">
              <Camera className="h-4 w-4" aria-hidden="true" /> {user.avatarUrl ? "Change photo" : "Upload photo"}
            </label>
            {user.avatarUrl && (
              <Button size="sm" variant="danger-ghost" onClick={dropPhoto} disabled={photoBusy}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">JPG, PNG or WebP. It is cropped to a square.</p>
        </div>
      </section>

      <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6" noValidate>
        <h2 className="text-lg font-semibold">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="pf-name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={message?.field === "name" ? message.text : undefined} />
          <TextField id="pf-email" label="Email" value={user.email} readOnly className="bg-ink-50 text-muted" hint="Contact us to change your email." />
          <TextField id="pf-phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={message?.field === "phone" ? message.text : undefined} />
          <TextField id="pf-wa" label="WhatsApp number" type="tel" inputMode="tel" optional {...field("whatsapp")} />
          <TextField id="pf-dob" label="Date of birth" type="date" optional {...field("dateOfBirth")} />
          <SelectField id="pf-gender" label="Gender" optional {...field("gender")}>
            <option value="">Prefer not to say</option>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </SelectField>
          <TextField id="pf-city" label="City" autoComplete="address-level2" optional {...field("city")} />
          <TextField id="pf-state" label="State" autoComplete="address-level1" optional {...field("state")} />
          <TextField id="pf-country" label="Country" autoComplete="country-name" optional {...field("country")} />
          <TextField id="pf-job" label="Occupation" placeholder="Student, teacher, engineer…" optional {...field("occupation")} />
          <SelectField id="pf-level" label="My English level" optional {...field("englishLevel")}>
            <option value="">Not sure</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </SelectField>
        </div>
        <TextField id="pf-goal" label="Why are you learning English?" placeholder="Job interviews, studying abroad, speaking confidently…" optional {...field("goal")} />
        <TextArea id="pf-about" label="About me" optional {...field("about")} className="min-h-24" />
        {message && !message.field && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button>
      </form>
    </div>
  );
}
