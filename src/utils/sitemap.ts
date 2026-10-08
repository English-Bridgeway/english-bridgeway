import { grammarLessons, grammarTopics } from "../data/grammar";
import { vocabularyWords } from "../data/vocabulary";
import { spokenLessons } from "../data/spokenEnglish";
import { quizCategories, quizzes } from "../data/quizzes";
import { courses } from "../data/courses";
import { blogPosts } from "../data/blog";
import { site } from "../data/site";

/** Every public URL in the app. Use it to generate sitemap.xml at build time or from a server. */
export function getAllPaths(): string[] {
  return [
    "/", "/grammar", "/vocabulary", "/spoken-english", "/quiz", "/courses", "/blog", "/contact",
    ...grammarTopics.map((t) => `/grammar/${t.id}`),
    ...grammarLessons.map((l) => `/grammar/${l.topicId}/${l.id}`),
    ...vocabularyWords.map((w) => `/vocabulary/${w.id}`),
    ...spokenLessons.map((s) => `/spoken-english/${s.id}`),
    ...quizCategories.map((c) => `/quiz/${c.id}`),
    ...quizzes.map((q) => `/quiz/${q.categoryId}/${q.id}`),
    ...courses.map((c) => `/courses/${c.id}`),
    ...blogPosts.map((p) => `/blog/${p.slug}`),
  ];
}

export function buildSitemapXml(): string {
  const urls = getAllPaths().map((p) => `  <url><loc>${site.url}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
