// Shared domain types. Shapes mirror what a future REST/GraphQL API would return,
// so the mock data in src/data can later be swapped for fetch calls.

export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface GrammarTopic {
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
  id: string; // slug, used in /quiz/:category
  title: string;
  description: string;
  icon: string;
}

export interface Quiz {
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
}

export interface Activity {
  id: string;
  label: string;
  detail: string;
  when: string;
  kind: "lesson" | "quiz" | "word" | "course";
}
