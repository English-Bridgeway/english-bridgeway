import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, Crown, Sparkles } from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { CheckoutDialog } from "../components/CheckoutDialog";
import { useAuth } from "../context/AuthContext";
import { getPaymentsConfig, getPlans, type PaymentsConfig } from "../utils/api";
import { planPrice, periodOf } from "../utils/plans";
import { formatPrice } from "../utils/format";
import { cn } from "../utils/cn";
import type { SubscriptionPlan } from "../types";

// Subscriptions: pay once for 1, 3, 6 or 12 months and every course and Speak with AI are open
// until then. Plans are made in Admin → Subscription plans; with none, nothing here shows.

let cached: Promise<SubscriptionPlan[]> | null = null;

/** The active plans (null while loading). Fetched once per page load. */
export function usePlans(): SubscriptionPlan[] | null {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  useEffect(() => {
    cached ??= getPlans().catch(() => {
      cached = null;
      return [];
    });
    let live = true;
    cached.then((p) => live && setPlans(p));
    return () => { live = false; };
  }, []);
  return plans;
}

const perMonth = (p: { price: number; months: number }) => formatPrice(Math.round(p.price / p.months));

function usePayments() {
  const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  useEffect(() => {
    getPaymentsConfig().then(setPayments).catch(() => setPayments({ enabled: false, mode: "sandbox", demo: false }));
  }, []);
  return payments;
}

/** Plan cards with a Subscribe button each, and the checkout behind them. */
export function PlanCards({ plans, className, compact, onPick }: {
  plans: SubscriptionPlan[];
  className?: string;
  compact?: boolean;
  /** Takes over the checkout when given (e.g. a dialog that closes itself and opens the checkout). */
  onPick?: (plan: SubscriptionPlan) => void;
}) {
  const { isAuthenticated, access, offer, ready } = useAuth();
  const payments = usePayments();
  const location = useLocation();
  const [picked, setPicked] = useState<SubscriptionPlan | null>(null);
  const next = encodeURIComponent(`${location.pathname}${location.search}`);

  return (
    <>
      <ul className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4", className)}>
        {plans.map((p) => {
          const price = planPrice(offer, p);
          return (
            <li key={p.id} className={cn("relative flex flex-col rounded-2xl border bg-white p-5", p.highlight ? "border-brand-primary ring-2 ring-brand-primary/20" : "border-line")}>
              {p.highlight && (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-ink-900">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Best value
                </span>
              )}
              {p.name.toLowerCase() !== periodOf(p.months).label.toLowerCase() && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{periodOf(p.months).label}</p>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-2">
                <span className="font-display text-2xl font-bold text-ink-900">{formatPrice(price)}</span>
                {price < p.price && <span className="ml-2 text-sm text-muted line-through">{formatPrice(p.price)}</span>}
                <span className="text-sm text-muted"> / {periodOf(p.months).per}</span>
              </p>
              {p.months > 1 && <p className="text-xs text-muted">{perMonth({ price, months: p.months })} a month</p>}
              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
              {!compact && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {["Every course, all lessons", "Speak with AI tutor", "One payment, no auto-renewal"].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-4">
                {!isAuthenticated ? (
                  <Button to={`/login?next=${next}`} variant={p.highlight ? "primary" : "outline"} className="w-full">Log in to subscribe</Button>
                ) : payments?.enabled === false ? (
                  <Button to="/contact" variant="outline" className="w-full">Contact us</Button>
                ) : access?.unlimited ? (
                  <p className="text-center text-sm font-semibold text-emerald-800">You have unlimited access</p>
                ) : (
                  <Button
                    variant={p.highlight ? "primary" : "outline"}
                    className="w-full"
                    disabled={!payments || !ready}
                    onClick={() => (onPick ? onPick(p) : setPicked(p))}
                  >
                    <Crown className="h-4 w-4" aria-hidden="true" /> {access?.status === "active" ? "Extend" : "Subscribe"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {payments && picked && <PlanCheckout plan={picked} config={payments} onClose={() => setPicked(null)} />}
    </>
  );
}

function PlanCheckout({ plan, config, onClose }: { plan: SubscriptionPlan; config: PaymentsConfig; onClose: () => void }) {
  const { offer } = useAuth();
  return (
    <CheckoutDialog
      open
      onClose={onClose}
      item={{ kind: "plan", id: plan.id, title: plan.name, price: planPrice(offer, plan), months: plan.months }}
      listPrice={plan.price}
      config={config}
    />
  );
}

/** "Subscribe · all courses from ₹X/month", opening the plan list. Renders nothing when there are no plans. */
export function SubscribeButton({ className, size = "lg", variant = "outline" }: { className?: string; size?: "md" | "lg"; variant?: "primary" | "outline" }) {
  const plans = usePlans();
  const { access } = useAuth();
  const payments = usePayments();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SubscriptionPlan | null>(null);
  if (!plans?.length || access?.unlimited) return null;
  const cheapest = Math.min(...plans.map((p) => Math.round(p.price / p.months)));
  return (
    <div className={className}>
      <Button size={size} variant={variant} className="w-full" onClick={() => setOpen(true)}>
        <Crown className="h-4 w-4" aria-hidden="true" /> Subscribe · all courses
      </Button>
      <p className="mt-1.5 text-center text-xs text-muted">From {formatPrice(cheapest)} a month · every course and the AI tutor</p>
      <Modal open={open} onClose={() => setOpen(false)} title="Subscribe for every course" className="max-w-2xl">
        <div className="p-5">
          <p className="mb-5 text-sm text-muted">One payment opens every course and Speak with AI until your plan ends. It doesn't renew by itself.</p>
          <PlanCards plans={plans} compact onPick={(p) => { setOpen(false); setPicked(p); }} />
        </div>
      </Modal>
      {payments && picked && <PlanCheckout plan={picked} config={payments} onClose={() => setPicked(null)} />}
    </div>
  );
}
