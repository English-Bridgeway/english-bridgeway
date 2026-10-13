import { LogIn, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const logOut = () => {
    signOut();
    navigate("/");
  };

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
          {user ? (
            <>
              <Link to="/dashboard" className="hidden h-10 w-10 place-items-center rounded-full bg-amber-300 font-display text-sm font-bold text-ink-900 hover:bg-amber-200 sm:grid" aria-label={`My dashboard (${user.name})`} title={user.name}>
                {user.avatarInitials}
              </Link>
              <button type="button" onClick={logOut} className="hidden h-10 w-10 place-items-center rounded-xl text-white hover:bg-white/10 sm:grid" aria-label="Log out" title="Log out">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-[0.92rem] font-medium text-white hover:bg-white/10 sm:flex">
                <LogIn className="h-4 w-4" aria-hidden="true" /> Log in
              </Link>
              <span className="hidden sm:block"><Button to="/register" size="sm" variant="accent">Sign up free</Button></span>
            </>
          )}
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
              {user && (
                <li>
                  <NavLink to="/dashboard" className={({ isActive }) => cn("block rounded-xl px-4 py-3 text-base font-medium", isActive ? "bg-white/10 text-amber-300" : "text-white hover:bg-white/10")}>
                    My Dashboard
                  </NavLink>
                </li>
              )}
            </ul>
            {user ? (
              <Button onClick={logOut} className="mt-4 w-full border-white/20 bg-white/10 text-white hover:bg-white/20" variant="outline">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Log out ({user.name})
              </Button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button to="/login" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">Log in</Button>
                <Button to="/register" variant="accent">Sign up free</Button>
              </div>
            )}
          </nav>
        </div>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
