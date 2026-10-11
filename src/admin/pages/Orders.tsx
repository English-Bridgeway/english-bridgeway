import { useMemo, useState } from "react";
import { Download, RefreshCw, Search, Undo2 } from "lucide-react";
import { adminApi, type Order, type OrderStatus } from "../api";
import { useAdmin } from "../AdminContext";
import { Confirm, Empty, ErrorNote, Loading, PageTitle, StatusPill, TableWrap, Td, Th, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { formatDateTime, formatPrice, pluralize } from "../../utils/format";

const FILTERS: ("all" | OrderStatus)[] = ["all", "paid", "pending", "failed", "refunded"];

function toCsv(orders: Order[]) {
  const cols: (keyof Order)[] = ["orderId", "createdAt", "status", "courseTitle", "amount", "customerName", "customerEmail", "customerPhone", "gatewayPaymentId", "bankReference", "paidAt", "refundId"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...orders.map((o) => cols.map((c) => esc(o[c])).join(","))].join("\n");
}

export default function Orders() {
  const { isOwner, toast } = useAdmin();
  const { data, setData, error, reload } = useLoad(() => adminApi.listOrders());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((o) => (filter === "all" || o.status === filter) && (!q || `${o.orderId} ${o.customerName} ${o.customerEmail} ${o.customerPhone} ${o.courseTitle}`.toLowerCase().includes(q)));
  }, [data, filter, query]);

  const replace = (o: Order) => setData((d) => d?.map((x) => (x.orderId === o.orderId ? o : x)) ?? null);

  const sync = async (o: Order) => {
    try {
      const updated = await adminApi.syncOrder(o.orderId);
      replace(updated);
      toast(updated.status === o.status ? `No change: still ${updated.status}` : `Order is now ${updated.status}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not check with Cashfree.", "error");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `orders-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const revenue = (data ?? []).filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageTitle
        title="Orders & payments"
        description={data ? `${pluralize(data.length, "order")} · ${formatPrice(revenue)} collected` : undefined}
        actions={<Button variant="outline" onClick={download} disabled={!rows.length}><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${filter === f ? "bg-ink-800 text-white" : "text-ink-700 hover:bg-ink-50"}`}>{f}</button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" className={`${inputClass} pl-9`} placeholder="Name, email, phone or order ID" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search orders" />
        </div>
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : !data ? <Loading /> : !rows.length ? (
        <Empty>{data.length ? "No orders match." : "No orders yet. Set a price on a course (Content → Courses) and turn on the payment gateway to start selling."}</Empty>
      ) : (
        <TableWrap>
          <thead className="bg-canvas">
            <tr><Th>Order</Th><Th>Customer</Th><Th>Amount</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr key={o.orderId}>
                <Td>
                  <p className="font-semibold">{o.courseTitle}</p>
                  <p className="font-mono text-xs text-muted">{o.orderId}</p>
                  <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                </Td>
                <Td>
                  <p>{o.customerName}</p>
                  <p className="text-xs text-muted"><a href={`mailto:${o.customerEmail}`} className="hover:underline">{o.customerEmail}</a></p>
                  <p className="text-xs text-muted">{o.customerPhone}</p>
                </Td>
                <Td className="whitespace-nowrap font-semibold">{formatPrice(o.amount)}</Td>
                <Td>
                  <StatusPill status={o.status} />
                  {o.gatewayPaymentId && <p className="mt-1 text-xs text-muted">Payment {o.gatewayPaymentId}</p>}
                  {o.bankReference && <p className="text-xs text-muted">UTR {o.bankReference}</p>}
                  {o.gateway === "demo" && <p className="mt-1 text-xs text-muted">Demo order</p>}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {o.status === "pending" && <Button size="sm" variant="ghost" onClick={() => sync(o)}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Check</Button>}
                    {o.status === "paid" && isOwner && <Button size="sm" variant="ghost" onClick={() => { setReason(""); setRefunding(o); }}><Undo2 className="h-4 w-4" aria-hidden="true" /> Refund</Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Confirm
        open={!!refunding}
        title={`Refund ${refunding ? formatPrice(refunding.amount) : ""} to ${refunding?.customerName ?? ""}?`}
        body="The full amount goes back to the customer's original payment method through Cashfree. This can't be undone."
        confirmLabel="Refund"
        onClose={() => setRefunding(null)}
        onConfirm={async () => {
          if (!refunding) return;
          try {
            replace(await adminApi.refundOrder(refunding.orderId, reason));
            toast("Refund started");
            setRefunding(null);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Refund failed.", "error");
          }
        }}
      >
        <label htmlFor="refund-reason" className="mt-4 block text-sm font-semibold">Reason (shown in Cashfree)</label>
        <input id="refund-reason" className={`${inputClass} mt-1.5`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} />
      </Confirm>
    </>
  );
}
