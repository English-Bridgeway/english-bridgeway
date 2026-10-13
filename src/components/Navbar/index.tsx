import { Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { mainNav } from "../../data/site";
import { Logo } from "../Logo";
import { Button } from "../Button";
import { SearchDialog } from "../SearchDialog";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Press "/" anywhere to open search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors",
      isActive ? "bg-white/10 text-amber-300" : "text-white hover:bg-white/10 hover:text-amber-300");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-200",
        scrolled || menuOpen ? "border-white/10 bg-brand-primary/95 shadow-[0_4px_20px_-12px_rgb(79_95_245/0.35)] backdrop-blur" : "border-transparent bg-brand-primary",
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="container-page flex h-16 items-center justify-between gap-3 lg:h-18">
        <Logo light />
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {mainNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === "/"} className={linkClass}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl text-white hover:bg-white/10" aria-label="Search (press /)">
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/dashboard" className="hidden h-10 w-10 place-items-center rounded-xl text-white hover:bg-white/10 sm:grid" aria-label={`My dashboard${user ? ` (${user.name})` : ""}`}>
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="hidden sm:block"><Button to="/courses/beginner-english" size="sm" variant="accent">Start Learning</Button></span>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-xl text-white hover:bg-white/10 xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <div
        id="mobile-menu"
        className={cn("grid overflow-hidden transition-[grid-template-rows] duration-300 xl:hidden", menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        inert={!menuOpen}
      >
        <div className="min-h-0">
          <nav aria-label="Mobile" className="container-page border-t border-white/15 pb-6 pt-3">
            <ul className="grid gap-1 sm:grid-cols-2">
              {mainNav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => cn("block rounded-xl px-4 py-3 text-base font-medium", isActive ? "bg-white/10 text-amber-300" : "text-white hover:bg-white/10")}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => cn("block rounded-xl px-4 py-3 text-base font-medium", isActive ? "bg-white/10 text-amber-300" : "text-white hover:bg-white/10")}>
                  My Dashboard
                </NavLink>
              </li>
            </ul>
            <Button to="/courses/beginner-english" className="mt-4 w-full" variant="accent">Start Learning</Button>
          </nav>
        </div>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
