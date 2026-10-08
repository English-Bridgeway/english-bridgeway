import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        <li><Link to="/" className="hover:text-ink-800">Home</Link></li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            {c.to && i < items.length - 1 ? (
              <Link to={c.to} className="hover:text-ink-800">{c.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink-800">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
