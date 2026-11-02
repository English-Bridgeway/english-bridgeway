import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { Alert } from "../Alert";
import { TextField } from "../FormField";
import { startPayment, type CheckoutCustomer, type CheckoutItem, type PaymentsConfig } from "../../utils/api";
import { monthsLabel } from "../../utils/plans";
import { formatPrice } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import { AccountError } from "../../utils/account";

type Fields = CheckoutCustomer & { password: string };
type Errors = Partial<Record<keyof Fields, string>>;
/** For a visitor who isn't logged in: make a new account, or log in to one, inside the checkout. */
type GuestMode = "signup" | "login";

function validate(v: Fields, guest: GuestMode | null): Errors {
  const e: Errors = {};
  if (guest !== "login" && v.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(v.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))) e.phone = "Enter a 10-digit Indian mobile number.";
  if (guest) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter a valid email address.";
    if (guest === "signup" && v.password.length < 8) e.password = "Use at least 8 characters.";
    if (guest === "login" && !v.password) e.password = "Enter your password.";
  }
  return e;
}

/**
 * Collects buyer details and hands over to Cashfree checkout (or the demo payment), for a course,
 * a plan or an e-book. With `allowGuest`, a visitor who isn't logged in fills in sign-up details
 * (or logs in) right here; the account is made first and the order is placed for it.
 */
export function CheckoutDialog({ open, onClose, item, config, listPrice, allowGuest }: {
  open: boolean;
  onClose: () => void;
  /** price: what this learner pays (after any special offer). */
  item: CheckoutItem;
  config: PaymentsConfig;
  /** The normal price, shown struck through when the learner has an offer. */
  listPrice?: number;
  /** Let a visitor who isn't logged in sign up (or log in) inside the checkout. */
  allowGuest?: boolean;
}) {
  const navigate = useNavigate();
  const { user, token, signUp, signIn } = useAuth();
  // The order is placed for the signed-in account: its email gets the receipt.
  const [values, setValues] = useState<Fields>({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", password: "" });
  const [mode, setMode] = useState<GuestMode>("signup");
  const guest: GuestMode | null = !user && allowGuest ? mode : null;
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const plan = item.kind === "plan";
  const ebook = item.kind === "ebook";

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values, guest);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure("");
    let account = { token, userId: user?.id ?? null };
    let buyer: CheckoutCustomer = { name: values.name, email: values.email, phone: values.phone };
    if (guest) {
      // Make the account (or log in) first; the order then belongs to it.
      try {
        const s = guest === "signup" ? await signUp(values.name.trim(), values.email.trim(), values.password) : await signIn(values.email.trim(), values.password);
        account = { token: s.token, userId: s.user.id };
        buyer = { name: guest === "signup" ? values.name : s.user.name, email: s.user.email, phone: values.phone };
      } catch (err) {
        if (err instanceof AccountError && err.field) setErrors({ [err.field]: err.message });
        else setFailure(err instanceof Error ? err.message : "Could not sign you in. Please try again.");
        // An email that already has an account: offer to log in instead.
        if (guest === "signup" && err instanceof AccountError && err.field === "email") setMode("login");
        setBusy(false);
        return;
      }
    }
    try {
      const { demoOrderId } = await startPayment(item, buyer, account);
      if (demoOrderId) navigate(`/payment/status?order_id=${encodeURIComponent(demoOrderId)}`);
      // Live payments leave the page for Cashfree, which returns to /payment/status.
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Payment could not be started.");
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={plan ? `Subscribe: ${item.title}` : ebook ? `Buy e-book: ${item.title}` : `Buy ${item.title}`}>
      <form onSubmit={submit} noValidate className="space-y-4 p-5">
        <div className="rounded-xl bg-ink-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-ink-900">{plan ? `${item.title} plan` : item.title}</span>
            <span className="text-right">
              {listPrice && listPrice > item.price && <span className="mr-2 text-sm text-muted line-through">{formatPrice(listPrice)}</span>}
              <span className="font-display text-xl font-bold text-ink-900">{formatPrice(item.price)}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {plan
              ? `Every course and Speak with AI for ${monthsLabel(item.months ?? 1)}. One-time payment, no auto-renewal.`
              : ebook
                ? "One-time payment. Read it online or download the PDF any time from E-books."
                : "One-time payment. The course stays in your account for good."}
          </p>
        </div>
        {config.demo && (
          <Alert tone="info" title="Demo checkout">No money is taken. The payment is simulated and the order shows in the admin panel.</Alert>
        )}
        {!config.demo && config.mode === "sandbox" && (
          <Alert tone="warning" title="Test mode">Payments use Cashfree's sandbox. Use Cashfree test cards or UPI; no real money moves.</Alert>
        )}
        {guest && (
          <div className="flex rounded-xl bg-surface-high p-1 text-sm font-semibold" role="tablist" aria-label="Your account">
            {(["signup", "login"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={guest === m} disabled={busy}
                onClick={() => { setMode(m); setErrors({}); setFailure(""); }}
                className={guest === m ? "flex-1 rounded-lg bg-white px-3 py-2 text-brand-primary shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-muted hover:text-ink-900"}>
                {m === "signup" ? "New here? Sign up" : "I have an account"}
              </button>
            ))}
          </div>
        )}
        {guest !== "login" && <TextField id="co-name" label="Full name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} />}
        {guest ? (
          <>
            <TextField id="co-email" label="Email" type="email" autoComplete="email" value={values.email} onChange={set("email")} error={errors.email}
              hint={guest === "signup" ? "Your account is made with this email. The receipt is sent here." : undefined} />
            <TextField id="co-password" label="Password" type="password" autoComplete={guest === "signup" ? "new-password" : "current-password"} value={values.password} onChange={set("password")} error={errors.password}
              hint={guest === "signup" ? "At least 8 characters. Use it to log in and open your e-books later." : undefined} />
          </>
        ) : (
          <TextField id="co-email" label="Email" type="email" value={values.email} readOnly className="bg-ink-50 text-muted" hint="Your account email. The receipt is sent here." />
        )}
        <TextField id="co-phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} error={errors.phone} />
        {failure && <Alert tone="error">{failure}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Lock className="h-4 w-4" aria-hidden="true" /> {busy ? (guest ? "Creating your account…" : "Opening payment…") : guest === "signup" ? `Sign up and pay ${formatPrice(item.price)}` : guest === "login" ? `Log in and pay ${formatPrice(item.price)}` : `Pay ${formatPrice(item.price)}`}
        </Button>
        <p className="text-center text-xs text-muted">Secure payment by Cashfree: UPI, cards, net banking and wallets.</p>
      </form>
    </Modal>
  );
}
