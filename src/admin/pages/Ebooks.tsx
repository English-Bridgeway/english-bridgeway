import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, BookOpen, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi, type AdminEbook, type EbookInput } from "../api";
import { useAdmin } from "../AdminContext";
import { Confirm, Empty, ErrorNote, Loading, PageTitle, Panel, StatusPill, inputClass, useLoad } from "../ui";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Alert";
import { formatBytes, formatDate } from "../../utils/format";

const blank: EbookInput = { title: "", author: "", description: "", courseId: null, published: true };

function Cover({ book, className = "h-20 w-14" }: { book: Pick<AdminEbook, "coverUrl" | "title">; className?: string }) {
  return book.coverUrl ? (
    <img src={book.coverUrl} alt="" className={`${className} shrink-0 rounded-md object-cover ring-1 ring-line`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-md bg-ink-50 text-ink-500 ring-1 ring-line`}><BookOpen className="h-6 w-6" aria-hidden="true" /></span>
  );
}

/** Add or edit one e-book: its details, who can open it, the PDF and the cover. */
function Editor({ book, courses, onDone, onCancel }: {
  book: AdminEbook | null; courses: { id: string; title: string; price: number }[]; onDone: () => void; onCancel: () => void;
}) {
  const { toast } = useAdmin();
  const [form, setForm] = useState<EbookInput>(book ? { title: book.title, author: book.author, description: book.description, courseId: book.courseId, published: book.published } : blank);
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<EbookInput>) => setForm({ ...form, ...patch });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!book && !pdf) return setError("Choose the PDF file.");
    if (pdf && pdf.type && pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) return setError("The e-book must be a PDF file.");
    setBusy(true);
    try {
      // A new e-book is saved unpublished until its PDF is in, so learners never see it half-made.
      let saved = await adminApi.saveEbook(book ? form : { ...form, published: false }, book?.id);
      if (pdf) {
        setProgress(0);
        saved = await adminApi.uploadEbookFile(saved.id, pdf, setProgress);
      }
      if (cover) saved = await adminApi.uploadEbookCover(saved.id, cover);
      if (!book && form.published) saved = await adminApi.saveEbook(form, saved.id);
      toast(book ? "E-book saved" : "E-book added");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Panel title={book ? `Edit “${book.title}”` : "Add an e-book"} className="mb-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold sm:col-span-2">
          Title
          <input className={`${inputClass} mt-1.5 font-normal`} value={form.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} placeholder="e.g. English Grammar Handbook" />
        </label>
        <label className="block text-sm font-semibold">
          Author <span className="font-normal text-muted">(optional)</span>
          <input className={`${inputClass} mt-1.5 font-normal`} value={form.author} onChange={(e) => set({ author: e.target.value })} maxLength={120} />
        </label>
        <label className="block text-sm font-semibold">
          Who can read it
          <select className={`${inputClass} mt-1.5 font-normal`} value={form.courseId ?? ""} onChange={(e) => set({ courseId: e.target.value || null })}>
            <option value="">Every learner with a paid course or plan</option>
            {courses.map((c) => <option key={c.id} value={c.id}>Only buyers of “{c.title}”{c.price > 0 ? "" : " (free course)"}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">Learners with a subscription or access you granted can always read it. Free-trial learners can't.</span>
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          Description <span className="font-normal text-muted">(optional)</span>
          <textarea className={`${inputClass} mt-1.5 font-normal`} rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} />
        </label>
        <label className="block text-sm font-semibold">
          PDF file {book?.fileName && <span className="font-normal text-muted">(now: {book.fileName}{book.fileSize ? `, ${formatBytes(book.fileSize)}` : ""})</span>}
          <input type="file" accept="application/pdf,.pdf" className={`${inputClass} mt-1.5 font-normal`} onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
          {book && <span className="mt-1 block text-xs font-normal text-muted">Choose a file only to replace the PDF.</span>}
        </label>
        <div className="text-sm font-semibold">
          Cover image <span className="font-normal text-muted">(optional, JPG/PNG/WebP under 3 MB)</span>
          <div className="mt-1.5 flex items-center gap-3">
            {book && <Cover book={book} className="h-14 w-10" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" className={`${inputClass} font-normal`} onChange={(e) => setCover(e.target.files?.[0] ?? null)} aria-label="Cover image" />
          </div>
          {book?.coverUrl && !cover && (
            <button type="button" className="mt-1 text-xs font-semibold text-red-700 hover:underline" disabled={busy}
              onClick={() => adminApi.removeEbookCover(book.id).then(() => { toast("Cover removed"); onDone(); }, (e) => setError(e instanceof Error ? e.message : "Could not remove."))}>
              Remove cover
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-ink-700" checked={form.published} onChange={(e) => set({ published: e.target.checked })} />
          <span><span className="font-semibold">Published</span> <span className="text-muted">(shows in learners' E-books library)</span></span>
        </label>
        {progress !== null && (
          <div className="sm:col-span-2" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-ink-50"><div className="h-full bg-brand-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-muted">Uploading the PDF… {Math.round(progress * 100)}%</p>
          </div>
        )}
        {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}><FileUp className="h-4 w-4" aria-hidden="true" /> {busy ? "Saving…" : book ? "Save" : "Upload e-book"}</Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Admin → E-books: PDFs that learners with a paid course can read and download. */
export default function EbooksPage() {
  const { toast } = useAdmin();
  const books = useLoad(() => adminApi.listEbooks());
  const courses = useLoad(() =>
    adminApi.listContent("courses").then((rows) => rows.map((r) => {
      const d = r.data as { id: string; title: string; price?: number };
      return { id: d.id, title: d.title, price: d.price ?? 0 };
    })),
  );
  const [editing, setEditing] = useState<AdminEbook | "new" | null>(null);
  const [removing, setRemoving] = useState<AdminEbook | null>(null);

  if (books.error) return <ErrorNote message={books.error} onRetry={books.reload} />;
  if (!books.data || !courses.data) return <Loading />;
  const list = books.data;

  const move = async (i: number, dir: -1 | 1) => {
    const ids = list.map((b) => b.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    try {
      books.setData(await adminApi.reorderEbooks(ids));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reorder.", "error");
    }
  };

  return (
    <>
      <PageTitle
        title="E-books"
        description="Upload PDF e-books. Learners who have paid for a course (or have a subscription) can read them online and download them on the website and in the app."
        actions={editing === null && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" /> Add e-book</Button>}
      />
      {adminApi.mode === "demo" && (
        <Alert tone="warning" title="Demo mode" className="mb-6">E-books are stored on the server, so uploading needs the live site (VITE_API_BASE). This demo can't keep PDFs.</Alert>
      )}
      {editing !== null && (
        <Editor
          key={editing === "new" ? "new" : editing.id}
          book={editing === "new" ? null : editing}
          courses={courses.data}
          onCancel={() => setEditing(null)}
          onDone={() => { setEditing(null); books.reload(); }}
        />
      )}

      {list.length === 0 ? (
        <Empty>No e-books yet. Add one to give paid learners a PDF library on the website and in the app.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-4 shadow-card">
              <Cover book={b} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ink-900">{b.title}</h2>
                  <StatusPill status={b.published && b.fileName ? "published" : "draft"} label={b.published && b.fileName ? "Published" : b.fileName ? "Hidden" : "No PDF yet"} />
                </div>
                {b.author && <p className="text-sm text-muted">by {b.author}</p>}
                <p className="mt-1 text-sm text-body">
                  {b.courseId ? <>Only buyers of <strong>{b.courseTitle ?? b.courseId}</strong></> : "Every learner with a paid course or plan"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {b.fileName ? `${b.fileName}${b.fileSize ? ` · ${formatBytes(b.fileSize)}` : ""} · updated ${formatDate(b.updatedAt.slice(0, 10))}` : "Upload the PDF to show it to learners."}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-ink-50 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${b.title} up`}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-ink-50 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${b.title} down`}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-ink-700 hover:bg-ink-50" onClick={() => setEditing(b)} aria-label={`Edit ${b.title}`}><Pencil className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-red-700 hover:bg-red-50" onClick={() => setRemoving(b)} aria-label={`Delete ${b.title}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Confirm
        open={removing !== null}
        title="Delete this e-book?"
        body={`“${removing?.title}” and its PDF will be deleted. Learners will no longer see it.`}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await adminApi.deleteEbook(removing!.id);
            toast("E-book deleted");
            books.reload();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not delete.", "error");
          }
          setRemoving(null);
        }}
      />
    </>
  );
}
