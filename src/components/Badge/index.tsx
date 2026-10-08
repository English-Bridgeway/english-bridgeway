import type { ReactNode } from "react";
import type { Level } from "../../types";
import { cn } from "../../utils/cn";

type Tone = "neutral" | "ink" | "amber" | "green" | "red";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  ink: "bg-ink-50 text-ink-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

const levelTone: Record<Level, Tone> = { Beginner: "green", Intermediate: "amber", Advanced: "red" };

export function LevelBadge({ level }: { level: Level }) {
  const dots = level === "Beginner" ? 1 : level === "Intermediate" ? 2 : 3;
  return (
    <Badge tone={levelTone[level]}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= dots ? "bg-current" : "bg-current opacity-25")} />
        ))}
      </span>
      {level}
    </Badge>
  );
}
