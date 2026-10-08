import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Tone = "info" | "success" | "warning" | "error";
const styles: Record<Tone, string> = {
  info: "border-ink-200 bg-ink-50 text-ink-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-900",
};
const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleX };

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const I = icons[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4", styles[tone], className)}>
      <I className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
