import { useLearning } from "../../context/LearningContext";
import { useAuth } from "../../context/AuthContext";
import { courses } from "../../data/courses";
import type { Course } from "../../types";

/** Key used to mark a curriculum item done. Grammar lessons share their key with the lesson page. */
export function curriculumKey(courseId: string, href: string | undefined, index: string) {
  const m = href?.match(/^\/grammar\/([^/]+)\/([^/]+)$/);
  return m ? `${m[1]}/${m[2]}` : `course:${courseId}:${index}`;
}

export interface CourseStep {
  title: string;
  minutes: number;
  href?: string;
  key: string;
}

/** Every lesson of a course in order, with its progress key. */
export function courseSteps(course: Course): CourseStep[] {
  return course.curriculum.flatMap((mod, mi) =>
    mod.lessons.map((l, li) => ({ title: l.title, minutes: l.minutes, href: l.href, key: curriculumKey(course.id, l.href, `${mi}-${li}`) })),
  );
}

/** A lesson link that keeps the course bar (previous / next lesson) on the page it opens. */
export function inCourse(href: string, courseId: string) {
  return `${href}${href.includes("?") ? "&" : "?"}course=${encodeURIComponent(courseId)}`;
}

export function useCourseProgress() {
  const { completedLessons } = useLearning();
  return (course: Course) => {
    const keys = courseSteps(course).map((s) => s.key);
    const done = keys.filter((k) => completedLessons.includes(k)).length;
    return { done, total: keys.length, percent: keys.length ? (done / keys.length) * 100 : 0 };
  };
}

/**
 * Where "Start learning" goes: the next lesson of a course the learner has started, otherwise
 * the first lesson of the first free course, otherwise the course list.
 */
export function useStartLearning(): { to: string; resume: boolean; course?: Course } {
  const { completedLessons } = useLearning();
  const { hasCourse } = useAuth();
  const open = courses.filter((c) => !(c.price && c.price > 0) || hasCourse(c.id));
  for (const c of open) {
    const steps = courseSteps(c).filter((s) => s.href);
    const started = steps.some((s) => completedLessons.includes(s.key));
    const next = steps.find((s) => !completedLessons.includes(s.key));
    if (started && next?.href) return { to: inCourse(next.href, c.id), resume: true, course: c };
  }
  const first = open.find((c) => courseSteps(c).some((s) => s.href));
  const firstStep = first && courseSteps(first).find((s) => s.href);
  return first && firstStep?.href ? { to: inCourse(firstStep.href, first.id), resume: false, course: first } : { to: "/courses", resume: false };
}
