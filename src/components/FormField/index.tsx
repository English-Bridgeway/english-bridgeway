import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

const control =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-[0.95rem] text-body placeholder:text-muted/60 transition-colors focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100";

interface FieldShell { id: string; label: string; error?: string; hint?: string; optional?: boolean }

function Shell({ id, label, error, hint, optional, children }: FieldShell & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-900">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextField({ id, label, error, hint, optional, className, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional }}>
      <input id={id} aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} className={cn(control, error ? "border-red-400" : "border-line", className)} {...rest} />
    </Shell>
  );
}

export function TextArea({ id, label, error, hint, optional, className, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional }}>
      <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} className={cn(control, "min-h-32 resize-y", error ? "border-red-400" : "border-line", className)} {...rest} />
    </Shell>
  );
}

export function SelectField({ id, label, error, hint, optional, className, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional }}>
      <select id={id} aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} className={cn(control, error ? "border-red-400" : "border-line", className)} {...rest}>
        {children}
      </select>
    </Shell>
  );
}
