import { useEffect, useState } from "react";
import { Lock, Tag } from "lucide-react";
import { Button } from "../components/Button";
import { CheckoutDialog } from "../components/CheckoutDialog";
import { useAuth } from "../context/AuthContext";
import { getPaymentsConfig, type PaymentsConfig } from "../utils/api";
import { offerApplies } from "../utils/access";
import { formatPrice } from "../utils/format";
import type { Course } from "../types";

/** "Buy course · ₹499" with the learner's special offer applied, and the checkout behind it. */
export function BuyCourse({ course, className, size = "lg" }: { course: Course; className?: string; size?: "md" | "lg" }) {
  const { priceFor, offer, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  useEffect(() => {
    getPaymentsConfig().then(setPayments).catch(() => setPayments({ enabled: false, mode: "sandbox", demo: false }));
  }, []);
  const listPrice = course.price ?? 0;
  const price = priceFor(course);
  const discounted = price < listPrice;

  if (payments?.enabled === false) {
    return (
      <div className={className}>
        <Button to="/contact" size={size} className="w-full">Contact us to enrol</Button>
        <p className="mt-2 text-center text-xs text-muted">Online payment is not available right now.</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <Button size={size} className="w-full" onClick={() => setOpen(true)} disabled={!payments || !ready}>
        <Lock className="h-4 w-4" aria-hidden="true" /> Buy course · {formatPrice(price)}
        {discounted && <span className="font-normal line-through opacity-70">{formatPrice(listPrice)}</span>}
      </Button>
      {discounted && offerApplies(offer, course.id) && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-800">
          <Tag className="h-3.5 w-3.5" aria-hidden="true" /> Special offer for you{offer.note ? `: ${offer.note}` : ""}
        </p>
      )}
      {payments && (
        <CheckoutDialog open={open} onClose={() => setOpen(false)} course={{ id: course.id, title: course.title, price }} listPrice={listPrice} config={payments} />
      )}
    </div>
  );
}
