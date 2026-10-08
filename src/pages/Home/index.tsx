import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "../../components/Button";
import { StatCard } from "../../components/StatCard";
import { TopicCard } from "../../components/TopicCard";
import { LessonCard } from "../../components/LessonCard";
import { CourseCard } from "../../components/CourseCard";
import { SectionHeading } from "../../components/SectionHeading";
import { HeroIllustration } from "../../components/HeroIllustration";
import { WordOfTheDay } from "../../components/WordOfTheDay";
import { usePageMeta } from "../../hooks/usePageMeta";
import { site } from "../../data/site";
import { grammarLessons } from "../../data/grammar";
import { vocabularyWords } from "../../data/vocabulary";
import { spokenLessons } from "../../data/spokenEnglish";
import { quizzes } from "../../data/quizzes";
import { courses } from "../../data/courses";
import { blogPosts } from "../../data/blog";

const categories = [
  { to: "/grammar", icon: "BookOpen", title: "Grammar", summary: "Tenses, articles, prepositions and sentence building explained in plain English.", lessons: grammarLessons.length, cta: "Explore" },
  { to: "/vocabulary", icon: "Languages", title: "Vocabulary", summary: "Useful words by theme with pronunciation, examples, synonyms and opposites.", lessons: vocabularyWords.length, cta: "Explore" },
  { to: "/spoken-english", icon: "MessagesSquare", title: "Spoken English", summary: "Real conversations for greetings, phone calls, shopping, meetings and interviews.", lessons: spokenLessons.length, cta: "Explore" },
  { to: "/quiz", icon: "ListChecks", title: "Quizzes", summary: "Multiple choice and fill-in-the-blank questions with instant explanations.", lessons: quizzes.length, cta: "Explore" },
];

const findLesson = (id: string) => grammarLessons.find((l) => l.id === id)!;
const newLessons = [
  { ...findLesson("present-simple"), to: "/grammar/tenses/present-simple", category: "Grammar" },
  { to: "/vocabulary", title: "50 Common English Words", description: "Everyday words for home, work, travel and food, with meanings and example sentences.", category: "Vocabulary", level: "Beginner" as const, minutes: 15 },
  { to: "/spoken-english/introducing-yourself", title: "How to Introduce Yourself", description: "Say who you are, where you're from and what you do, naturally and confidently.", category: "Spoken English", level: "Beginner" as const, minutes: 8 },
  { to: `/blog/${blogPosts[0].slug}`, title: "Common English Mistakes", description: blogPosts[0].excerpt, category: "Blog", level: "Intermediate" as const, minutes: blogPosts[0].readingMinutes },
];

export default function Home() {
  usePageMeta({ title: site.name, description: site.description });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink-700 shadow-card">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" /> Free lessons for every level
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              Improve Your English. <span className="highlight">Speak With Confidence.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
              Learn grammar, build vocabulary, practice spoken English, and test your knowledge with simple, practical lessons.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/courses/beginner-english" size="lg">
                Start Learning <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button to="/courses" size="lg" variant="outline">Explore Courses</Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["No sign-up needed", "Listen to every word", "Instant quiz feedback"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>
          <HeroIllustration />
        </div>
      </section>

      {/* Stats */}
      <section aria-label="English-Bridgeway in numbers" className="container-page">
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {site.stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow="What you'll learn" title="Everything you need to improve your English" description="Pick a skill to focus on, or follow a course that combines all four." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => <TopicCard key={c.to} {...c} />)}
        </div>
      </section>

      {/* New lessons */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow="Fresh this week" title="New lessons" link={{ to: "/grammar", label: "Browse all lessons" }} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newLessons.map((l) => (
            <LessonCard key={l.to} to={l.to} title={l.title} description={l.description} category={l.category} level={l.level} minutes={l.minutes} />
          ))}
        </div>
      </section>

      {/* Popular courses */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow="Learners' favourites" title="Popular courses" description="Structured paths with a clear goal for every week." link={{ to: "/courses", label: "View all courses" }} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
        </div>
      </section>

      {/* Word of the day */}
      <div className="container-page mt-20">
        <WordOfTheDay />
      </div>

      {/* Final CTA */}
      <section className="container-page mt-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-line bg-white p-8 shadow-card sm:p-12 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to improve your English?</h2>
            <p className="mt-2 max-w-lg text-lg text-muted">Start with a 10-minute lesson today. Your progress is saved automatically.</p>
          </div>
          <Button to="/courses/beginner-english" size="lg" variant="accent">
            Start Learning Free <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </section>
    </>
  );
}
