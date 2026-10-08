import { useLearning } from "../../context/LearningContext";
import type { Course } from "../../types";

/** Key used to mark a curriculum item done. Grammar lessons share their key with the lesson page. */
export function curriculumKey(courseId: string, href: string | undefined, index: string) {
  const m = href?.match(/^\/grammar\/([^/]+)\/([^/]+)$/);
  return m ? `${m[1]}/${m[2]}` : `course:${courseId}:${index}`;
}

export function useCourseProgress() {
  const { completedLessons } = useLearning();
  return (course: Course) => {
    const keys = course.curriculum.flatMap((mod, mi) => mod.lessons.map((l, li) => curriculumKey(course.id, l.href, `${mi}-${li}`)));
    const done = keys.filter((k) => completedLessons.includes(k)).length;
    return { done, total: keys.length, percent: keys.length ? (done / keys.length) * 100 : 0 };
  };
}
