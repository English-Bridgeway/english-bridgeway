import { Mail, MapPin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { site } from "../../data/site";
import { businessInfo, policyPages } from "../../data/policies";
import { Logo } from "../Logo";
import { SocialIcons } from "../SocialIcons";

const columns = [
  { title: "Learn", links: [["Grammar", "/grammar"], ["Vocabulary", "/vocabulary"], ["Spoken English", "/spoken-english"], ["Quizzes", "/quiz"], ["E-books", "/ebooks"]] },
  { title: "Explore", links: [["Courses", "/courses"], ["Pricing", "/pricing"], ["Speak Live", "/learn/live"], ["Blog", "/blog"], ["Search", "/search"], ["My learning", "/learn"]] },
  { title: "Company", links: [["Contact Us", "/contact"], ["Log in", "/login"], ["Create account", "/register"]] },
  { title: "Policies", links: policyPages.map((p) => [p.label, p.path] as const) },
] as const;

export function Footer() {
  const biz = businessInfo();
  return (
    <footer className="mt-20 bg-surface-low text-body shadow-[0_-1px_8px_rgb(0_0_0/0.04)]">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="max-w-sm sm:col-span-2 md:col-span-3 lg:col-span-1">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">{site.description}</p>
          <ul className="mt-5 space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-primary" aria-hidden="true" /><a href={`mailto:${biz.email}`} className="hover:text-brand-primary">{biz.email}</a></li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-primary" aria-hidden="true" /><a href={site.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary">{site.whatsapp}</a></li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-primary" aria-hidden="true" />{site.location}</li>
          </ul>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-900">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, to]) => (
                <li key={to}><Link to={to} className="text-muted transition-colors hover:text-ink-900">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-start justify-between gap-4 py-6 text-sm text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {biz.name}. Learn English, one lesson at a time.</p>
          <SocialIcons className="text-muted hover:text-brand-primary" />
        </div>
      </div>
    </footer>
  );
}
