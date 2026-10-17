import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { policies, policyPages, type PolicyKey } from "../../data/policies";
import { policyBlocks } from "../../utils/policyText";
import { formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

/** Terms and Conditions, Refunds and Cancellations, and Privacy Policy (text from Admin → Policies & business). */
export default function PolicyPage({ kind }: { kind: PolicyKey }) {
  const doc = policies[kind];
  const blocks = policyBlocks(doc.body);
  return (
    <>
      <PageHeader crumbs={[{ label: doc.title }]} title={doc.title}>
        {doc.updated && <p className="text-sm text-muted">Last updated <time dateTime={doc.updated}>{formatDate(doc.updated)}</time></p>}
      </PageHeader>
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <article className="max-w-3xl space-y-4 text-[1.0625rem] leading-relaxed">
          {blocks.map((b, i) =>
            b.type === "h2" ? <h2 key={i} className="pt-4 text-xl font-semibold">{b.text}</h2>
            : b.type === "list" ? <ul key={i} className="list-disc space-y-1.5 pl-6">{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
            : <p key={i} className="whitespace-pre-line">{b.text}</p>,
          )}
        </article>
        <nav aria-label="Policies" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-sm font-semibold text-muted">Policies</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {[...policyPages, { key: "pricing", path: "/pricing", label: "Pricing" }, { key: "contact", path: "/contact", label: "Contact us" }].map((p) => (
              <li key={p.key}>
                <Link to={p.path} aria-current={p.key === kind ? "page" : undefined}
                  className={cn("block rounded-lg px-3 py-2 hover:bg-ink-50", p.key === kind ? "bg-ink-50 font-semibold text-ink-900" : "text-ink-700")}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
