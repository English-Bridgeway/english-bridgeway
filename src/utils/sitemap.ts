import { grammarLessons, grammarTopics } from "../data/grammar";
import { vocabularyWords } from "../data/vocabulary";
import { spokenLessons } from "../data/spokenEnglish";
import { quizCategories, quizzes } from "../data/quizzes";
import { courses } from "../data/courses";
import { blogPosts } from "../data/blog";
import type { CollectionKey } from "../data/content";
import { absoluteUrl } from "../seo/routeSeo";
import type { SeoFields } from "../types";

export interface SitemapEntry {
  path: string;
  /** Collection and key of the item behind the page, for its last-modified date. */
  source?: { collection: CollectionKey; key: string };
  lastmod?: string;
}

const indexable = (item: { seo?: SeoFields }) => !item.seo?.noindex;

/** Every public, indexable URL of the site (items marked "Hide from search engines" are left out). */
export function getSitemapEntries(): SitemapEntry[] {
  const item = (collection: CollectionKey, key: string, path: string, lastmod?: string): SitemapEntry => ({ path, source: { collection, key }, lastmod });
  return [
    ...["/", "/grammar", "/vocabulary", "/spoken-english", "/quiz", "/courses", "/blog", "/contact"].map((path) => ({ path })),
    ...grammarTopics.filter(indexable).map((t) => item("grammarTopics", t.id, `/grammar/${t.id}`)),
    ...grammarLessons.filter(indexable).map((l) => item("grammarLessons", l.id, `/grammar/${l.topicId}/${l.id}`)),
    ...vocabularyWords.filter(indexable).map((w) => item("vocabularyWords", w.id, `/vocabulary/${w.id}`)),
    ...spokenLessons.filter(indexable).map((s) => item("spokenLessons", s.id, `/spoken-english/${s.id}`)),
    ...quizCategories.filter(indexable).map((c) => item("quizCategories", c.id, `/quiz/${c.id}`)),
    ...quizzes.filter(indexable).map((q) => item("quizzes", q.id, `/quiz/${q.categoryId}/${q.id}`)),
    ...courses.filter(indexable).map((c) => item("courses", c.id, `/courses/${c.id}`)),
    ...blogPosts.filter(indexable).map((p) => item("blogPosts", p.slug, `/blog/${p.slug}`, p.date)),
  ];
}

/** Every public URL in the app. */
export function getAllPaths(): string[] {
  return getSitemapEntries().map((e) => e.path);
}

/**
 * sitemap.xml for search engines. The API server serves it at /sitemap.xml with the
 * live content, passing each item's last-saved date from the database.
 */
export function buildSitemapXml(lastmod?: (collection: CollectionKey, key: string) => string | undefined): string {
  const urls = getSitemapEntries()
    .map((e) => {
      const date = (e.source && lastmod?.(e.source.collection, e.source.key)) || e.lastmod;
      return `  <url><loc>${absoluteUrl(e.path)}</loc>${date ? `<lastmod>${date.slice(0, 10)}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
