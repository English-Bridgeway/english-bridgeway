import { BookOpen, Clock, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { Course } from "../../types";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { Badge, LevelBadge } from "../Badge";
import { ProgressBar } from "../ProgressBar";
import { buttonClasses } from "../Button";
import { formatNumber, formatPrice } from "../../utils/format";

export function CourseCard({ course, progress }: { course: Course; index?: number; progress?: number }) {
  const free = !course.price;
  return (
    <Card interactive className="flex h-full flex-col overflow-hidden">
      <div className="relative flex h-36 items-end bg-brand-primary p-5">
        <Icon name={course.icon} className="absolute right-5 top-5 h-16 w-16 text-white/15" strokeWidth={1.5} />
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
          <Icon name={course.icon} className="h-6 w-6" />
        </span>
        <Badge tone={free ? "amber" : "neutral"} className="absolute left-5 top-5">{free ? "Free" : formatPrice(course.price!)}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge level={course.level} />
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-900">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /> {course.rating.toFixed(1)}
            <span className="sr-only">out of 5</span>
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold">
          <Link to={`/courses/${course.id}`} className="after:absolute after:inset-0 focus:outline-none">{course.title}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{course.description}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
          <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /><dt className="sr-only">Duration</dt><dd>{course.duration}</dd></div>
          <div className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /><dt className="sr-only">Lessons</dt><dd>{course.lessons} lessons</dd></div>
          <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /><dt className="sr-only">Students</dt><dd>{formatNumber(course.students)}</dd></div>
        </dl>
        <div className="mt-auto pt-5">
          {progress !== undefined ? (
            <ProgressBar value={progress} label="Your progress" showValue />
          ) : (
            <span className={buttonClasses("outline", "sm", "w-full")}>View course</span>
          )}
        </div>
      </div>
    </Card>
  );
}
