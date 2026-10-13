import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleCheck, CircleX, Clock3, Loader2 } from "lucide-react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { usePageMeta } from "../../hooks/usePageMeta";
import { getOrderStatus, type PublicOrder } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { formatPrice } from "../../utils/format";
import { site } from "../../data/site";

/** Cashfree returns the buyer here (?order_id=…). The server re-checks the order with Cashfree. */
export default function PaymentStatus() {
  usePageMeta({ title: "Payment status", description: "Your course payment status." });
  const [params] = useSearchParams();
  const orderId = params.get("order_id") || "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(0);
  const { refresh } = useAuth();

  useEffect(() => {
    if (!orderId) { setError("No order was given."); return; }
    let cancelled = false;
    getOrderStatus(orderId)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        // The paid course now shows as owned in the learner's account.
        if (o.status === "paid") void refresh();
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not check the payment."));
    return () => { cancelled = true; };
  }, [orderId, checks, refresh]);

  // A just-finished UPI payment can take a few seconds to confirm.
  useEffect(() => {
    if (order?.status !== "pending" || checks >= 6) return;
    const t = setTimeout(() => setChecks((c) => c + 1), 4000);
    return () => clearTimeout(t);
  }, [order, checks]);

  const view = error
    ? { icon: <CircleX className="h-12 w-12 text-red-600" />, title: "We couldn't find this payment", body: error }
    : !order
      ? { icon: <Loader2 className="h-12 w-12 animate-spin text-ink-500" />, title: "Checking your payment…", body: "This takes a moment." }
      : order.status === "paid"
        ? { icon: <CircleCheck className="h-12 w-12 text-emerald-600" />, title: "Payment successful", body: `You're enrolled in ${order.courseTitle}. ${formatPrice(order.amount)} paid.` }
        : order.status === "pending"
          ? { icon: <Clock3 className="h-12 w-12 text-amber-600" />, title: "Payment not finished yet", body: checks >= 6 ? "We haven't received the payment. If money left your account, it will be confirmed or refunded automatically." : "Waiting for confirmation from your bank…" }
          : { icon: <CircleX className="h-12 w-12 text-red-600" />, title: order.status === "refunded" ? "This payment was refunded" : "Payment failed", body: order.status === "refunded" ? "The amount is on its way back to you." : "No money was taken. You can try again." };

  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto grid place-items-center" aria-hidden="true">{view.icon}</div>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl" aria-live="polite">{view.title}</h1>
        <p className="mt-3 text-muted">{view.body}</p>
        {orderId && <p className="mt-4 text-xs text-muted">Order {orderId}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {order && <Button to={`/courses/${order.courseId}`}>{order.status === "paid" ? "Start the course" : "Back to the course"}</Button>}
          <Button to="/contact" variant="outline">Contact {site.name}</Button>
        </div>
      </Card>
    </div>
  );
}
