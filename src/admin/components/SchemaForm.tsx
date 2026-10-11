import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Field } from "../schemas";
import { inputClass } from "../ui";
import { Icon } from "../../components/Icon";
import { cn } from "../../utils/cn";

type Item = Record<string, unknown>;

/** Renders form controls for a list of schema fields. Values are form values (see toForm). */
export function SchemaForm({ fields, value, onChange, idPrefix, options }: {
  fields: Field[];
  value: Item;
  onChange: (next: Item) => void;
  idPrefix: string;
  options: Record<string, string[]>;
}) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.showIf || f.showIf(value)).map((f) => {
        const id = `${idPrefix}-${f.name}`;
        const wide = f.wide || f.type === "list" || f.type === "group" || f.type === "lines" || f.type === "rows" || f.type === "textarea";
        return (
          <div key={f.name} className={cn("min-w-0", wide && "sm:col-span-2")}>
            {f.type === "group" ? (
              <fieldset className="rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-semibold text-ink-900">{f.label}</legend>
                <SchemaForm fields={f.fields} value={(value[f.name] as Item) ?? {}} onChange={(v) => set(f.name, v)} idPrefix={id} options={options} />
              </fieldset>
            ) : f.type === "list" ? (
              <ListField field={f} items={(value[f.name] as Item[]) ?? []} onChange={(v) => set(f.name, v)} idPrefix={id} options={options} />
            ) : (
              <>
                <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-900">
                  {f.label} {f.required && <span className="text-red-700" aria-hidden="true">*</span>}
                </label>
                <Control field={f} id={id} value={value[f.name]} onChange={(v) => set(f.name, v)} options={options} />
                {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Control({ field: f, id, value, onChange, options }: { field: Field; id: string; value: unknown; onChange: (v: unknown) => void; options: Record<string, string[]> }) {
  const str = String(value ?? "");
  switch (f.type) {
    case "textarea":
    case "lines":
    case "rows":
      return <textarea id={id} className={cn(inputClass, "min-h-24 resize-y")} rows={f.type === "textarea" ? 3 : 4} value={str} onChange={(e) => onChange(e.target.value)} required={f.required} />;
    case "number":
      return <input id={id} type="number" inputMode="decimal" className={inputClass} value={str} step={f.step ?? 1} min={f.min} onChange={(e) => onChange(e.target.value)} required={f.required} />;
    case "select": {
      const opts = f.options ?? (f.optionsFrom ? options[f.optionsFrom] ?? [] : []);
      return (
        <select id={id} className={inputClass} value={str} onChange={(e) => onChange(e.target.value)} required={f.required}>
          {!opts.includes(str) && <option value={str}>{str || "Choose…"}</option>}
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case "color":
      return (
        <div className="flex gap-2">
          <input type="color" aria-label={`${f.label} picker`} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1" value={/^#[0-9a-f]{6}$/i.test(str) ? str : "#000000"} onChange={(e) => onChange(e.target.value)} />
          <input id={id} className={inputClass} value={str} onChange={(e) => onChange(e.target.value)} required={f.required} />
        </div>
      );
    case "icon":
      return (
        <div className="flex gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-ink-50 text-ink-700"><Icon name={str} className="h-5 w-5" /></span>
          <input id={id} className={inputClass} value={str} onChange={(e) => onChange(e.target.value)} required={f.required} />
        </div>
      );
    case "date":
      return <input id={id} type="date" className={inputClass} value={str} onChange={(e) => onChange(e.target.value)} required={f.required} />;
    default:
      return <input id={id} className={inputClass} value={str} onChange={(e) => onChange(e.target.value)} required={f.required} />;
  }
}

function ListField({ field, items, onChange, idPrefix, options }: {
  field: Extract<Field, { type: "list" }>;
  items: Item[];
  onChange: (v: Item[]) => void;
  idPrefix: string;
  options: Record<string, string[]>;
}) {
  const [open, setOpen] = useState<number | null>(items.length ? null : 0);
  const update = (i: number, v: Item) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + dir, 0, it);
    onChange(next);
    setOpen(i + dir);
  };
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-semibold text-ink-900">{field.label} <span className="font-normal text-muted">({items.length})</span></legend>
      <ul className="space-y-2">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={i} className="rounded-lg border border-line bg-canvas/50">
              <div className="flex items-center gap-1 pr-1">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm">
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                  <span className="truncate font-medium">{field.itemLabel(item, i)}</span>
                </button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-ink-700 hover:bg-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-ink-700 hover:bg-white disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-red-700 hover:bg-red-50" onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }} aria-label="Remove"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              {isOpen && (
                <div className="border-t border-line bg-white p-4">
                  <SchemaForm fields={field.fields} value={item} onChange={(v) => update(i, v)} idPrefix={`${idPrefix}-${i}`} options={options} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => { onChange([...items, field.newItem()]); setOpen(items.length); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
        <Plus className="h-4 w-4" aria-hidden="true" /> Add
      </button>
    </fieldset>
  );
}
