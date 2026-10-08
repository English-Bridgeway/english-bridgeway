import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function SectionHeading({ eyebrow, title, description, link }: {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-muted">{description}</p>}
      </div>
      {link && (
        <Link to={link.to} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-ink-900">
          {link.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
