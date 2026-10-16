import type { BlogPost, Course, GrammarLesson, GrammarTopic, Quiz, QuizCategory, SpokenLesson, VocabularyWord } from "../types";
import { site, type SiteSettings } from "./site";
import { grammarLessons, grammarTopics } from "./grammar";
import { vocabularyWords } from "./vocabulary";
import { spokenLessons } from "./spokenEnglish";
import { quizCategories, quizzes } from "./quizzes";
import { courses } from "./courses";
import { blogPosts } from "./blog";
import { policies, subscriptionPlans, type Policies } from "./policies";
import type { SubscriptionPlan } from "../types";

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
  /** Business details and legal pages (Admin → Policies & business). */
  policies?: Policies;
  /** Subscription plans for sale, for the Pricing page. */
  plans?: SubscriptionPlan[];
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
const bundled: ContentBundle = clone({ site, collections: live, policies });

export function getBundledContent(): ContentBundle {
  return clone(bundled);
}

export function applyContent(bundle: Partial<ContentBundle> & { collections?: Partial<ContentCollections> }) {
  if (bundle.site) Object.assign(site, bundle.site, {
      voice: { ...site.voice, ...(bundle.site.voice ?? {}) },
      seo: { ...site.seo, ...(bundle.site.seo ?? {}) },
    });
  if (bundle.policies) applyPolicies(bundle.policies);
  if (Array.isArray(bundle.plans)) subscriptionPlans.splice(0, subscriptionPlans.length, ...bundle.plans);
  for (const key of Object.keys(live) as CollectionKey[]) {
    const items = bundle.collections?.[key];
    if (Array.isArray(items)) {
      const target = live[key] as unknown[];
      // Prices saved from the admin form as text ("499") are numbers to the site.
      const fixed = key === "courses" ? (items as Course[]).map((c) => ({ ...c, price: Number(c.price) || 0 })) : items;
      target.splice(0, target.length, ...fixed);
    }
  }
}

/** Saved policies over the defaults; a blank policy text keeps the default wording. */
function applyPolicies(saved: Partial<Policies>) {
  const defaults = bundled.policies!;
  policies.business = { ...defaults.business, ...(saved.business ?? {}) };
  policies.pricingNote = saved.pricingNote ?? defaults.pricingNote;
  for (const k of ["terms", "refunds", "privacy"] as const) {
    const doc = saved[k];
    policies[k] = doc?.body?.trim()
      ? { title: doc.title?.trim() || defaults[k].title, updated: doc.updated || defaults[k].updated, body: doc.body }
      : { ...defaults[k] };
  }
}
