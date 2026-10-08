import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../Modal";
import { Badge } from "../Badge";
import { search } from "../../utils/search";
import { useDebounce } from "../../hooks/useDebounce";

const suggestions = ["present simple", "articles", "interview", "idioms", "travel"];

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 120);
  const navigate = useNavigate();
  const results = search(dq, 8);

  const close = () => { setQ(""); onClose(); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Search English-Bridgeway" hideTitle>
      <form onSubmit={submit} role="search" className="flex items-center gap-3 border-b border-line px-4">
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <label htmlFor="global-search" className="sr-only">Search lessons, words, courses and articles</label>
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search lessons, words, courses…"
          className="h-14 w-full bg-transparent text-base focus:outline-none"
          autoComplete="off"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-xs text-muted sm:block">Esc</kbd>
      </form>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {!dq.trim() && (
          <div className="p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Try searching for</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full bg-ink-50 px-3 py-1.5 text-sm text-ink-800 hover:bg-ink-100">{s}</button>
              ))}
            </div>
          </div>
        )}
        {dq.trim() && results.length === 0 && (
          <p className="p-6 text-center text-muted">No results for “{dq}”. Try a shorter word.</p>
        )}
        {results.length > 0 && (
          <ul>
            {results.map((r) => (
              <li key={r.href}>
                <Link to={r.href} onClick={close} className="flex items-start gap-3 rounded-xl p-3 hover:bg-ink-50 focus:bg-ink-50">
                  <Badge tone="ink" className="mt-0.5 shrink-0">{r.kind}</Badge>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900">{r.title}</span>
                    <span className="block truncate text-sm text-muted">{r.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {dq.trim() && results.length > 0 && (
          <Link to={`/search?q=${encodeURIComponent(dq.trim())}`} onClick={close} className="mt-1 flex items-center justify-center gap-1 rounded-xl p-3 text-sm font-semibold text-ink-700 hover:bg-ink-50">
            See all results <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </Modal>
  );
}
