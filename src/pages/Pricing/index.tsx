import { Link } from "react-router-dom";
import { BookOpen, Crown, GraduationCap, Languages, ListChecks, MessagesSquare, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { PlanCards } from "../../portal/Subscribe";
import { courses } from "../../data/courses";
import { policies, subscriptionPlans } from "../../data/policies";
import { formatPrice, pluralize } from "../../utils/format";

const free = [
  { icon: BookOpen, title: "Grammar lessons", to: "/grammar", text: "Rules, examples and practice for every topic." },
  { icon: Languages, title: "Vocabulary", to: "/vocabulary", text: "Words with meanings, pronunciation and examples." },
  { icon: MessagesSquare, title: "Spoken English lessons", to: "/spoken-english", text: "Real conversations with phrases to practise." },
  { icon: ListChecks, title: "Quizzes", to: "/quiz", text: "Test yourself with instant explanations." },
];

/** Every product and service with its price in INR (needed for payment gateway approval, and useful to visitors). */
export default function Pricing() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Pricing" }]} title="Courses and pricing"
        description="Everything we offer and what it costs. All prices are in Indian Rupees (₹)." />

      <div className="container-page space-y-14 py-10">
        {subscriptionPlans.length > 0 && (
          <section aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="flex items-center gap-2 text-2xl font-semibold"><Crown className="h-6 w-6 text-amber-500" aria-hidden="true" /> Subscription plans</h2>
            <p className="mt-2 max-w-2xl text-muted">One payment opens every course and the AI speaking tutor until the plan ends. Plans don't renew by themselves.</p>
            <PlanCards plans={subscriptionPlans} className="mt-6" />
          </section>
        )}

        <section aria-labelledby="courses-heading">
          <h2 id="courses-heading" className="flex items-center gap-2 text-2xl font-semibold"><GraduationCap className="h-6 w-6 text-brand-primary" aria-hidden="true" /> Courses</h2>
          <p className="mt-2 max-w-2xl text-muted">Buy a single course once and keep it on your account, or open them all with a subscription plan.</p>
          <Card className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-line bg-ink-50/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Course</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Level</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Length</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {courses.map((c) => {
                  const price = Number(c.price) || 0;
                  return (
                    <tr key={c.id}>
                      <th scope="row" className="px-5 py-4 font-semibold">
                        <Link to={`/courses/${c.id}`} className="text-ink-900 hover:text-brand-primary hover:underline">{c.title}</Link>
                      </th>
                      <td className="px-5 py-4 text-muted">{c.level}</td>
                      <td className="px-5 py-4 text-muted">{c.duration} · {pluralize(c.lessons, "lesson")}</td>
                      <td className="px-5 py-4 text-right">
                        {price > 0 ? <span className="font-display text-base font-bold text-ink-900">{formatPrice(price)}</span> : <Badge tone="amber">Free</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>

        <section aria-labelledby="free-heading">
          <h2 id="free-heading" className="text-2xl font-semibold">Free for everyone</h2>
          <p className="mt-2 max-w-2xl text-muted">These are free ({formatPrice(0)}), with no account needed.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {free.map((f) => (
              <Link key={f.to} to={f.to} className="group rounded-2xl border border-line bg-white p-5 shadow-card hover:border-ink-200">
                <f.icon className="h-6 w-6 text-brand-primary" aria-hidden="true" />
                <p className="mt-3 font-semibold group-hover:text-brand-primary">{f.title}</p>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex gap-4 rounded-2xl bg-ink-50 p-6">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-primary" aria-hidden="true" />
          <div className="text-sm leading-relaxed">
            {policies.pricingNote && <p className="font-semibold text-ink-900">{policies.pricingNote}</p>}
            <p className="mt-1 text-muted">
              Payments are processed securely by Cashfree Payments (UPI, cards, net banking and wallets). Access is given on your account right after payment.
              See our <Link to="/refunds" className="font-semibold text-ink-800 underline">Refunds and Cancellations Policy</Link> and <Link to="/terms" className="font-semibold text-ink-800 underline">Terms and Conditions</Link>, or <Link to="/contact" className="font-semibold text-ink-800 underline">contact us</Link> with any question.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
