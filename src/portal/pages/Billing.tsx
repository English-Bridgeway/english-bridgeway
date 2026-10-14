import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AccessBanner } from "../AccessBanner";
import { fetchMyOrders, type MyOrder } from "../../utils/account";
import { formatDate, formatDateTime } from "../../utils/access";
import { formatPrice } from "../../utils/format";
import { cn } from "../../utils/cn";

const tone: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800",
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-800",
  refunded: "bg-slate-100 text-slate-700",
};

/** The learner's plan (trial / access end date) and their payments. */
export default function Billing() {
  const { token, user, access } = useAuth();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (token) fetchMyOrders(token).then(setOrders).catch(() => setFailed(true));
  }, [token]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Plan & payments</h1>
      <AccessBanner className="mt-5" />
      <dl className="mt-5 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-3">
        <div><dt className="text-xs text-muted">Member since</dt><dd className="font-semibold">{formatDate(user?.createdAt) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">Free trial</dt><dd className="font-semibold">{access?.trialEndsAt ? `${Date.parse(access.trialEndsAt) > Date.now() ? "Ends" : "Ended"} ${formatDateTime(access.trialEndsAt)}` : "—"}</dd></div>
        <div><dt className="text-xs text-muted">Full access</dt><dd className="font-semibold">{access?.unlimited ? "Unlimited" : access?.accessUntil ? `Until ${formatDate(access.accessUntil)}` : "—"}</dd></div>
      </dl>

      <h2 className="mt-8 text-lg font-semibold">Payments</h2>
      {failed ? (
        <p className="mt-3 text-sm text-muted">Your payments could not be loaded. Please refresh the page.</p>
      ) : !orders ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white p-5 text-muted">
          No payments yet. <Link to="/learn/courses" className="font-semibold text-ink-700">Browse courses →</Link>
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
          {orders.map((o) => (
            <li key={o.orderId} className="flex flex-wrap items-center gap-3 p-4">
              <Receipt className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{o.courseTitle}</p>
                <p className="text-xs text-muted">{formatDateTime(o.paidAt ?? o.createdAt)} · {o.orderId}</p>
              </div>
              <span className="font-semibold tabular-nums">{formatPrice(o.amount)}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", tone[o.status])}>{o.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
