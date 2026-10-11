import { CircleCheck, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Level } from "../../types";
import { Card } from "../Card";
import { Badge, LevelBadge } from "../Badge";

export function LessonCard({ to, title, description, category, level, minutes, completed, index }: {
  to: string; title: string; description: string; category?: string; level?: Level; minutes?: number; completed?: boolean; index?: number;
}) {
  return (
    <Card interactive className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && <span className="font-display text-sm font-semibold text-ink-400 tabular-nums">Lesson {index}</span>}
        {category && <Badge tone="ink">{category}</Badge>}
        {level && <LevelBadge level={level} />}
        {completed && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-sky">
            <CircleCheck className="h-4 w-4" aria-hidden="true" /> Completed
          </span>
        )}
      </div>
      <h3 className="mt-3 text-[1.0625rem] font-semibold leading-snug">
        <Link to={to} className="after:absolute after:inset-0 focus:outline-none hover:text-ink-600">{title}</Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted">{description}</p>
      {minutes && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {minutes} min
        </p>
      )}
    </Card>
  );
}
