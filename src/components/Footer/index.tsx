import { Mail, MapPin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { site } from "../../data/site";
import { businessInfo, policyPages } from "../../data/policies";
import { Logo } from "../Logo";
import { SocialIcons } from "../SocialIcons";

const columns = [
  { title: "Learn", links: [["Grammar", "/grammar"], ["Vocabulary", "/vocabulary"], ["Spoken English", "/spoken-english"], ["Quizzes", "/quiz"]] },
  { title: "Explore", links: [["Courses", "/courses"], ["Pricing", "/pricing"], ["Speak Live", "/learn/live"], ["Blog", "/blog"], ["Search", "/search"], ["My learning", "/learn"]] },
  { title: "Company", links: [["Contact Us", "/contact"], ["Log in", "/login"], ["Create account", "/register"]] },
  { title: "Policies", links: policyPages.map((p) => [p.label, p.path] as const) },
] as const;

export function Footer() {
  const biz = businessInfo();
  return (
    <footer className="mt-20 bg-brand-primary text-white">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="max-w-sm sm:col-span-2 md:col-span-3 lg:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-white/85">{site.description}</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-amber-400" aria-hidden="true" /><a href={`mailto:${biz.email}`} className="hover:text-white">{biz.email}</a></li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-amber-400" aria-hidden="true" /><a href={site.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-white">{site.whatsapp}</a></li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />{site.location}</li>
          </ul>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-display text-sm font-semibold text-amber-400">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, to]) => (
                <li key={to}><Link to={to} className="text-white hover:text-amber-300">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-start justify-between gap-4 py-6 text-sm text-white/80 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {biz.name}. Learn English, one lesson at a time.</p>
          <SocialIcons className="text-white hover:text-amber-300" />
        </div>
      </div>
    </footer>
  );
}
