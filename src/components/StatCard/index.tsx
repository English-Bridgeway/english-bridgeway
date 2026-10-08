import { Icon } from "../Icon";

export function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
