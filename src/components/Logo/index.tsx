import { Link } from "react-router-dom";
import { site } from "../../data/site";
import { cn } from "../../utils/cn";

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex shrink-0 items-center gap-2.5", className)} aria-label={`${site.name} home`}>
      <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-lg font-bold", light ? "bg-white text-ink-800" : "bg-brand-primary text-white")}>
        E
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-current bg-amber-400" style={{ borderColor: light ? "var(--primary-color)" : "var(--white)" }} />
      </span>
      <span className={cn("whitespace-nowrap font-display text-xl font-semibold tracking-tight", light ? "text-white" : "text-ink-900")}>{site.name}</span>
    </Link>
  );
}
