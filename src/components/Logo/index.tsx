import { Languages } from "lucide-react";
import { Link } from "react-router-dom";
import { site } from "../../data/site";
import { cn } from "../../utils/cn";

/** Brand mark: a purple tile with the "translate" glyph, then the site name. `light` is for dark backgrounds. */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex shrink-0 items-center gap-2", className)} aria-label={`${site.name} home`}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", light ? "bg-white text-brand-primary" : "bg-brand-primary text-white")}>
        <Languages className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={cn("whitespace-nowrap font-display text-xl font-bold tracking-tight", light ? "text-white" : "text-ink-900")}>{site.name}</span>
    </Link>
  );
}
