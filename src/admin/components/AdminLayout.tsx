import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen, CreditCard, ExternalLink, FileText, GraduationCap, History, Inbox, Languages, LayoutDashboard, ListChecks,
  LogOut, Menu, MessagesSquare, Settings, ShieldCheck, ShoppingBag, UserRound, Users, X,
} from "lucide-react";
import { useAdmin } from "../AdminContext";
import { adminApi } from "../api";
import { site } from "../../data/site";
import { cn } from "../../utils/cn";
import type { LucideIcon } from "lucide-react";

interface NavItem { to: string; label: string; icon: LucideIcon; ownerOnly?: boolean; end?: boolean }

const sections: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    title: "Content",
    items: [
      { to: "/admin/content/grammarTopics", label: "Grammar topics", icon: BookOpen },
      { to: "/admin/content/grammarLessons", label: "Grammar lessons", icon: FileText },
      { to: "/admin/content/vocabularyWords", label: "Vocabulary", icon: Languages },
      { to: "/admin/content/spokenLessons", label: "Spoken English", icon: MessagesSquare },
      { to: "/admin/content/quizCategories", label: "Quiz categories", icon: ListChecks },
      { to: "/admin/content/quizzes", label: "Quizzes", icon: ListChecks },
      { to: "/admin/content/courses", label: "Courses", icon: GraduationCap },
      { to: "/admin/content/blogPosts", label: "Blog posts", icon: FileText },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/admin/orders", label: "Orders & payments", icon: ShoppingBag },
      { to: "/admin/messages", label: "Messages", icon: Inbox },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/admin/settings/site", label: "Site settings", icon: Settings },
      { to: "/admin/settings/payments", label: "Payment gateway", icon: CreditCard, ownerOnly: true },
      { to: "/admin/admins", label: "Admins", icon: Users, ownerOnly: true },
      { to: "/admin/activity", label: "Activity log", icon: History },
    ],
  },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, isOwner, signOut } = useAdmin();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.title = `Admin | ${site.name}`;
  }, [pathname]);

  const nav = (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-6">
      {sections.map((s, i) => (
        <div key={i} className="mt-5 first:mt-2">
          {s.title && <p className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-300">{s.title}</p>}
          <ul className="space-y-0.5">
            {s.items.filter((it) => !it.ownerOnly || isOwner).map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end}
                  className={({ isActive }) => cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-white/12 text-white" : "text-ink-100 hover:bg-white/8 hover:text-white")}>
                  <it.icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link to="/admin" className="flex items-center gap-2.5 px-6 py-5 text-white">
      <ShieldCheck className="h-6 w-6 text-amber-400" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-display text-base font-semibold">{site.name}</span>
        <span className="block text-xs text-ink-200">Admin panel{adminApi.mode === "demo" ? " · demo" : ""}</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink-900 lg:flex">{brand}{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-ink-900">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {brand}{nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-800 hover:bg-ink-50 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {adminApi.mode === "demo" && (
            <span className="hidden truncate rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:inline">Demo mode: changes are saved in this browser only</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <a href={import.meta.env.MODE === "preview" ? "#/" : "/"} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">View site</span>
            </a>
            <Link to="/admin/account" className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50" title={admin?.email}>
              <UserRound className="h-4 w-4" aria-hidden="true" /> <span className="hidden max-w-40 truncate sm:inline">{admin?.name}</span>
            </Link>
            <button type="button" onClick={signOut} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">
              <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
