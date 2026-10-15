// Shared domain types. Shapes mirror what a future REST/GraphQL API would return,
// so the mock data in src/data can later be swapped for fetch calls.

export type Level = "Beginner" | "Intermediate" | "Advanced";

/** Optional search-engine overrides, editable per item in the admin panel (SEO section). */
export interface SeoFields {
  /** Replaces the page title in search results and social previews. */
  title?: string;
  /** Replaces the meta description (aim for 120 to 160 characters). */
  description?: string;
  /** Social preview image (absolute URL or a path such as /og-image.png). */
  image?: string;
  /** Keeps the page out of search results and the sitemap. */
  noindex?: boolean;
}

export interface GrammarTopic {
  seo?: SeoFields;
  id: string; // slug, used in /grammar/:topic
  title: string;
  summary: string;
  level: Level;
  icon: string; // lucide icon name, resolved in components/Icon
}

export interface LessonExample {
  sentence: string;
  note?: string;
}

export interface CommonMistake {
  wrong: string;
  right: string;
  why: string;
}

export interface LessonSection {
  heading: string;
  body?: string;
  structure?: string; // formula such as "Subject + V1(s/es) + Object"
  examples?: LessonExample[];
}

export interface GrammarLesson {
  seo?: SeoFields;
  id: string; // slug, used in /grammar/:topic/:lesson
  topicId: string;
  title: string;
  level: Level;
  minutes: number;
  description: string; // SEO description and card text
  definition: string;
  rules: string[];
  sections: LessonSection[];
  mistakes: CommonMistake[];
  practice: QuizQuestion[];
}

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "phrase";

export type VocabCategory =
  | "Daily English"
  | "Business"
  | "Travel"
  | "Education"
  | "Food"
  | "Technology"
  | "Emotions"
  | "Family"
  | "Work";

export interface VocabularyWord {
  seo?: SeoFields;
  id: string; // slug, used in /vocabulary/:word
  word: string;
  pronunciation: string; // IPA
  partOfSpeech: PartOfSpeech;
  meaning: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  related: string[];
  level: Level;
  category: VocabCategory;
}

export interface DialogueLine {
  speaker: "A" | "B";
  name: string;
  text: string;
}

export interface Phrase {
  phrase: string;
  meaning: string;
}

export interface SpokenLesson {
  seo?: SeoFields;
  id: string; // slug, used in /spoken-english/:lesson
  category: string;
  title: string;
  situation: string;
  level: Level;
  minutes: number;
  dialogue: DialogueLine[];
  phrases: Phrase[];
  vocabulary: Phrase[];
  activity: string[];
}

export type QuestionType = "mcq" | "fill";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string; // use ___ for the blank
  options?: string[]; // mcq only
  answer: string | string[]; // mcq: the correct option text; fill: accepted answers
  explanation: string;
}

export interface QuizCategory {
  seo?: SeoFields;
  id: string; // slug, used in /quiz/:category
  title: string;
  description: string;
  icon: string;
}

export interface Quiz {
  seo?: SeoFields;
  id: string; // used in /quiz/:category/:quizId
  categoryId: string;
  title: string;
  level: Level;
  minutes: number;
  questions: QuizQuestion[];
}

export interface CurriculumModule {
  title: string;
  lessons: { title: string; minutes: number; href?: string }[];
}

export interface Course {
  seo?: SeoFields;
  id: string;
  title: string;
  description: string;
  level: Level;
  duration: string;
  lessons: number;
  price?: number; // undefined or 0 = free
  image?: string;
  icon: string;
  rating: number;
  students: number;
  instructor: { name: string; title: string };
  outcomes: string[];
  curriculum: CurriculumModule[];
}

export type BlogCategory =
  | "English Tips"
  | "Grammar"
  | "Vocabulary"
  | "Spoken English"
  | "Idioms"
  | "Common Mistakes"
  | "Learning Tips";

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "pairs"; items: { term: string; detail: string }[] }
  | { type: "tip"; text: string };

export interface BlogPost {
  seo?: SeoFields;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  author: string;
  date: string; // ISO yyyy-mm-dd
  readingMinutes: number;
  cover: { icon: string };
  content: BlogBlock[];
}

export type SearchKind = "Grammar" | "Vocabulary" | "Spoken English" | "Course" | "Blog";

export interface SearchResult {
  kind: SearchKind;
  title: string;
  description: string;
  href: string;
}

// Future auth integration: the shape a backend /me endpoint would return.
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarInitials: string;
  /** Profile photo URL (already includes the API base), or null. */
  avatarUrl?: string | null;
  profile?: LearnerProfile;
  createdAt?: string;
}

export interface LearnerProfile {
  whatsapp?: string;
  dateOfBirth?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
  occupation?: string;
  englishLevel?: string;
  goal?: string;
  about?: string;
}

export type AccessStatus = "unlimited" | "active" | "trial" | "expired" | "blocked";

/** What the signed-in learner can open (see server/src/services/access.ts). */
export interface LearnerAccess {
  status: AccessStatus;
  /** Every course is open (subscription, access given by the admin, or unlimited). Not during the free trial. */
  full: boolean;
  until: string | null;
  trialEndsAt: string | null;
  accessUntil: string | null;
  unlimited: boolean;
  /** May use Speak with AI. */
  ai: boolean;
}

/** One allowance (AI messages, or call seconds). "day" restarts at midnight IST; "trial" is one-off. */
export interface Allowance {
  period: "day" | "trial" | "none";
  used: number;
  /** null = no limit. */
  limit: number | null;
  remaining: number | null;
}

/** What the learner may use: lessons per course on the trial, AI tutor messages and live-call seconds. */
export interface UsageSummary {
  tier: "paid" | "trial" | "none";
  /** Lessons at the start of each course open without buying; null = every lesson. */
  freeLessons: number | null;
  ai: Allowance;
  call: Allowance;
}

/** One live call in a learner's history. */
export interface CallLogEntry {
  id: string;
  roomName: string;
  kind: "direct" | "team";
  direction: "outgoing" | "incoming" | "room";
  withNames: string;
  startedAt: string;
  endedAt: string;
  talkSeconds: number;
  outcome: "completed" | "no-answer" | "declined" | "missed" | "cancelled" | "limit" | "dropped";
}

/** A subscription plan: every course and the AI tutor for a number of months. */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  /** Rupees for the whole period. */
  price: number;
  /** 1 = monthly, 3 = quarterly, 6 = half-yearly, 12 = yearly. */
  months: number;
  /** Shown as "Best value". */
  highlight: boolean;
}

/** A special price the admin gave this learner. */
export interface LearnerOffer {
  kind: "price" | "percent";
  value: number;
  courseId: string | null;
  note: string;
  expiresAt: string | null;
}

export interface Activity {
  id: string;
  label: string;
  detail: string;
  when: string;
  kind: "lesson" | "quiz" | "word" | "course";
}
