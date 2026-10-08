import { cn } from "../../utils/cn";

export function ProgressBar({ value, label, showValue, className, tone = "ink" }: {
  value: number; // 0–100
  label: string; // accessible name
  showValue?: boolean;
  className?: string;
  tone?: "ink" | "amber";
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("w-full", className)}>
      {showValue && (
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted">{label}</span>
          <span className="font-semibold tabular-nums text-ink-800">{v}%</span>
        </div>
      )}
      <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-ink-50">
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone === "ink" ? "bg-ink-500" : "bg-amber-400")} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
