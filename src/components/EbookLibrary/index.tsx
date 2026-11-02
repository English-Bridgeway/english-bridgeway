import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CircleCheck, Download, Eye, Lock, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { buttonClasses } from "../Button";
import { Alert } from "../Alert";
import { CheckoutDialog } from "../CheckoutDialog";
import { isLive } from "../../utils/backend";
import { getPaymentsConfig, type PaymentsConfig } from "../../utils/api";
import { getEbookLink, getEbooks, type Ebook } from "../../utils/ebooks";
import { formatBytes, formatPrice } from "../../utils/format";
import { cn } from "../../utils/cn";

/**
 * The e-book shelf, shared by the public E-books page (/ebooks) and the learner portal
 * (/learn/ebooks). E-books with a price can be bought one by one; the rest come with a paid
 * course or plan. Owned e-books can be read online or downloaded as a PDF.
 */
export function EbookLibrary({ coursesLink }: { coursesLink: string }) {
  const { token } = useAuth();
  const [books, setBooks] = useState<Ebook[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  const [buying, setBuying] = useState<Ebook | null>(null);

  useEffect(() => {
    getEbooks(token).then(setBooks).catch((e) => setError(e instanceof Error ? e.message : "Could not load the e-books."));
  }, [token]);

  const anyForSale = books?.some((b) => b.forSale && !b.unlocked) ?? false;
  useEffect(() => {
    if (anyForSale && !payments) getPaymentsConfig().then(setPayments).catch(() => setPayments({ enabled: false, mode: "sandbox", demo: false }));
  }, [anyForSale, payments]);

  const open = async (book: Ebook, download: boolean) => {
    if (!token) return;
    setError("");
    setBusy(book.id + download);
    // Open the tab now, while the click still counts, so pop-up blockers allow it.
    const tab = download ? null : window.open("", "_blank");
    try {
      const url = await getEbookLink(token, book.id, download);
      if (tab) {
        tab.location.href = url;
      } else if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.location.href = url;
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Could not open the e-book.");
    } finally {
      setBusy(null);
    }
  };


  const unlocked = books?.filter((b) => b.unlocked) ?? [];
  const forSale = books?.filter((b) => !b.unlocked && b.forSale) ?? [];
  const included = books?.filter((b) => !b.unlocked && !b.forSale) ?? [];
  const paymentsOff = payments !== null && !payments.enabled;

  return (
    <>
      {!isLive && <Alert tone="info" className="mt-5" title="Demo mode">E-books are stored on the server, so they show on the live site only.</Alert>}
      {error && <Alert tone="error" className="mt-5">{error}</Alert>}
      {paymentsOff && forSale.length > 0 && <Alert tone="warning" className="mt-5">Online payment is switched off right now. Please contact us to buy an e-book.</Alert>}
      {books === null && !error && <p className="mt-8 text-sm text-muted" role="status">Loading e-books…</p>}
      {books && books.length === 0 && isLive && (
        <p className="mt-8 rounded-2xl border border-dashed border-ink-200 p-10 text-center text-muted">No e-books yet. New ones will show here.</p>
      )}
      {included.length > 0 && unlocked.length === 0 && (
        <Alert tone="info" className="mt-5" title="Included with paid courses">
          Some e-books come free with a paid course or plan. <Link to={coursesLink} className="font-semibold underline">See courses and plans</Link>
        </Alert>
      )}
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[...unlocked, ...forSale, ...included].map((b) => (
          <li key={b.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
            {b.coverUrl ? (
              <img src={b.coverUrl} alt="" className="h-40 w-28 shrink-0 rounded-xl object-cover shadow-sm" loading="lazy" />
            ) : (
              <span className="grid h-40 w-28 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-navy text-white shadow-sm"><BookOpen className="h-8 w-8" aria-hidden="true" /></span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-1.5">
                {b.owned && <Tag tone="owned"><CircleCheck className="h-3 w-3" aria-hidden="true" /> Purchased</Tag>}
                {!b.owned && b.unlocked && <Tag tone="owned">Included</Tag>}
                {!b.unlocked && b.forSale && <Tag tone="price">{formatPrice(b.price)}</Tag>}
                {!b.unlocked && !b.forSale && <Tag tone="locked">With paid courses</Tag>}
              </div>
              <h2 className="mt-1.5 font-semibold leading-snug text-ink-900">{b.title}</h2>
              {b.author && <p className="text-sm text-muted">by {b.author}</p>}
              {b.description && <p className="mt-1 line-clamp-3 text-sm text-body">{b.description}</p>}
              <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-muted">
                PDF{b.fileSize ? ` · ${formatBytes(b.fileSize)}` : ""}{b.courseTitle ? ` · with ${b.courseTitle}` : ""}
              </p>
              <div className="mt-auto pt-3">
                {b.unlocked ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonClasses("primary", "sm")} disabled={busy !== null} onClick={() => open(b, false)}>
                      <Eye className="h-4 w-4" aria-hidden="true" /> {busy === b.id + "false" ? "Opening…" : "Read"}
                    </button>
                    <button type="button" className={buttonClasses("outline", "sm")} disabled={busy !== null} onClick={() => open(b, true)}>
                      <Download className="h-4 w-4" aria-hidden="true" /> {busy === b.id + "true" ? "Preparing…" : "Download"}
                    </button>
                  </div>
                ) : b.forSale ? (
                  <div>
                    <button type="button" className={buttonClasses("primary", "sm")} disabled={paymentsOff} onClick={() => setBuying(b)}>
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Buy for {formatPrice(b.price)}
                    </button>
                    {b.courseTitle && <p className="mt-1.5 text-xs text-muted">Free with the course “{b.courseTitle}”.</p>}
                  </div>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {b.lockedReason}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {buying && payments && (
        <CheckoutDialog
          open
          onClose={() => setBuying(null)}
          item={{ kind: "ebook", id: buying.id, title: buying.title, price: buying.price }}
          config={payments}
          allowGuest
        />
      )}
    </>
  );
}

function Tag({ tone, children }: { tone: "owned" | "price" | "locked"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[0.7rem] font-medium uppercase tracking-wide",
      tone === "owned" && "bg-amber-100 text-amber-800",
      tone === "price" && "bg-brand-primary text-white",
      tone === "locked" && "bg-surface-high text-muted",
    )}>
      {children}
    </span>
  );
}
