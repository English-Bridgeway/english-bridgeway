import type { BlogPost, Course, GrammarLesson, GrammarTopic, Quiz, QuizCategory, SpokenLesson, VocabularyWord } from "../types";
import { site, type SiteSettings } from "./site";
import { grammarLessons, grammarTopics } from "./grammar";
import { vocabularyWords } from "./vocabulary";
import { spokenLessons } from "./spokenEnglish";
import { quizCategories, quizzes } from "./quizzes";
import { courses } from "./courses";
import { blogPosts } from "./blog";

/**
 * Everything the admin panel can edit, as one bundle.
 *
 * The arrays in src/data/*.ts are the bundled defaults. At start-up main.tsx loads the
 * live bundle (from the API, or from the admin's saved demo content) and applyContent()
 * replaces the arrays' contents in place, so every page keeps importing them as before.
 */
export interface ContentCollections {
  grammarTopics: GrammarTopic[];
  grammarLessons: GrammarLesson[];
  vocabularyWords: VocabularyWord[];
  spokenLessons: SpokenLesson[];
  quizCategories: QuizCategory[];
  quizzes: Quiz[];
  courses: Course[];
  blogPosts: BlogPost[];
}

export type CollectionKey = keyof ContentCollections;

export interface ContentBundle {
  site: SiteSettings;
  collections: ContentCollections;
}

/** The field that identifies an item (and forms its URL slug) in each collection. */
export const collectionIdField: Record<CollectionKey, string> = {
  grammarTopics: "id",
  grammarLessons: "id",
  vocabularyWords: "id",
  spokenLessons: "id",
  quizCategories: "id",
  quizzes: "id",
  courses: "id",
  blogPosts: "slug",
};

const live: ContentCollections = { grammarTopics, grammarLessons, vocabularyWords, spokenLessons, quizCategories, quizzes, courses, blogPosts };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Snapshot taken before anything is applied, used to seed the database and the demo admin.
const bundled: ContentBundle = clone({ site, collections: live });

export function getBundledContent(): ContentBundle {
  return clone(bundled);
}

export function applyContent(bundle: Partial<ContentBundle> & { collections?: Partial<ContentCollections> }) {
  if (bundle.site) Object.assign(site, bundle.site, { voice: { ...site.voice, ...(bundle.site.voice ?? {}) } });
  for (const key of Object.keys(live) as CollectionKey[]) {
    const items = bundle.collections?.[key];
    if (Array.isArray(items)) {
      const target = live[key] as unknown[];
      target.splice(0, target.length, ...items);
    }
  }
}
