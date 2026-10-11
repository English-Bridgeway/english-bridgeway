import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-body placeholder:text-muted/60 focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100";

export function PageTitle({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const pill: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  failed: "bg-red-50 text-red-800 ring-red-200",
  refunded: "bg-slate-100 text-slate-700 ring-slate-200",
  new: "bg-ink-50 text-ink-800 ring-ink-200",
  read: "bg-slate-100 text-slate-700 ring-slate-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  owner: "bg-amber-50 text-amber-800 ring-amber-200",
  editor: "bg-ink-50 text-ink-800 ring-ink-200",
  disabled: "bg-red-50 text-red-800 ring-red-200",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset", pill[status] ?? pill.read)}>{label ?? status}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-muted" role="status">{label}</p>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      {message} {onRetry && <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Try again</button>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</p>;
}

export function Confirm({ open, title, body, confirmLabel = "Delete", danger = true, onConfirm, onClose, children }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <div className="p-5">
      {body && <p className="text-sm text-muted">{body}</p>}
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
      </div>
    </Modal>
  );
}

/** Loads data with loading/error state and a reload function. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    load().then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Something went wrong."));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, setData, error, reload: () => setTick((t) => t + 1) };
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={cn("whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 align-top text-sm", className)}>{children}</td>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table className="min-w-full divide-y divide-line">{children}</table>
    </div>
  );
}
