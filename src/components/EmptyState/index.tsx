import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      <SearchX className="mx-auto h-10 w-10 text-ink-300" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
