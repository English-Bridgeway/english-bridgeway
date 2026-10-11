import { Link } from "react-router-dom";
import { IndianRupee, Inbox, ShoppingBag, Clock3 } from "lucide-react";
import { adminApi } from "../api";
import { schemas } from "../schemas";
import { useAdmin } from "../AdminContext";
import { ErrorNote, Loading, PageTitle, Panel, StatusPill, Empty } from "../ui";
import { formatDateTime, formatNumber, formatPrice } from "../../utils/format";
import { useLoad } from "../ui";

export default function Dashboard() {
  const { admin } = useAdmin();
  const { data, error, reload } = useLoad(() => adminApi.stats());

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const cards = [
    { label: "Revenue", value: formatPrice(data.orders.revenue), icon: IndianRupee, to: "/admin/orders" },
    { label: "Paid orders", value: formatNumber(data.orders.paid), icon: ShoppingBag, to: "/admin/orders" },
    { label: "Pending payments", value: formatNumber(data.orders.pending), icon: Clock3, to: "/admin/orders" },
    { label: "Unread messages", value: formatNumber(data.messages.unread), icon: Inbox, to: "/admin/messages" },
  ];

  return (
    <>
      <PageTitle title={`Welcome, ${admin?.name.split(" ")[0] ?? "admin"}`} description="Everything on the website is managed from here." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift">
            <c.icon className="h-5 w-5 text-ink-500" aria-hidden="true" />
            <p className="mt-3 font-display text-2xl font-bold text-ink-900">{c.value}</p>
            <p className="text-sm text-muted">{c.label}</p>
          </Link>
        ))}
      </div>

      <Panel title="Content" className="mt-6">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {schemas.map((s) => (
            <li key={s.key}>
              <Link to={`/admin/content/${s.key}`} className="flex items-baseline justify-between gap-2 rounded-xl border border-line px-4 py-3 hover:border-ink-300 hover:bg-ink-50/50">
                <span className="text-sm font-medium">{s.label}</span>
                <span className="font-display text-lg font-semibold tabular-nums text-ink-800">{data.content[s.key] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Recent orders" actions={<Link to="/admin/orders" className="text-sm font-semibold text-ink-700">View all</Link>}>
          {data.recentOrders.length ? (
            <ul className="divide-y divide-line">
              {data.recentOrders.map((o) => (
                <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.customerName} · {o.courseTitle}</p>
                    <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatPrice(o.amount)}</span><StatusPill status={o.status} /></div>
                </li>
              ))}
            </ul>
          ) : <Empty>No orders yet. Give a course a price to start selling it.</Empty>}
        </Panel>
        <Panel title="Recent messages" actions={<Link to="/admin/messages" className="text-sm font-semibold text-ink-700">View all</Link>}>
          {data.recentMessages.length ? (
            <ul className="divide-y divide-line">
              {data.recentMessages.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name} · {m.subject}</p>
                    <p className="text-xs text-muted">{formatDateTime(m.createdAt)}</p>
                  </div>
                  <StatusPill status={m.status} />
                </li>
              ))}
            </ul>
          ) : <Empty>No messages yet. Contact form messages appear here.</Empty>}
        </Panel>
      </div>
    </>
  );
}
