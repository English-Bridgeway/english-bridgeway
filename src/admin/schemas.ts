import type { CollectionKey } from "../data/content";
import { vocabCategories } from "../data/vocabulary";
import { blogCategories } from "../data/blog";
import { spokenCategories } from "../data/spokenEnglish";

/**
 * Form definitions for every content type the admin panel edits. The shapes match
 * src/types, so whatever is saved here renders on the website without code changes.
 */

type Item = Record<string, unknown>;

export interface FieldBase {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Only shown (and saved) when this returns true for the surrounding item. */
  showIf?: (item: Item) => boolean;
  wide?: boolean;
}

export type Field =
  | (FieldBase & { type: "text" | "textarea" | "icon" | "color" | "date"; format?: (v: unknown) => string; parse?: (s: string, item: Item) => unknown })
  | (FieldBase & { type: "number"; step?: number; min?: number })
  | (FieldBase & { type: "select"; options?: readonly string[]; optionsFrom?: CollectionKey })
  | (FieldBase & { type: "lines" }) // string[] — one per line
  | (FieldBase & { type: "rows"; sep: string; parts: { key: string; number?: boolean; optional?: boolean }[] }) // object[] — one per line
  | (FieldBase & { type: "group"; fields: Field[] })
  | (FieldBase & { type: "list"; fields: Field[]; itemLabel: (item: Item, i: number) => string; newItem: () => Item });

export interface CollectionSchema {
  key: CollectionKey;
  label: string; // plural
  singular: string;
  group: string;
  publicPath: (item: Item) => string;
  titleField: string;
  subtitle: (item: Item) => string;
  slugFrom: string; // field the slug is suggested from
  fields: Field[];
  newItem: () => Item;
}

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const level: Field = { name: "level", label: "Level", type: "select", options: LEVELS, required: true };
const minutes: Field = { name: "minutes", label: "Minutes", type: "number", min: 1, required: true };
const iconHint = "A Lucide icon name, e.g. BookOpen, Clock, MessagesSquare (lucide.dev/icons).";

const lineList = (v: unknown) => (Array.isArray(v) ? v.join("\n") : "");
const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

const questionFields: Field[] = [
  { name: "type", label: "Question type", type: "select", options: ["mcq", "fill"], required: true, hint: "mcq = multiple choice, fill = fill in the blank" },
  { name: "prompt", label: "Question", type: "textarea", required: true, hint: "Use ___ for the blank.", wide: true },
  { name: "options", label: "Options (one per line)", type: "lines", showIf: (q) => q.type === "mcq", required: true },
  {
    name: "answer",
    label: "Correct answer",
    type: "text",
    required: true,
    hint: "Multiple choice: the exact option text. Fill in: accepted answers separated by |",
    format: (v) => (Array.isArray(v) ? v.join(" | ") : String(v ?? "")),
    parse: (s, q) => (q.type === "fill" ? s.split("|").map((x) => x.trim()).filter(Boolean) : s.trim()),
  },
  { name: "explanation", label: "Explanation", type: "textarea", required: true, wide: true },
];

const questions = (name: string, label: string): Field => ({
  name,
  label,
  type: "list",
  wide: true,
  fields: questionFields,
  itemLabel: (q, i) => `Q${i + 1}. ${String(q.prompt || "New question")}`,
  newItem: () => ({ id: `q${Date.now().toString(36)}`, type: "mcq", prompt: "", options: "", answer: "", explanation: "" }),
});

const phraseRows = (name: string, label: string): Field => ({
  name, label, type: "rows", sep: " :: ", parts: [{ key: "phrase" }, { key: "meaning" }], hint: "One per line: phrase :: meaning", wide: true,
});

export const schemas: CollectionSchema[] = [
  {
    key: "grammarTopics",
    label: "Grammar topics",
    singular: "grammar topic",
    group: "Grammar",
    publicPath: (t) => `/grammar/${t.id}`,
    titleField: "title",
    subtitle: (t) => `${t.level}`,
    slugFrom: "title",
    newItem: () => ({ title: "", summary: "", level: "Beginner", icon: "BookOpen" }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      level,
      { name: "icon", label: "Icon", type: "icon", hint: iconHint, required: true },
      { name: "summary", label: "Summary", type: "textarea", required: true, wide: true },
    ],
  },
  {
    key: "grammarLessons",
    label: "Grammar lessons",
    singular: "grammar lesson",
    group: "Grammar",
    publicPath: (l) => `/grammar/${l.topicId}/${l.id}`,
    titleField: "title",
    subtitle: (l) => `${l.topicId} · ${l.level} · ${l.minutes} min`,
    slugFrom: "title",
    newItem: () => ({ topicId: "", title: "", level: "Beginner", minutes: 10, description: "", definition: "", rules: [], sections: [], mistakes: [], practice: [] }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "topicId", label: "Topic", type: "select", optionsFrom: "grammarTopics", required: true },
      level,
      minutes,
      { name: "description", label: "Short description (cards and search engines)", type: "textarea", required: true, wide: true },
      { name: "definition", label: "Definition", type: "textarea", required: true, wide: true },
      { name: "rules", label: "Key rules (one per line)", type: "lines", wide: true },
      {
        name: "sections",
        label: "Sections",
        type: "list",
        wide: true,
        itemLabel: (s) => String(s.heading || "New section"),
        newItem: () => ({ heading: "", body: "", structure: "", examples: "" }),
        fields: [
          { name: "heading", label: "Heading", type: "text", required: true },
          { name: "structure", label: "Structure / formula", type: "text", hint: "e.g. Subject + base verb + object" },
          { name: "body", label: "Text", type: "textarea", wide: true },
          { name: "examples", label: "Examples", type: "rows", sep: " :: ", parts: [{ key: "sentence" }, { key: "note", optional: true }], hint: "One per line: sentence :: optional note", wide: true },
        ],
      },
      {
        name: "mistakes",
        label: "Common mistakes",
        type: "list",
        wide: true,
        itemLabel: (m) => String(m.wrong || "New mistake"),
        newItem: () => ({ wrong: "", right: "", why: "" }),
        fields: [
          { name: "wrong", label: "Wrong", type: "text", required: true },
          { name: "right", label: "Right", type: "text", required: true },
          { name: "why", label: "Why", type: "textarea", required: true, wide: true },
        ],
      },
      questions("practice", "Practice questions"),
    ],
  },
  {
    key: "vocabularyWords",
    label: "Vocabulary",
    singular: "word",
    group: "Vocabulary",
    publicPath: (w) => `/vocabulary/${w.id}`,
    titleField: "word",
    subtitle: (w) => `${w.partOfSpeech} · ${w.category} · ${w.level}`,
    slugFrom: "word",
    newItem: () => ({ word: "", pronunciation: "", partOfSpeech: "noun", meaning: "", examples: [], synonyms: [], antonyms: [], related: [], level: "Beginner", category: "Daily English" }),
    fields: [
      { name: "word", label: "Word", type: "text", required: true },
      { name: "pronunciation", label: "Pronunciation (IPA)", type: "text", hint: "e.g. /ˈpʌŋk.tʃu.əl/" },
      { name: "partOfSpeech", label: "Part of speech", type: "select", options: ["noun", "verb", "adjective", "adverb", "phrase"], required: true },
      { name: "category", label: "Category", type: "select", options: vocabCategories, required: true },
      level,
      { name: "meaning", label: "Meaning", type: "textarea", required: true, wide: true },
      { name: "examples", label: "Example sentences (one per line)", type: "lines", wide: true },
      { name: "synonyms", label: "Synonyms (one per line)", type: "lines" },
      { name: "antonyms", label: "Opposites (one per line)", type: "lines" },
      { name: "related", label: "Related words (one per line)", type: "lines" },
    ],
  },
  {
    key: "spokenLessons",
    label: "Spoken English",
    singular: "spoken lesson",
    group: "Spoken English",
    publicPath: (l) => `/spoken-english/${l.id}`,
    titleField: "title",
    subtitle: (l) => `${l.category} · ${l.level} · ${l.minutes} min`,
    slugFrom: "title",
    newItem: () => ({ title: "", category: spokenCategories[0], situation: "", level: "Beginner", minutes: 8, dialogue: [], phrases: [], vocabulary: [], activity: [] }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: spokenCategories, required: true },
      level,
      minutes,
      { name: "situation", label: "Situation", type: "textarea", required: true, wide: true },
      {
        name: "dialogue",
        label: "Dialogue",
        type: "list",
        wide: true,
        itemLabel: (d) => `${d.name || "Speaker"}: ${String(d.text || "").slice(0, 60)}`,
        newItem: () => ({ speaker: "A", name: "", text: "" }),
        fields: [
          { name: "speaker", label: "Side", type: "select", options: ["A", "B"], required: true },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "text", label: "Line", type: "textarea", required: true, wide: true },
        ],
      },
      phraseRows("phrases", "Useful phrases"),
      phraseRows("vocabulary", "Vocabulary"),
      { name: "activity", label: "Speaking activity steps (one per line)", type: "lines", wide: true },
    ],
  },
  {
    key: "quizCategories",
    label: "Quiz categories",
    singular: "quiz category",
    group: "Quizzes",
    publicPath: (c) => `/quiz/${c.id}`,
    titleField: "title",
    subtitle: (c) => String(c.description ?? ""),
    slugFrom: "title",
    newItem: () => ({ title: "", description: "", icon: "ListChecks" }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "icon", label: "Icon", type: "icon", hint: iconHint, required: true },
      { name: "description", label: "Description", type: "textarea", required: true, wide: true },
    ],
  },
  {
    key: "quizzes",
    label: "Quizzes",
    singular: "quiz",
    group: "Quizzes",
    publicPath: (q) => `/quiz/${q.categoryId}/${q.id}`,
    titleField: "title",
    subtitle: (q) => `${q.categoryId} · ${q.level} · ${Array.isArray(q.questions) ? q.questions.length : 0} questions`,
    slugFrom: "title",
    newItem: () => ({ title: "", categoryId: "", level: "Beginner", minutes: 8, questions: [] }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "categoryId", label: "Category", type: "select", optionsFrom: "quizCategories", required: true },
      level,
      minutes,
      questions("questions", "Questions"),
    ],
  },
  {
    key: "courses",
    label: "Courses",
    singular: "course",
    group: "Courses",
    publicPath: (c) => `/courses/${c.id}`,
    titleField: "title",
    subtitle: (c) => `${c.level} · ${c.duration} · ${Number(c.price) > 0 ? `₹${c.price}` : "Free"}`,
    slugFrom: "title",
    newItem: () => ({ title: "", description: "", level: "Beginner", duration: "30 Days", lessons: 10, price: 0, icon: "GraduationCap", rating: 5, students: 0, instructor: { name: "", title: "" }, outcomes: [], curriculum: [] }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "price", label: "Price (₹)", type: "number", min: 0, hint: "0 makes the course free. A price shows a Buy button with Cashfree checkout." },
      level,
      { name: "duration", label: "Duration", type: "text", required: true, hint: "e.g. 30 Days, 6 Weeks" },
      { name: "lessons", label: "Number of lessons", type: "number", min: 1, required: true },
      { name: "icon", label: "Icon", type: "icon", hint: iconHint, required: true },
      { name: "rating", label: "Rating", type: "number", step: 0.1, min: 0 },
      { name: "students", label: "Students", type: "number", min: 0 },
      { name: "description", label: "Description", type: "textarea", required: true, wide: true },
      { name: "instructor", label: "Instructor", type: "group", wide: true, fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "title", label: "Title / experience", type: "text", required: true },
      ] },
      { name: "outcomes", label: "What you'll learn (one per line)", type: "lines", wide: true },
      {
        name: "curriculum",
        label: "Curriculum modules",
        type: "list",
        wide: true,
        itemLabel: (m) => String(m.title || "New module"),
        newItem: () => ({ title: "", lessons: "" }),
        fields: [
          { name: "title", label: "Module title", type: "text", required: true, wide: true },
          { name: "lessons", label: "Lessons", type: "rows", sep: " | ", parts: [{ key: "title" }, { key: "minutes", number: true }, { key: "href", optional: true }], hint: "One per line: title | minutes | optional link such as /grammar/tenses/present-simple", wide: true },
        ],
      },
    ],
  },
  {
    key: "blogPosts",
    label: "Blog posts",
    singular: "blog post",
    group: "Blog",
    publicPath: (p) => `/blog/${p.slug}`,
    titleField: "title",
    subtitle: (p) => `${p.category} · ${p.date} · ${p.author}`,
    slugFrom: "title",
    newItem: () => ({ title: "", excerpt: "", category: blogCategories[0], author: "", date: new Date().toISOString().slice(0, 10), readingMinutes: 5, cover: { icon: "BookOpen" }, content: [] }),
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "category", label: "Category", type: "select", options: blogCategories, required: true },
      { name: "author", label: "Author", type: "text", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "readingMinutes", label: "Reading time (minutes)", type: "number", min: 1, required: true },
      { name: "excerpt", label: "Excerpt", type: "textarea", required: true, wide: true },
      { name: "cover", label: "Cover art", type: "group", wide: true, fields: [
        { name: "icon", label: "Icon", type: "icon", hint: iconHint, required: true },
      ] },
      {
        name: "content",
        label: "Article content",
        type: "list",
        wide: true,
        itemLabel: (b) => `${({ p: "Paragraph", h2: "Heading", list: "List", pairs: "Wrong → right pairs", tip: "Tip box" } as Record<string, string>)[String(b.type)] ?? "Block"}: ${String(b.text || b.items || "").slice(0, 60)}`,
        newItem: () => ({ type: "p", text: "", items: "" }),
        fields: [
          { name: "type", label: "Block type", type: "select", options: ["p", "h2", "list", "pairs", "tip"], required: true, hint: "p = paragraph, h2 = heading, list = bullet list, pairs = term :: detail, tip = highlighted tip" },
          { name: "text", label: "Text", type: "textarea", required: true, wide: true, showIf: (b) => ["p", "h2", "tip"].includes(String(b.type)) },
          {
            name: "items",
            label: "Items (one per line)",
            type: "textarea",
            required: true,
            wide: true,
            hint: "For pairs, write: term :: detail",
            showIf: (b) => b.type === "list" || b.type === "pairs",
            format: (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : `${(x as Item).term} :: ${(x as Item).detail}`)).join("\n") : String(v ?? "")),
            parse: (s, b) => {
              const rows = splitLines(s);
              return b.type === "pairs" ? rows.map((r) => { const [term, ...rest] = r.split("::"); return { term: term.trim(), detail: rest.join("::").trim() }; }) : rows;
            },
          },
        ],
      },
    ],
  },
];

export const schemaFor = (key: string) => schemas.find((s) => s.key === key);

// ---- Converting between saved data and form values ----
// Forms keep everything as strings while editing; values are parsed back on save.

export function toForm(fields: Field[], data: Item): Item {
  const out: Item = { ...data };
  for (const f of fields) {
    const v = data[f.name];
    switch (f.type) {
      case "lines":
        out[f.name] = lineList(v);
        break;
      case "rows":
        out[f.name] = Array.isArray(v) ? v.map((row) => f.parts.map((p) => (row as Item)[p.key] ?? "").join(f.sep).replace(new RegExp(`(${escape(f.sep)})+$`), "")).join("\n") : String(v ?? "");
        break;
      case "number":
        out[f.name] = v === undefined || v === null ? "" : String(v);
        break;
      case "group":
        out[f.name] = toForm(f.fields, (v as Item) ?? {});
        break;
      case "list":
        out[f.name] = Array.isArray(v) ? v.map((item) => toForm(f.fields, item as Item)) : [];
        break;
      case "text":
      case "textarea":
        out[f.name] = f.format ? f.format(v) : String(v ?? "");
        break;
      default:
        out[f.name] = v ?? "";
    }
  }
  return out;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fromForm(fields: Field[], form: Item): Item {
  const out: Item = { ...form };
  for (const f of fields) {
    const v = form[f.name];
    if (f.showIf && !f.showIf(form)) {
      delete out[f.name];
      continue;
    }
    switch (f.type) {
      case "lines":
        out[f.name] = splitLines(String(v ?? ""));
        break;
      case "rows":
        out[f.name] = splitLines(String(v ?? "")).map((line) => {
          const cells = line.split(f.sep.trim()).map((c) => c.trim());
          const row: Item = {};
          f.parts.forEach((p, i) => {
            const cell = cells[i] ?? "";
            if (!cell && p.optional) return;
            row[p.key] = p.number ? Number(cell) || 0 : cell;
          });
          return row;
        });
        break;
      case "number": {
        const s = String(v ?? "").trim();
        if (s === "") delete out[f.name];
        else out[f.name] = Number(s);
        break;
      }
      case "group":
        out[f.name] = fromForm(f.fields, (v as Item) ?? {});
        break;
      case "list":
        out[f.name] = Array.isArray(v) ? v.map((item) => fromForm(f.fields, item as Item)) : [];
        break;
      case "text":
      case "textarea": {
        const s = String(v ?? "");
        const parsed = f.parse ? f.parse(s, form) : s.trim();
        if (parsed === "" && !f.required) delete out[f.name];
        else out[f.name] = parsed;
        break;
      }
      default:
        out[f.name] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

/** Returns "Field label: problem" messages for empty required fields. */
export function validate(fields: Field[], form: Item, prefix = ""): string[] {
  const problems: string[] = [];
  for (const f of fields) {
    if (f.showIf && !f.showIf(form)) continue;
    const v = form[f.name];
    const label = prefix + f.label;
    if (f.type === "group") problems.push(...validate(f.fields, (v as Item) ?? {}, `${label} → `));
    else if (f.type === "list") (Array.isArray(v) ? v : []).forEach((item, i) => problems.push(...validate(f.fields, item as Item, `${label} #${i + 1} → `)));
    else if (f.required && String(v ?? "").trim() === "") problems.push(`${label} is required.`);
    else if (f.type === "number" && String(v ?? "").trim() !== "" && Number.isNaN(Number(v))) problems.push(`${label} must be a number.`);
  }
  return problems;
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}
