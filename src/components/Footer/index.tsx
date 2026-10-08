import { Mail, MapPin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { site } from "../../data/site";
import { Logo } from "../Logo";
import { SocialIcons } from "../SocialIcons";

const columns = [
  { title: "Learn", links: [["Grammar", "/grammar"], ["Vocabulary", "/vocabulary"], ["Spoken English", "/spoken-english"], ["Quizzes", "/quiz"]] },
  { title: "Explore", links: [["Courses", "/courses"], ["Blog", "/blog"], ["Search", "/search"], ["My Dashboard", "/dashboard"]] },
  { title: "Company", links: [["Contact", "/contact"], ["Log in", "/login"], ["Create account", "/register"]] },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 bg-ink-900 text-ink-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-ink-200">{site.description}</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-amber-400" aria-hidden="true" /><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-amber-400" aria-hidden="true" /><a href={site.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-white">{site.whatsapp}</a></li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />{site.location}</li>
          </ul>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-display text-sm font-semibold text-white">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, to]) => (
                <li key={to}><Link to={to} className="text-ink-200 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-start justify-between gap-4 py-6 text-sm text-ink-300 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {site.name}. Learn English, one lesson at a time.</p>
          <SocialIcons className="text-ink-100" />
        </div>
      </div>
    </footer>
  );
}
