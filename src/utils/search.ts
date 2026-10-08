import { grammarLessons, grammarTopics } from "../data/grammar";
import { vocabularyWords } from "../data/vocabulary";
import { spokenLessons } from "../data/spokenEnglish";
import { courses } from "../data/courses";
import { blogPosts } from "../data/blog";
import type { SearchResult } from "../types";

// Built once from mock data. Replace with an API call (e.g. GET /search?q=) when a backend exists.
const index: (SearchResult & { haystack: string })[] = [
  ...grammarTopics.map((t) => ({ kind: "Grammar" as const, title: t.title, description: t.summary, href: `/grammar/${t.id}` })),
  ...grammarLessons.map((l) => ({ kind: "Grammar" as const, title: l.title, description: l.description, href: `/grammar/${l.topicId}/${l.id}` })),
  ...vocabularyWords.map((w) => ({ kind: "Vocabulary" as const, title: w.word, description: w.meaning, href: `/vocabulary/${w.id}`, extra: [...w.synonyms, w.category].join(" ") })),
  ...spokenLessons.map((s) => ({ kind: "Spoken English" as const, title: s.title, description: s.situation, href: `/spoken-english/${s.id}`, extra: s.category })),
  ...courses.map((c) => ({ kind: "Course" as const, title: c.title, description: c.description, href: `/courses/${c.id}` })),
  ...blogPosts.map((p) => ({ kind: "Blog" as const, title: p.title, description: p.excerpt, href: `/blog/${p.slug}`, extra: p.category })),
].map((r) => ({
  kind: r.kind, title: r.title, description: r.description, href: r.href,
  haystack: `${r.title} ${r.description} ${"extra" in r ? r.extra : ""}`.toLowerCase(),
}));

export function search(query: string, limit?: number): SearchResult[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = index
    .map((r) => {
      if (!terms.every((t) => r.haystack.includes(t))) return null;
      const title = r.title.toLowerCase();
      const score = terms.reduce((s, t) => s + (title.startsWith(t) ? 3 : title.includes(t) ? 2 : 1), 0);
      return { r, score };
    })
    .filter((x): x is { r: (typeof index)[number]; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ r }) => ({ kind: r.kind, title: r.title, description: r.description, href: r.href }));
  return limit ? scored.slice(0, limit) : scored;
}
