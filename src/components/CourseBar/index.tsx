import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, GraduationCap } from "lucide-react";
import { getCourse } from "../../data/courses";
import { useLearning } from "../../context/LearningContext";
import { courseSteps, inCourse, useCourseProgress } from "../../pages/Courses/useCourseProgress";
import { ProgressBar } from "../ProgressBar";
import { cn } from "../../utils/cn";

/**
 * Shown under any lesson, word, conversation or quiz opened from a course (?course=id):
 * where you are in the course, and Previous / Mark done and next / Back to course.
 */
export function CourseBar({ compact }: { compact?: boolean }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const course = getCourse(params.get("course") ?? "");
  const { isLessonComplete, toggleLessonComplete } = useLearning();
  const progressFor = useCourseProgress();
  if (!course) return null;

  const steps = courseSteps(course).filter((s) => s.href);
  const i = steps.findIndex((s) => s.href === pathname);
  if (i < 0) return null;
  const step = steps[i];
  const prev = steps[i - 1];
  const next = steps[i + 1];
  const done = isLessonComplete(step.key);
  const progress = progressFor(course);

  // A slim strip at the top of the page; the full bar with the buttons sits at the bottom.
  if (compact) {
    return (
      <div className="border-b border-line bg-ink-50">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
          <Link to={`/courses/${course.id}`} className="flex min-w-0 items-center gap-2 font-semibold text-ink-900 hover:text-brand-primary">
            <GraduationCap className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
            <span className="truncate">{course.title}</span>
            <span className="font-normal text-muted tabular-nums">· Lesson {i + 1} of {steps.length}</span>
          </Link>
          {next?.href && (
            <Link to={inCourse(next.href, course.id)} onClick={() => { if (!done) toggleLessonComplete(step.key); }}
              className="inline-flex items-center gap-1 font-semibold text-brand-primary hover:underline">
              Next: {next.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <aside aria-label={`${course.title} course`} className="container-page mt-12">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={`/courses/${course.id}`} className="flex min-w-0 items-center gap-2 font-semibold text-ink-900 hover:text-brand-primary">
            <GraduationCap className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
            <span className="truncate">{course.title}</span>
          </Link>
          <span className="text-sm text-muted tabular-nums">Lesson {i + 1} of {steps.length}</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress.percent} label={`${progress.done} of ${progress.total} lessons done`} />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {prev?.href ? (
            <Link to={inCourse(prev.href, course.id)} className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-brand-primary">
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="truncate">Previous: {prev.title}</span>
            </Link>
          ) : (
            <Link to={`/courses/${course.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-brand-primary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Course overview
            </Link>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleLessonComplete(step.key)}
              aria-pressed={done}
              className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold",
                done ? "border-brand-sky bg-brand-sky text-ink-900" : "border-line bg-white text-ink-900 hover:bg-ink-50")}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> {done ? "Done" : "Mark as done"}
            </button>
            {next?.href ? (
              <Link
                to={inCourse(next.href, course.id)}
                onClick={() => { if (!done) toggleLessonComplete(step.key); }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-primary/90"
              >
                Next lesson <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to={`/courses/${course.id}`}
                onClick={() => { if (!done) toggleLessonComplete(step.key); }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-ink-900 hover:bg-amber-300"
              >
                Finish course <Check className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        {next?.href && <p className="mt-3 text-right text-xs text-muted">Up next: {next.title} · {next.minutes} min</p>}
      </div>
    </aside>
  );
}
