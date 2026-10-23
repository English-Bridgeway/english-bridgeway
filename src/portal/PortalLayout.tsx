import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Bot, CreditCard, ExternalLink, GraduationCap, LayoutDashboard, Library, LogOut, Menu, Mic, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../components/Logo";
import { PageSkeleton } from "../components/Skeleton";
import { UserAvatar } from "./Avatar";
import { timeLeft } from "../utils/access";
import { cn } from "../utils/cn";

const nav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/learn", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/learn/courses", label: "My courses", icon: GraduationCap },
  { to: "/learn/ebooks", label: "E-books", icon: Library },
  { to: "/learn/ai", label: "Speak with AI", icon: Bot },
  { to: "/learn/live", label: "Speak Live", icon: Mic },
  { to: "/learn/billing", label: "Plan & payments", icon: CreditCard },
  { to: "/learn/profile", label: "My profile", icon: UserRound },
];

/** The learner portal (/learn): its own sidebar layout, separate from the public website. */
export function PortalLayout({ children }: { children: ReactNode }) {
  const { user, access, signOut, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  // Pick up access the admin changed (or a trial that ran out) when the learner comes back.
  useEffect(() => {
    void refresh();
    const onShow = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [refresh]);

  const links = (
    <nav aria-label="Learner portal" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {nav.map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} end={it.end}
              className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors", isActive ? "bg-white/15 text-amber-300" : "text-ink-100 hover:bg-white/10 hover:text-white")}>
              <it.icon className="h-5 w-5 shrink-0" aria-hidden="true" /> {it.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-white/10 pt-4">
        <a href={import.meta.env.MODE === "preview" ? "#/" : "/"} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-200 hover:bg-white/10 hover:text-white">
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> Back to website
        </a>
        <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-200 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
        </button>
      </div>
    </nav>
  );

  const me = (
    <Link to="/learn/profile" className="mx-3 mb-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-white hover:bg-white/15">
      <UserAvatar user={user} className="h-10 w-10 text-sm" />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{user?.name}</span>
        <span className="block truncate text-xs text-ink-200">{user?.email}</span>
      </span>
    </Link>
  );

  const brand = <div className="px-5 py-5"><Logo light /></div>;
  const chip = access && (
    access.status === "trial" ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Free trial · {timeLeft(access.until)} left</span>
      : access.status === "expired" ? <Link to="/learn/courses" className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-800 hover:bg-ink-200">Trial ended · Buy a course</Link>
      : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{access.status === "unlimited" ? "Unlimited access" : `Access · ${timeLeft(access.until)} left`}</span>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-brand-primary lg:flex">{brand}{me}{links}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-brand-primary">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-5 grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {brand}{me}{links}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-800 hover:bg-ink-50 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="hidden font-display font-semibold text-ink-900 sm:inline">My learning</span>
          <div className="ml-auto flex min-w-0 items-center gap-3 whitespace-nowrap text-ellipsis">
            {chip}
            <Link to="/learn/profile" aria-label="My profile"><UserAvatar user={user} className="h-9 w-9 text-xs" /></Link>
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
