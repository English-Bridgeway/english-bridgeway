import { site } from "../data/site";
import { getLesson, getLessonsForTopic, getTopic } from "../data/grammar";
import { getWord } from "../data/vocabulary";
import { getSpokenLesson } from "../data/spokenEnglish";
import { getQuiz, getQuizCategory, getQuizzesForCategory } from "../data/quizzes";
import { courses, getCourse } from "../data/courses";
import { getPost } from "../data/blog";
import { businessInfo, policies, policyPages, subscriptionPlans } from "../data/policies";
import type { Level, QuizQuestion, SeoFields } from "../types";

/**
 * Search-engine data for every URL of the public site: title, description, canonical URL,
 * robots rules, social preview and schema.org JSON-LD. One function serves the browser
 * (SeoHead updates <head> on navigation) and the server (it writes the same tags into the
 * HTML that crawlers download), so both always agree.
 */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  type: "website" | "article";
  image: string;
  /** HTTP status the server should answer with. */
  status: 200 | 404;
  jsonLd: Record<string, unknown>[];
  publishedTime?: string;
}

const FALLBACK_ORIGIN = "https://englishbridgeway.com";
const INDEX = "index, follow, max-image-preview:large, max-snippet:-1";
const NOINDEX = "noindex, follow";

/** The site's public address with no trailing slash, e.g. https://englishbridgeway.com. */
export function siteOrigin(): string {
  const url = (site.url || "").trim().replace(/\/+$/, "");
  // Placeholder addresses left over from the template never become canonical URLs.
  return /^https?:\/\/[^/]+$/.test(url) && !/\.example$|localhost|127\.0\.0\.1/.test(url) ? url : FALLBACK_ORIGIN;
}

export const absoluteUrl = (pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${siteOrigin()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`);

/** Trims text to a search-friendly description length on a word boundary. */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,;:.]+$/, "")}…`;
}

const fullTitle = (title: string) => (title === site.name ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`);
const minutes = (m: number) => `PT${Math.max(1, Math.round(m))}M`;
const levelName = (l: Level) => l;

const orgId = () => `${siteOrigin()}/#organization`;
const websiteId = () => `${siteOrigin()}/#website`;

function organization() {
  const biz = businessInfo();
  const sameAs = Object.values(site.social).filter((u) => u && !/^https:\/\/www\.(youtube|instagram|facebook|linkedin)\.com\/?$/.test(u));
  return {
    "@type": "EducationalOrganization",
    "@id": orgId(),
    name: site.name,
    url: `${siteOrigin()}/`,
    logo: { "@type": "ImageObject", url: absoluteUrl("/icon-512.png"), width: 512, height: 512 },
    description: site.description,
    ...(policies.business.legalName.trim() ? { legalName: policies.business.legalName.trim() } : {}),
    ...(biz.email && !biz.email.endsWith(".example") ? { email: biz.email } : {}),
    ...(policies.business.phone.trim() ? { telephone: biz.phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(policies.business.address.trim() ? { streetAddress: biz.address.replace(/\s*\n\s*/g, ", ") } : {}),
      addressLocality: site.location.split(",")[0]?.trim(),
      addressCountry: "IN",
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function website() {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    url: `${siteOrigin()}/`,
    name: site.name,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": orgId() },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteOrigin()}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

function itemList(paths: { name: string; path: string }[]) {
  return {
    "@type": "ItemList",
    itemListElement: paths.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: absoluteUrl(p.path) })),
  };
}

const answerText = (q: QuizQuestion) => (Array.isArray(q.answer) ? q.answer[0] : q.answer);

function quizSchema(name: string, about: string, level: Level, questions: QuizQuestion[], path: string) {
  return {
    "@type": "Quiz",
    name,
    about: { "@type": "Thing", name: about },
    educationalLevel: levelName(level),
    inLanguage: "en",
    url: absoluteUrl(path),
    isAccessibleForFree: true,
    provider: { "@id": orgId() },
    hasPart: questions.map((q) => ({
      "@type": "Question",
      eduQuestionType: q.type === "mcq" ? "Multiple choice" : "Fill in the blank",
      text: q.prompt.replace(/_{2,}/g, "____"),
      ...(q.type === "mcq" && q.options
        ? {
            suggestedAnswer: q.options.filter((o) => o !== answerText(q)).map((o) => ({ "@type": "Answer", text: o })),
          }
        : {}),
      acceptedAnswer: { "@type": "Answer", text: answerText(q), answerExplanation: { "@type": "Comment", text: q.explanation } },
    })),
  };
}

interface Draft {
  title: string;
  description: string;
  type?: "website" | "article";
  noindex?: boolean;
  image?: string;
  status?: 200 | 404;
  crumbs?: { name: string; path: string }[];
  schema?: Record<string, unknown>[];
  publishedTime?: string;
  seo?: SeoFields;
}

const notFound = (what: string): Draft => ({
  title: `${what} not found`,
  description: "The page you are looking for does not exist.",
  noindex: true,
  status: 404,
});

const PRIVATE: Record<string, { title: string; description: string }> = {
  "/login": { title: "Log in", description: `Log in to ${site.name} to continue your lessons.` },
  "/register": { title: "Create your account", description: `Create a free ${site.name} account to buy courses and practise speaking live.` },
  "/dashboard": { title: "My Dashboard", description: "Track your English learning progress, quiz scores, streak and favourite words." },
  "/speak": { title: "Speak Live", description: "Practise spoken English live: voice call another learner or talk in a team room." },
  "/payment/status": { title: "Payment status", description: "Your course payment status." },
};

function draftFor(path: string, search: string): Draft {
  const parts = path.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const [section, a, b] = parts;

  if (parts.length === 0) {
    return { title: site.name, description: site.description, schema: [] };
  }
  if (PRIVATE[path]) return { ...PRIVATE[path], noindex: true };
  if (section === "admin") return { title: "Admin", description: site.description, noindex: true };
  if (section === "learn") return { title: "My learning", description: `Your ${site.name} courses, progress, AI speaking practice and profile.`, noindex: true };
  if (section === "search" && parts.length === 1) {
    const q = new URLSearchParams(search).get("q");
    return {
      title: q ? `Search results for “${q}”` : "Search",
      description: `Search ${site.name} grammar lessons, vocabulary, spoken English lessons, courses and blog articles.`,
      noindex: true,
    };
  }
  if (section === "contact" && parts.length === 1) {
    return {
      title: "Contact Us",
      description: `Contact ${site.name} by email, WhatsApp or the contact form. We reply within one working day.`,
      crumbs: [{ name: "Contact", path: "/contact" }],
      schema: [{ "@type": "ContactPage", url: absoluteUrl("/contact"), about: { "@id": orgId() } }],
    };
  }

  if (section === "pricing" && parts.length === 1) {
    const paid = courses.filter((c) => Number(c.price) > 0);
    const offers = [
      ...subscriptionPlans.map((p) => ({ name: p.name, price: p.price, path: "/pricing" })),
      ...courses.map((c) => ({ name: c.title, price: Number(c.price) || 0, path: `/courses/${c.id}` })),
    ];
    const lowest = Math.min(...[...subscriptionPlans, ...paid].map((x) => Number(x.price)).filter((n) => n > 0));
    return {
      title: "Courses and Pricing (INR)",
      description: `Prices for every ${site.name} course and subscription plan in Indian Rupees${Number.isFinite(lowest) ? `, from ₹${lowest}` : ""}. Grammar, vocabulary and spoken English lessons are free.`,
      crumbs: [{ name: "Pricing", path: "/pricing" }],
      schema: [
        {
          "@type": "OfferCatalog",
          name: `${site.name} courses and plans`,
          url: absoluteUrl("/pricing"),
          itemListElement: offers.map((o) => ({
            "@type": "Offer",
            name: o.name,
            price: o.price,
            priceCurrency: "INR",
            url: absoluteUrl(o.path),
            seller: { "@id": orgId() },
          })),
        },
      ],
    };
  }
  const policyPage = parts.length === 1 ? policyPages.find((p) => p.path === `/${section}`) : undefined;
  if (policyPage) {
    const doc = policies[policyPage.key];
    const about: Record<string, string> = {
      terms: `The terms for using ${site.name} and buying its online English courses and subscription plans, including prices in INR, payment, delivery and governing law.`,
      refunds: `How cancellations and refunds work for ${site.name} courses and subscription plans: eligibility, how to ask and how refunds are paid.`,
      privacy: `What personal information ${site.name} collects, how it is used and shared, and how to ask for it to be corrected or deleted.`,
    };
    return {
      title: doc.title,
      description: about[policyPage.key],
      crumbs: [{ name: doc.title, path: policyPage.path }],
      schema: [{ "@type": "WebPage", url: absoluteUrl(policyPage.path), ...(doc.updated ? { dateModified: doc.updated } : {}), publisher: { "@id": orgId() } }],
    };
  }

  if (section === "grammar") {
    if (!a) {
      return {
        title: "English Grammar Lessons",
        description: "Free English grammar lessons: tenses, nouns, pronouns, verbs, articles, prepositions, voice and reported speech, with examples and practice.",
        crumbs: [{ name: "Grammar", path: "/grammar" }],
      };
    }
    const topic = getTopic(a);
    if (!topic) return notFound("Topic");
    const topicCrumbs = [{ name: "Grammar", path: "/grammar" }, { name: topic.title, path: `/grammar/${topic.id}` }];
    if (!b) {
      const lessons = getLessonsForTopic(topic.id);
      return {
        title: `${topic.title}: English Grammar`,
        description: `${topic.summary} Lessons with examples, common mistakes and practice questions.`,
        crumbs: topicCrumbs,
        seo: topic.seo,
        schema: [itemList(lessons.map((l) => ({ name: l.title, path: `/grammar/${topic.id}/${l.id}` })))],
      };
    }
    const lesson = getLesson(topic.id, b);
    if (!lesson || parts.length > 3) return notFound("Lesson");
    const p = `/grammar/${topic.id}/${lesson.id}`;
    return {
      title: `${lesson.title}: Rules, Examples and Practice`,
      description: lesson.description,
      type: "article",
      crumbs: [...topicCrumbs, { name: lesson.title, path: p }],
      seo: lesson.seo,
      schema: [
        {
          "@type": ["Article", "LearningResource"],
          headline: lesson.title,
          description: lesson.description,
          url: absoluteUrl(p),
          inLanguage: "en",
          learningResourceType: "Lesson",
          educationalLevel: levelName(lesson.level),
          timeRequired: minutes(lesson.minutes),
          teaches: lesson.title,
          about: { "@type": "Thing", name: topic.title },
          isAccessibleForFree: true,
          author: { "@id": orgId() },
          publisher: { "@id": orgId() },
          image: absoluteUrl(lesson.seo?.image || site.seo.ogImage),
        },
        ...(lesson.practice.length ? [quizSchema(`${lesson.title} practice`, lesson.title, lesson.level, lesson.practice, p)] : []),
      ],
    };
  }

  if (section === "vocabulary") {
    if (!a) {
      return {
        title: "English Vocabulary Words with Meanings",
        description: "Learn English vocabulary by topic and level: pronunciation, meanings, example sentences, synonyms and antonyms, with audio.",
        crumbs: [{ name: "Vocabulary", path: "/vocabulary" }],
      };
    }
    const w = getWord(a);
    if (!w || parts.length > 2) return notFound("Word");
    const p = `/vocabulary/${w.id}`;
    return {
      title: `${w.word}: Meaning, Pronunciation and Examples`,
      description: `${w.word} ${w.pronunciation} (${w.partOfSpeech}): ${w.meaning} See example sentences, synonyms and antonyms.`,
      crumbs: [{ name: "Vocabulary", path: "/vocabulary" }, { name: w.word, path: p }],
      seo: w.seo,
      schema: [
        {
          "@type": "DefinedTerm",
          name: w.word,
          description: w.meaning,
          url: absoluteUrl(p),
          inDefinedTermSet: { "@type": "DefinedTermSet", name: `${site.name} English Vocabulary`, url: absoluteUrl("/vocabulary") },
        },
      ],
    };
  }

  if (section === "spoken-english") {
    if (!a) {
      return {
        title: "Spoken English Practice: Real Conversations",
        description: "Practise spoken English with real conversations for greetings, introductions, phone calls, shopping, restaurants, travel, office and interviews.",
        crumbs: [{ name: "Spoken English", path: "/spoken-english" }],
      };
    }
    const lesson = getSpokenLesson(a);
    if (!lesson || parts.length > 2) return notFound("Lesson");
    const p = `/spoken-english/${lesson.id}`;
    return {
      title: `${lesson.title}: Spoken English Conversation`,
      description: `${lesson.situation} Listen to the dialogue, learn useful phrases and practise speaking.`,
      type: "article",
      crumbs: [{ name: "Spoken English", path: "/spoken-english" }, { name: lesson.title, path: p }],
      seo: lesson.seo,
      schema: [
        {
          "@type": "LearningResource",
          name: lesson.title,
          description: lesson.situation,
          url: absoluteUrl(p),
          inLanguage: "en",
          learningResourceType: "Conversation practice",
          educationalLevel: levelName(lesson.level),
          timeRequired: minutes(lesson.minutes),
          isAccessibleForFree: true,
          provider: { "@id": orgId() },
        },
      ],
    };
  }

  if (section === "quiz") {
    if (!a) {
      return {
        title: "English Quizzes: Grammar, Vocabulary and Speaking",
        description: "Free English quizzes with multiple choice and fill-in-the-blank questions on grammar, tenses, articles, prepositions, vocabulary and spoken English.",
        crumbs: [{ name: "Quiz", path: "/quiz" }],
      };
    }
    const cat = getQuizCategory(a);
    if (!cat) return notFound("Quiz category");
    const catCrumbs = [{ name: "Quiz", path: "/quiz" }, { name: cat.title, path: `/quiz/${cat.id}` }];
    if (!b) {
      return {
        title: `${cat.title} Quizzes`,
        description: `${cat.description} Free ${cat.title.toLowerCase()} quizzes with instant explanations.`,
        crumbs: catCrumbs,
        seo: cat.seo,
        schema: [itemList(getQuizzesForCategory(cat.id).map((q) => ({ name: q.title, path: `/quiz/${cat.id}/${q.id}` })))],
      };
    }
    const quiz = getQuiz(cat.id, b);
    if (!quiz || parts.length > 3) return notFound("Quiz");
    const p = `/quiz/${cat.id}/${quiz.id}`;
    return {
      title: `${quiz.title} Quiz (${quiz.questions.length} Questions)`,
      description: `Take the ${quiz.title} English quiz: ${quiz.questions.length} questions with explanations. Level: ${quiz.level}.`,
      crumbs: [...catCrumbs, { name: quiz.title, path: p }],
      seo: quiz.seo,
      schema: [quizSchema(quiz.title, cat.title, quiz.level, quiz.questions, p)],
    };
  }

  if (section === "courses") {
    if (!a) {
      return {
        title: "English Courses for Every Level",
        description: `Structured English courses: ${courses.map((c) => c.title).join(", ")}. Free to start.`,
        crumbs: [{ name: "Courses", path: "/courses" }],
        schema: [itemList(courses.map((c) => ({ name: c.title, path: `/courses/${c.id}` })))],
      };
    }
    const course = getCourse(a);
    if (!course || parts.length > 2) return notFound("Course");
    const p = `/courses/${course.id}`;
    const price = course.price ?? 0;
    const workloadMinutes = course.curriculum.flatMap((m) => m.lessons).reduce((sum, l) => sum + (l.minutes || 0), 0);
    return {
      title: `${course.title} Course (${course.level}, ${course.duration})`,
      description: course.description,
      crumbs: [{ name: "Courses", path: "/courses" }, { name: course.title, path: p }],
      image: course.image,
      seo: course.seo,
      schema: [
        {
          "@type": "Course",
          name: course.title,
          description: course.description,
          url: absoluteUrl(p),
          inLanguage: "en",
          educationalLevel: levelName(course.level),
          provider: { "@id": orgId() },
          ...(course.outcomes.length ? { teaches: course.outcomes } : {}),
          isAccessibleForFree: price <= 0,
          offers: {
            "@type": "Offer",
            category: price > 0 ? "Paid" : "Free",
            price,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(p),
          },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "Online",
            ...(workloadMinutes ? { courseWorkload: minutes(workloadMinutes) } : {}),
            instructor: { "@type": "Person", name: course.instructor.name, description: course.instructor.title },
          },
        },
      ],
    };
  }

  if (section === "blog") {
    if (!a) {
      return {
        title: "English Learning Blog: Tips, Idioms and Common Mistakes",
        description: "Practical English tips, idioms, grammar explainers, vocabulary guides and common mistakes, with new posts every week.",
        crumbs: [{ name: "Blog", path: "/blog" }],
      };
    }
    const post = getPost(a);
    if (!post || parts.length > 2) return notFound("Article");
    const p = `/blog/${post.slug}`;
    return {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      crumbs: [{ name: "Blog", path: "/blog" }, { name: post.title, path: p }],
      seo: post.seo,
      schema: [
        {
          "@type": "BlogPosting",
          headline: clip(post.seo?.title || post.title, 110),
          description: post.excerpt,
          url: absoluteUrl(p),
          mainEntityOfPage: absoluteUrl(p),
          datePublished: post.date,
          dateModified: post.date,
          articleSection: post.category,
          inLanguage: "en",
          wordCount: post.content.reduce((n, blk) => n + ("text" in blk ? blk.text : JSON.stringify(blk.items)).split(/\s+/).length, 0),
          timeRequired: minutes(post.readingMinutes),
          author: { "@type": "Person", name: post.author },
          publisher: { "@id": orgId() },
          image: absoluteUrl(post.seo?.image || site.seo.ogImage),
        },
      ],
    };
  }

  return notFound("Page");
}

/** SEO data for a path such as "/grammar/tenses/present-simple" (search = "?q=..." for /search). */
export function getRouteSeo(pathname: string, search = ""): PageSeo {
  const path = `/${pathname.split("/").filter(Boolean).join("/")}`;
  const d = draftFor(path, search);
  const status = d.status ?? 200;
  const noindex = Boolean(d.noindex || d.seo?.noindex);
  const title = fullTitle(d.seo?.title?.trim() || d.title);
  const description = clip(d.seo?.description?.trim() || d.description || site.description);
  const image = absoluteUrl(d.seo?.image?.trim() || d.image || site.seo.ogImage || "/og-image.png");
  const canonical = absoluteUrl(path === "/" ? "/" : path);
  const page = {
    "@type": d.type === "article" ? "WebPage" : path === "/" ? "WebPage" : "CollectionPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: "en",
    isPartOf: { "@id": websiteId() },
    primaryImageOfPage: { "@type": "ImageObject", url: image },
  };
  const graph =
    status === 404
      ? []
      : [
          organization(),
          website(),
          ...(noindex ? [] : [page]),
          ...(d.crumbs && d.crumbs.length ? [breadcrumbs(d.crumbs)] : []),
          ...(noindex ? [] : (d.schema ?? [])),
        ];
  return {
    title,
    description,
    canonical,
    robots: noindex ? NOINDEX : INDEX,
    type: d.type ?? "website",
    image,
    status,
    jsonLd: graph.length ? [{ "@context": "https://schema.org", "@graph": graph }] : [],
    publishedTime: d.publishedTime,
  };
}

// ---- <head> tags ----

export interface HeadTag {
  tag: "meta" | "link" | "script";
  attrs: Record<string, string>;
  text?: string;
}

export function headTags(seo: PageSeo): HeadTag[] {
  const meta = (key: "name" | "property", k: string, content: string | undefined): HeadTag[] =>
    content ? [{ tag: "meta", attrs: { [key]: k, content } }] : [];
  return [
    ...meta("name", "description", seo.description),
    ...meta("name", "robots", seo.robots),
    { tag: "link", attrs: { rel: "canonical", href: seo.canonical } },
    ...meta("property", "og:site_name", site.name),
    ...meta("property", "og:locale", "en_IN"),
    ...meta("property", "og:type", seo.type),
    ...meta("property", "og:title", seo.title),
    ...meta("property", "og:description", seo.description),
    ...meta("property", "og:url", seo.canonical),
    ...meta("property", "og:image", seo.image),
    ...meta("property", "og:image:alt", seo.title),
    ...meta("property", "article:published_time", seo.publishedTime),
    ...meta("name", "twitter:card", "summary_large_image"),
    ...meta("name", "twitter:site", site.seo.twitter || undefined),
    ...meta("name", "twitter:title", seo.title),
    ...meta("name", "twitter:description", seo.description),
    ...meta("name", "twitter:image", seo.image),
    ...meta("name", "google-site-verification", site.seo.googleVerification || undefined),
    ...meta("name", "msvalidate.01", site.seo.bingVerification || undefined),
    ...seo.jsonLd.map<HeadTag>((data) => ({ tag: "script", attrs: { type: "application/ld+json" }, text: JSON.stringify(data) })),
  ];
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The page's <title> and SEO tags as HTML, for the server-rendered page. */
export function headHtml(seo: PageSeo): string {
  const tags = headTags(seo).map((t) => {
    const attrs = Object.entries({ ...t.attrs, "data-seo": "" })
      .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
      .join("");
    // JSON-LD: "<" is escaped so content can never close the script element.
    return t.tag === "meta" || t.tag === "link" ? `<${t.tag}${attrs} />` : `<script${attrs}>${(t.text ?? "").replace(/</g, "\\u003c")}</script>`;
  });
  return [`<title>${escapeText(seo.title)}</title>`, ...tags].join("\n    ");
}
