import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, CircleCheck, Clock, Lock, PlayCircle, Star, Users } from "lucide-react";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Badge, LevelBadge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { ProgressBar } from "../../components/ProgressBar";
import { CourseCard } from "../../components/CourseCard";
import { courses, getCourse } from "../../data/courses";
import { useLearning } from "../../context/LearningContext";
import { curriculumKey, inCourse, useCourseProgress } from "./useCourseProgress";
import { formatNumber, formatPrice } from "../../utils/format";
import { BuyCourse } from "../../portal/BuyCourse";
import { getPaymentsConfig, type PaymentsConfig } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";
import NotFound from "../NotFound";

export default function CourseDetail() {
  const { courseId = "" } = useParams();
  const course = getCourse(courseId);
  const [open, setOpen] = useState<number[]>([0]);
  const { isLessonComplete, toggleLessonComplete } = useLearning();
  const progressFor = useCourseProgress();
  const { isAuthenticated, hasCourse, canOpenCourse, priceFor, access } = useAuth();
  const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  const price = course?.price ?? 0;
  useEffect(() => {
    if (price > 0) getPaymentsConfig().then(setPayments).catch(() => setPayments({ enabled: false, mode: "sandbox", demo: false }));
  }, [price]);
  if (!course) return <NotFound />;
  const locked = price > 0 && !canOpenCourse(course);

  const progress = progressFor(course);
  const nextItem = course.curriculum.flatMap((m, mi) => m.lessons.map((l, li) => ({ l, key: curriculumKey(course.id, l.href, `${mi}-${li}`) })))
    .find((x) => x.l.href && !isLessonComplete(x.key));
  // The next unfinished lesson that has a page (some curriculum items are titles only).
  const startHref = (() => {
    const href = nextItem?.l.href ?? course.curriculum.flatMap((m) => m.lessons).find((l) => l.href)?.href;
    return href ? inCourse(href, course.id) : "/courses";
  })();
  const others = courses.filter((c) => c.id !== course.id).slice(0, 3);
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  return (
    <>
      <header className="bg-brand-primary text-white">
        <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 [&_nav_a]:text-ink-200 [&_nav_a:hover]:text-white [&_nav_span[aria-current]]:text-white [&_ol]:text-ink-300">
            <Breadcrumbs items={[{ label: "Courses", to: "/courses" }, { label: course.title }]} />
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <LevelBadge level={course.level} />
              <Badge tone="amber">{price ? formatPrice(price) : "Free"}</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-amber-400 sm:text-5xl">{course.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-100">{course.description}</p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-100">
              <li className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /> {course.rating} rating</li>
              <li className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden="true" /> {formatNumber(course.students)} students</li>
              <li className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" /> {course.duration}</li>
              <li className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" aria-hidden="true" /> {course.lessons} lessons</li>
            </ul>
            <p className="mt-6 text-sm text-ink-200">Instructor: <span className="font-semibold text-white">{course.instructor.name}</span>, {course.instructor.title}</p>
          </div>

          <Card className="self-start p-6 text-body">
            <div className="grid h-32 place-items-center rounded-xl bg-brand-primary text-white">
              <Icon name={course.icon} className="h-12 w-12" />
            </div>
            <div className="mt-5">
              <ProgressBar value={progress.percent} label={`${progress.done} of ${progress.total} lessons done`} showValue />
            </div>
            {locked ? (
              payments?.enabled === false ? (
                <>
                  <Button to="/contact" className="mt-5 w-full" size="lg">Contact us to enrol</Button>
                  <p className="mt-3 text-center text-xs text-muted">Online payment is not available right now.</p>
                </>
              ) : !isAuthenticated ? (
                <>
                  <Button to={`/login?next=${encodeURIComponent(`/courses/${course.id}`)}`} className="mt-5 w-full" size="lg">
                    <Lock className="h-5 w-5" aria-hidden="true" /> Log in to buy · {formatPrice(priceFor(course) || price)}
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted">The course is added to your account. <Link to={`/register?next=${encodeURIComponent(`/learn/courses/${course.id}`)}`} className="font-semibold text-ink-700">New here? Sign up for a free trial</Link></p>
                </>
              ) : (
                <>
                  <BuyCourse course={course} className="mt-5" />
                  <p className="mt-3 text-center text-xs text-muted">
                    {access?.trialEndsAt && access.status === "expired" ? "Your free trial has ended. " : ""}One-time payment · UPI, cards and net banking
                  </p>
                </>
              )
            ) : (
              <>
                <Button to={isAuthenticated ? `/learn/courses/${course.id}` : startHref} className="mt-5 w-full" size="lg">
                  <PlayCircle className="h-5 w-5" aria-hidden="true" /> {progress.done ? "Continue course" : "Start course"}
                </Button>
                <p className="mt-3 text-center text-xs text-muted">
                  {!price ? "Free · No sign-up needed" : hasCourse(course.id) ? "Enrolled · In your account" : access?.status === "trial" ? "Open during your free trial" : "Open with your access plan"} · Progress saved on this device
                </p>
              </>
            )}
          </Card>
        </div>
      </header>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <section>
            <h2 className="text-2xl font-semibold">What you'll learn</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((o) => (
                <li key={o} className="flex gap-2.5"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-sky" aria-hidden="true" />{o}</li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-2xl font-semibold">Course curriculum</h2>
              <p className="text-sm text-muted">{course.curriculum.length} modules · showing the first {progress.total} of {course.lessons} lessons</p>
            </div>
            <div className="mt-5 space-y-3">
              {course.curriculum.map((mod, mi) => {
                const isOpen = open.includes(mi);
                const keys = mod.lessons.map((l, li) => curriculumKey(course.id, l.href, `${mi}-${li}`));
                const doneInMod = keys.filter((k) => isLessonComplete(k)).length;
                return (
                  <div key={mod.title} className="overflow-hidden rounded-2xl border border-line bg-white">
                    <h3>
                      <button type="button" onClick={() => toggle(mi)} aria-expanded={isOpen} aria-controls={`mod-${mi}`}
                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-ink-50/50">
                        <span className="min-w-0 flex-1 font-semibold">{mod.title}</span>
                        <span className="text-xs text-muted tabular-nums">{doneInMod}/{mod.lessons.length} done</span>
                        <ChevronDown className={cn("h-5 w-5 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                      </button>
                    </h3>
                    <ul id={`mod-${mi}`} hidden={!isOpen} className="divide-y divide-line border-t border-line">
                      {mod.lessons.map((l, li) => {
                        const k = keys[li];
                        const done = isLessonComplete(k);
                        return (
                          <li key={l.title} className="flex items-center gap-3 px-4 py-3">
                            <button type="button" onClick={() => toggleLessonComplete(k)} aria-pressed={done}
                              aria-label={done ? `Mark “${l.title}” as not done` : `Mark “${l.title}” as done`}
                              className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border", done ? "border-brand-sky bg-brand-sky text-white" : "border-line hover:border-ink-400")}>
                              {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                            {l.href && !locked ? <Link to={inCourse(l.href, course.id)} className="min-w-0 flex-1 text-[0.95rem] hover:text-ink-600">{l.title}</Link> : <span className="min-w-0 flex-1">{l.title}</span>}
                            <span className="text-xs text-muted tabular-nums">{l.minutes} min</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside>
          <Card className="p-6">
            <h2 className="text-base font-semibold">Your instructor</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 font-display font-semibold text-amber-800" aria-hidden="true">
                {course.instructor.name.split(" ").map((n) => n[0]).join("")}
              </span>
              <div>
                <p className="font-semibold">{course.instructor.name}</p>
                <p className="text-sm text-muted">{course.instructor.title}</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>


      <section className="container-page">
        <h2 className="text-xl font-semibold">Other courses</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((c) => <CourseCard key={c.id} course={c} index={courses.indexOf(c)} />)}
        </div>
      </section>
    </>
  );
}
