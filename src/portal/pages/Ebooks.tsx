import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Download, Eye, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { buttonClasses } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { isLive } from "../../utils/backend";
import { getEbookLink, getEbooks, type Ebook } from "../../utils/ebooks";
import { formatBytes } from "../../utils/format";

/** E-books: PDFs for learners with a paid course, to read online or download. */
export default function Ebooks() {
  const { token } = useAuth();
  const [books, setBooks] = useState<Ebook[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getEbooks(token).then(setBooks).catch((e) => setError(e instanceof Error ? e.message : "Could not load the e-books."));
  }, [token]);

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
  const locked = books?.filter((b) => !b.unlocked) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold sm:text-3xl">E-books</h1>
      <p className="mt-1 text-muted">Read our English e-books online or download the PDF. They come with every paid course and plan.</p>
      {!isLive && <Alert tone="info" className="mt-5" title="Demo mode">E-books are stored on the server, so they show on the live site only.</Alert>}
      {error && <Alert tone="error" className="mt-5">{error}</Alert>}
      {books === null && !error && <p className="mt-8 text-sm text-muted" role="status">Loading e-books…</p>}
      {books && books.length === 0 && isLive && (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-10 text-center text-muted">No e-books yet. New ones will show here.</p>
      )}
      {locked.length > 0 && unlocked.length === 0 && (
        <Alert tone="info" className="mt-5" title="Unlock the library">
          {locked[0].courseId === null ? locked[0].lockedReason : "E-books are for learners with a paid course."}{" "}
          <Link to="/learn/courses" className="font-semibold underline">See courses and plans</Link>
        </Alert>
      )}
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[...unlocked, ...locked].map((b) => (
          <li key={b.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-card">
            {b.coverUrl ? (
              <img src={b.coverUrl} alt="" className="h-36 w-24 shrink-0 rounded-lg object-cover ring-1 ring-line" loading="lazy" />
            ) : (
              <span className="grid h-36 w-24 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-primary to-brand-navy text-white"><BookOpen className="h-8 w-8" aria-hidden="true" /></span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="font-semibold leading-snug text-ink-900">{b.title}</h2>
              {b.author && <p className="text-sm text-muted">by {b.author}</p>}
              {b.description && <p className="mt-1 line-clamp-3 text-sm text-body">{b.description}</p>}
              <p className="mt-1 text-xs text-muted">
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
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {b.lockedReason}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
