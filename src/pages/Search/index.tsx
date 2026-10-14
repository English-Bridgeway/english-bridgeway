import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Tabs } from "../../components/Tabs";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { search } from "../../utils/search";
import type { SearchKind } from "../../types";

const kinds: ("All" | SearchKind)[] = ["All", "Grammar", "Vocabulary", "Spoken English", "Course", "Blog"];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kind = (params.get("type") as (typeof kinds)[number]) || "All";

  const all = useMemo(() => search(q), [q]);
  const results = kind === "All" ? all : all.filter((r) => r.kind === kind);
  const options = kinds.map((k) => ({ value: k, label: k === "Course" ? "Courses" : k, count: k === "All" ? all.length : all.filter((r) => r.kind === k).length }));
  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader crumbs={[{ label: "Search" }]} title="Search">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-2xl">
          <label htmlFor="search-page-input" className="sr-only">Search</label>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="search-page-input" type="search" defaultValue={q} onChange={(e) => update({ q: e.target.value })} autoFocus
            placeholder="Search lessons, words, courses and articles"
            className="h-13 w-full rounded-2xl border border-line bg-white pl-12 pr-4 text-lg focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100" />
        </form>
      </PageHeader>
      <section className="container-page py-8">
        {q.trim() ? (
          <>
            <Tabs options={options} value={kind} onChange={(v) => update({ type: v === "All" ? "" : v })} label="Filter results" />
            <p className="mt-5 text-sm text-muted" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"} for “{q}”</p>
            {results.length ? (
              <ul className="mt-4 space-y-3">
                {results.map((r) => (
                  <li key={r.href}>
                    <Link to={r.href} className="block rounded-2xl border border-line bg-white p-5 transition-colors hover:border-ink-300">
                      <Badge tone="ink">{r.kind}</Badge>
                      <p className="mt-2 text-lg font-semibold text-ink-900">{r.title}</p>
                      <p className="mt-1 text-muted">{r.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4"><EmptyState title="No results found">Check the spelling or try a more general word, like “tense” or “travel”.</EmptyState></div>
            )}
          </>
        ) : (
          <p className="text-muted">Type a word above to search grammar lessons, vocabulary, spoken English lessons, courses and blog articles.</p>
        )}
      </section>
    </>
  );
}
