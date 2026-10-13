import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { Alert } from "../Alert";
import { TextField } from "../FormField";
import { startCoursePayment, type CheckoutCustomer, type PaymentsConfig } from "../../utils/api";
import { formatPrice } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";

type Errors = Partial<Record<keyof CheckoutCustomer, string>>;

function validate(v: CheckoutCustomer): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(v.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))) e.phone = "Enter a 10-digit Indian mobile number.";
  return e;
}

/** Collects buyer details and hands over to Cashfree checkout (or the demo payment). */
export function CheckoutDialog({ open, onClose, course, config }: {
  open: boolean;
  onClose: () => void;
  course: { id: string; title: string; price: number };
  config: PaymentsConfig;
}) {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  // The order is placed for the signed-in account: its email gets the receipt.
  const [values, setValues] = useState<CheckoutCustomer>({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const set = (k: keyof CheckoutCustomer) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure("");
    try {
      const { demoOrderId } = await startCoursePayment(course, values, { token, userId: user?.id ?? null });
      if (demoOrderId) navigate(`/payment/status?order_id=${encodeURIComponent(demoOrderId)}`);
      // Live payments leave the page for Cashfree, which returns to /payment/status.
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Payment could not be started.");
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={`Buy ${course.title}`}>
      <form onSubmit={submit} noValidate className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-ink-50 p-4">
          <span className="font-semibold text-ink-900">{course.title}</span>
          <span className="font-display text-xl font-bold text-ink-900">{formatPrice(course.price)}</span>
        </div>
        {config.demo && (
          <Alert tone="info" title="Demo checkout">No money is taken. The payment is simulated and the order shows in the admin panel.</Alert>
        )}
        {!config.demo && config.mode === "sandbox" && (
          <Alert tone="warning" title="Test mode">Payments use Cashfree's sandbox. Use Cashfree test cards or UPI; no real money moves.</Alert>
        )}
        <TextField id="co-name" label="Full name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} />
        <TextField id="co-email" label="Email" type="email" value={values.email} readOnly className="bg-ink-50 text-muted" hint="Your account email. The receipt is sent here." />
        <TextField id="co-phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} error={errors.phone} />
        {failure && <Alert tone="error">{failure}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Lock className="h-4 w-4" aria-hidden="true" /> {busy ? "Opening payment…" : `Pay ${formatPrice(course.price)}`}
        </Button>
        <p className="text-center text-xs text-muted">Secure payment by Cashfree: UPI, cards, net banking and wallets.</p>
      </form>
    </Modal>
  );
}
