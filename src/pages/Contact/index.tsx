import { useState } from "react";
import { Building2, Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { SelectField, TextArea, TextField } from "../../components/FormField";
import { SocialIcons } from "../../components/SocialIcons";
import { site } from "../../data/site";
import { businessInfo, policyPages } from "../../data/policies";
import { contactIsLive, sendContactMessage, type ContactPayload } from "../../utils/api";

type Errors = Partial<Record<keyof ContactPayload, string>>;
const empty: ContactPayload = { name: "", email: "", phone: "", subject: "", message: "" };

function validate(v: ContactPayload): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (v.phone && !/^[+\d][\d\s-]{6,16}$/.test(v.phone.trim())) e.phone = "Enter a valid phone number, or leave this empty.";
  if (!v.subject) e.subject = "Please choose a subject.";
  if (v.message.trim().length < 10) e.message = "Please write at least 10 characters so we can help.";
  return e;
}

export default function Contact() {
  const [values, setValues] = useState<ContactPayload>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = (k: keyof ContactPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) { document.getElementById(`contact-${firstBad}`)?.focus(); return; }
    setStatus("sending");
    try {
      await sendContactMessage(values);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const biz = businessInfo();
  const channels = [
    { icon: Mail, label: "Email", value: biz.email, href: `mailto:${biz.email}` },
    { icon: Phone, label: "Phone", value: biz.phone, href: `tel:${biz.phone.replace(/[^\d+]/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: site.whatsapp, href: site.whatsappLink },
    { icon: MapPin, label: "Address", value: biz.address },
    { icon: Clock, label: "Support hours", value: site.hours },
  ];

  return (
    <>
      <PageHeader crumbs={[{ label: "Contact" }]} title="Contact us"
        description="Have a grammar doubt, a course question or a suggestion? Send us a message and we'll reply within one working day." />
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="flex items-start gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-700"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Business</p>
              <p className="text-muted">{biz.name}</p>
              {biz.gstin && <p className="text-sm text-muted">GSTIN: {biz.gstin}</p>}
            </div>
          </Card>
          {channels.map((c) => (
            <Card key={c.label} className="flex items-start gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-700"><c.icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                {c.href ? (
                  <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="break-words text-ink-700 hover:text-ink-900 hover:underline">{c.value}</a>
                ) : <p className="whitespace-pre-line text-muted">{c.value}</p>}
              </div>
            </Card>
          ))}
          <div className="rounded-2xl bg-brand-primary p-5 text-white">
            <p className="font-semibold">Follow us</p>
            <p className="mt-1 text-sm text-ink-200">Daily phrases and quick grammar tips.</p>
            <SocialIcons className="mt-4" />
          </div>
          <nav aria-label="Policies" className="px-1 text-sm">
            <p className="font-semibold">Policies</p>
            <ul className="mt-2 space-y-1.5">
              {[...policyPages, { key: "pricing", path: "/pricing", label: "Pricing" }].map((p) => (
                <li key={p.path}><Link to={p.path} className="text-ink-700 hover:text-ink-900 hover:underline">{p.label}</Link></li>
              ))}
            </ul>
          </nav>
        </aside>

        <Card className="p-6 sm:p-8">
          {status === "sent" ? (
            <div className="py-6">
              <Alert tone="success" title={`Thank you, ${values.name.trim().split(" ")[0]}!`}>
                {contactIsLive ? "Your message has been sent. We'll reply to " : "Demo mode: your message was saved in this browser and appears in the admin panel's Messages. Replies would go to "}
                <strong>{values.email}</strong>.
              </Alert>
              <Button className="mt-6" variant="outline" onClick={() => { setValues(empty); setStatus("idle"); }}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <h2 className="text-xl font-semibold">Send us a message</h2>
              {status === "error" && (
                <Alert tone="error" title="Your message couldn't be sent">
                  Please check your internet connection and try again, or email us at {site.email}.
                </Alert>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id="contact-name" label="Name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} />
                <TextField id="contact-email" label="Email" type="email" autoComplete="email" value={values.email} onChange={set("email")} error={errors.email} />
                <TextField id="contact-phone" label="Phone" type="tel" autoComplete="tel" optional value={values.phone} onChange={set("phone")} error={errors.phone} hint="Include your country code, e.g. +91" />
                <SelectField id="contact-subject" label="Subject" value={values.subject} onChange={set("subject")} error={errors.subject}>
                  <option value="">Choose a subject</option>
                  <option>Grammar doubt</option>
                  <option>Course question</option>
                  <option>Spoken English help</option>
                  <option>Technical problem</option>
                  <option>Partnership</option>
                  <option>Something else</option>
                </SelectField>
              </div>
              <TextArea id="contact-message" label="Message" value={values.message} onChange={set("message")} error={errors.message}
                placeholder="Example: Should I say “I have been to Goa” or “I have gone to Goa”?" />
              <Button type="submit" size="lg" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : <>Send Message <Send className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
