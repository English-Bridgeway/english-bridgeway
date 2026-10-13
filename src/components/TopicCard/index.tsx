import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Level } from "../../types";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { LevelBadge } from "../Badge";
import { pluralize } from "../../utils/format";

/** Used for grammar topics and home-page learning categories. */
export function TopicCard({ to, icon, title, summary, level, lessons, cta = "Start lesson", done }: {
  to: string; icon: string; title: string; summary: string; level?: Level; lessons: number; cta?: string; done?: number;
}) {
  return (
    <Card interactive className="group flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-50 text-ink-700 transition-colors group-hover:bg-ink-800 group-hover:text-white">
          <Icon name={icon} className="h-6 w-6" />
        </span>
        {level && <LevelBadge level={level} />}
      </div>
      <h3 className="mt-5 text-lg font-semibold">
        <Link to={to} className="after:absolute after:inset-0 focus:outline-none">{title}</Link>
      </h3>
      <p className="mt-2 flex-1 text-[0.95rem] text-muted">{summary}</p>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="text-muted">
          {pluralize(lessons, "lesson")}
          {done ? <span className="text-brand-sky"> · {done} done</span> : null}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-ink-700">
          {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
