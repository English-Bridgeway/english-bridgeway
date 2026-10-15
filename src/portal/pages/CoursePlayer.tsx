import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { Link, Navigate, Route, Routes, UNSAFE_RouteContext as RouteContext, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Crown, ExternalLink, Lock, PlayCircle } from "lucide-react";
import { buttonClasses } from "../../components/Button";
import { getCourse } from "../../data/courses";
import { useAuth } from "../../context/AuthContext";
import { useLearning } from "../../context/LearningContext";
import { courseSteps, useCourseProgress } from "../../pages/Courses/useCourseProgress";
import { ProgressBar } from "../../components/ProgressBar";
import { PageSkeleton } from "../../components/Skeleton";
import { BuyCourse } from "../BuyCourse";
import { SubscribeButton } from "../Subscribe";
import { cn } from "../../utils/cn";

// The lesson pages of the public site, shown inside the player.
const GrammarLesson = lazy(() => import("../../pages/Grammar/GrammarLesson"));
const GrammarTopic = lazy(() => import("../../pages/Grammar/GrammarTopic"));
const Grammar = lazy(() => import("../../pages/Grammar"));
const SpokenLesson = lazy(() => import("../../pages/SpokenEnglish/SpokenLesson"));
const SpokenEnglish = lazy(() => import("../../pages/SpokenEnglish"));
const Vocabulary = lazy(() => import("../../pages/Vocabulary"));
const VocabularyDetail = lazy(() => import("../../pages/Vocabulary/VocabularyDetail"));
const Quiz = lazy(() => import("../../pages/Quiz"));
const QuizCategory = lazy(() => import("../../pages/Quiz/QuizCategory"));
const QuizPlay = lazy(() => import("../../pages/Quiz/QuizPlay"));

function LessonView({ href }: { href: string }) {
  const url = new URL(href, "http://x");
  // A location of its own, so the lesson page reads its own URL while the portal keeps /learn/….
  const location = { pathname: url.pathname, search: url.search, hash: "", state: null, key: href };
  // The lesson routes are matched from the site root, not under /learn/courses/:id.
  return (
    <RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
    <Suspense fallback={<PageSkeleton />}>
      <Routes location={location}>
        <Route path="/grammar" element={<Grammar />} />
        <Route path="/grammar/:topic" element={<GrammarTopic />} />
        <Route path="/grammar/:topic/:lesson" element={<GrammarLesson />} />
        <Route path="/spoken-english" element={<SpokenEnglish />} />
        <Route path="/spoken-english/:lesson" element={<SpokenLesson />} />
        <Route path="/vocabulary" element={<Vocabulary />} />
        <Route path="/vocabulary/:word" element={<VocabularyDetail />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/:category" element={<QuizCategory />} />
        <Route path="/quiz/:category/:quizId" element={<QuizPlay />} />
        <Route path="*" element={<p className="p-8 text-muted">This lesson opens on the website. <a href={href} className="font-semibold text-ink-700 underline">Open it</a></p>} />
      </Routes>
    </Suspense>
    </RouteContext.Provider>
  );
}

/** The course player: lesson list on the side, the lesson itself in the middle, Previous / Next. */
export default function CoursePlayer() {
  const { courseId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const course = getCourse(courseId);
  const { canOpenCourse, canOpenLesson, freeLessonsFor, access } = useAuth();
  const { isLessonComplete, toggleLessonComplete } = useLearning();
  const progressFor = useCourseProgress();
  const steps = useMemo(() => (course ? courseSteps(course) : []), [course]);

  const requested = Number(params.get("step"));
  const firstOpen = steps.findIndex((s) => s.href && !isLessonComplete(s.key));
  const index = Number.isInteger(requested) && requested >= 1 && requested <= steps.length ? requested - 1 : Math.max(0, firstOpen);
  const step = steps[index];
  // Moving to another lesson brings its top into view (not on the first load).
  const shownIndex = useRef(index);
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    document.getElementById("lesson-top")?.scrollIntoView({ block: "start" });
  }, [index]);

  if (!course) return <Navigate to="/learn/courses" replace />;
  const fullyOpen = canOpenCourse(course);
  const freeCount = freeLessonsFor(course);
  const open = canOpenLesson(course, index);
  const progress = progressFor(course);
  const go = (i: number) => setParams({ step: String(i + 1) });
  const prev = index > 0 ? index - 1 : -1;
  const next = index < steps.length - 1 ? index + 1 : -1;
  const done = step ? isLessonComplete(step.key) : false;

  let n = 0;
  const outline = (
    <nav aria-label={`${course.title} lessons`} className="space-y-4">
      {course.curriculum.map((mod) => (
        <div key={mod.title}>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">{mod.title}</p>
          <ol className="mt-1.5 space-y-0.5">
            {mod.lessons.map((l) => {
              const i = n++;
              const s = steps[i];
              const isDone = isLessonComplete(s.key);
              const lessonOpen = canOpenLesson(course, i);
              return (
                <li key={`${mod.title}-${l.title}`}>
                  <button type="button" onClick={() => go(i)} aria-current={i === index ? "step" : undefined}
                    aria-label={lessonOpen ? undefined : `${l.title} (locked)`}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm", i === index ? "bg-ink-50 font-semibold text-ink-900" : "text-body hover:bg-ink-50/60", !lessonOpen && "text-muted")}>
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.65rem]", isDone && lessonOpen ? "border-brand-sky bg-brand-sky text-white" : "border-line")}>
                      {!lessonOpen ? <Lock className="h-3 w-3" aria-hidden="true" /> : isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{l.title}</span>
                    {!fullyOpen && lessonOpen && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-emerald-700">Free</span>}
                    <span className="text-xs text-muted tabular-nums">{l.minutes}m</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/learn/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-brand-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My courses
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{course.title}</h1>
        <ProgressBar value={progress.percent} label={`${progress.done} of ${progress.total} lessons done`} showValue className="max-w-xs" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="order-2 self-start rounded-2xl border border-line bg-white p-3 shadow-card lg:sticky lg:top-20 lg:order-1 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {outline}
        </aside>

        <section className="order-1 min-w-0 lg:order-2" aria-live="polite">
          <span id="lesson-top" className="block scroll-mt-20" />
          {!open ? (
            <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-50 text-ink-700"><Lock className="h-7 w-7" aria-hidden="true" /></span>
              <h2 className="mt-4 text-xl font-semibold">
                {access?.status === "blocked" ? "Your account is blocked" : freeCount > 0 ? `Lesson ${index + 1} is locked` : access?.status === "expired" && access.trialEndsAt ? "Your free trial has ended" : "This course is locked"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-muted">
                {freeCount > 0
                  ? `Your free trial includes the first ${freeCount === 1 ? "lesson" : `${freeCount} lessons`} of every course. Unlock the remaining ${steps.length - freeCount} lessons of ${course.title}: buy it once and keep it, or subscribe to open every course.`
                  : `Buy ${course.title} once and keep every lesson, or subscribe to open every course. Your progress so far is kept.`}
              </p>
              {access?.status !== "blocked" && (
                <>
                  {Boolean(course.price && course.price > 0) && <BuyCourse course={course} className="mx-auto mt-6 max-w-sm" label="Buy this course" />}
                  <SubscribeButton className="mx-auto mt-4 max-w-sm" size="md" variant={course.price ? "outline" : "primary"} />
                  <Link to="/learn/billing#plans" className={buttonClasses(course.price ? "outline" : "primary", "md", "mx-auto mt-4 flex w-full max-w-sm")}>
                    <Crown className="h-4 w-4" aria-hidden="true" /> See plans
                  </Link>
                </>
              )}
            </div>
          ) : step ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
                <p className="min-w-0 text-sm"><span className="text-muted">Lesson {index + 1} of {steps.length} ·</span> <span className="font-semibold">{step.title}</span></p>
                {step.href && (
                  <a href={step.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink-700">
                    Open full page <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-line bg-white pb-8 shadow-card">
                {step.href ? <LessonView href={step.href} /> : (
                  <div className="p-10 text-center">
                    <PlayCircle className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
                    <p className="mt-3 font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-muted">This part of the course is coming soon. Mark it done when you have practised it.</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
                <button type="button" disabled={prev < 0} onClick={() => go(prev)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-brand-primary disabled:opacity-40">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </button>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleLessonComplete(step.key)} aria-pressed={done}
                    className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", done ? "border-brand-sky bg-brand-sky text-ink-900" : "border-line bg-white text-ink-900 hover:bg-ink-50")}>
                    <Check className="h-4 w-4" aria-hidden="true" /> {done ? "Done" : "Mark as done"}
                  </button>
                  {next >= 0 ? (
                    <button type="button" onClick={() => { if (!done) toggleLessonComplete(step.key); go(next); }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-primary/90">
                      Next lesson <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <Link to="/learn/courses" onClick={() => { if (!done) toggleLessonComplete(step.key); }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-ink-900 hover:bg-amber-300">
                      Finish course <Check className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
