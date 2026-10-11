import { cn } from "../../utils/cn";

/** Pill-style filter group. Uses aria-pressed toggle buttons (filters, not tab panels). */
export function Tabs<T extends string>({ options, value, onChange, label, className }: {
  options: readonly T[] | { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const items = (options as (T | { value: T; label: string; count?: number })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o, count: undefined } : o,
  );
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {items.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            o.value === value ? "border-brand-sky bg-brand-sky text-white" : "border-line bg-white text-muted hover:border-ink-300 hover:text-ink-800",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cn("text-xs tabular-nums", o.value === value ? "text-white/70" : "text-muted/70")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
