import { Link } from "react-router-dom";
import { BookOpen, CircleCheck, Clock, Lock, PlayCircle } from "lucide-react";
import { courses } from "../../data/courses";
import { useAuth } from "../../context/AuthContext";
import { useCourseProgress } from "../../pages/Courses/useCourseProgress";
import { Icon } from "../../components/Icon";
import { LevelBadge } from "../../components/Badge";
import { ProgressBar } from "../../components/ProgressBar";
import { buttonClasses } from "../../components/Button";
import { AccessBanner } from "../AccessBanner";
import { BuyCourse } from "../BuyCourse";
import { formatPrice } from "../../utils/format";

/** Every course with the learner's progress, and which ones are open, bought or locked. */
export default function MyCourses() {
  const { canOpenCourse, hasCourse, priceFor } = useAuth();
  const progressFor = useCourseProgress();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold sm:text-3xl">My courses</h1>
      <p className="mt-1 text-muted">Pick up where you left off. Your progress is saved on this device.</p>
      <AccessBanner className="mt-5" />
      <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const open = canOpenCourse(c);
          const paid = Boolean(c.price && c.price > 0);
          const p = progressFor(c);
          const state = !paid ? "Free" : hasCourse(c.id) ? "Bought" : open ? "Open with your access" : "Locked";
          return (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative flex h-28 items-end bg-brand-primary p-4">
                <Icon name={c.icon} className="absolute right-4 top-4 h-14 w-14 text-white/15" strokeWidth={1.5} />
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-white"><Icon name={c.icon} className="h-6 w-6" /></span>
                <span className={`absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${open ? "bg-white text-ink-900" : "bg-ink-900/60 text-white"}`}>
                  {open ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />} {state}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <LevelBadge level={c.level} />
                <h2 className="mt-2 text-lg font-semibold"><Link to={`/learn/courses/${c.id}`} className="hover:text-ink-600">{c.title}</Link></h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                <p className="mt-3 flex gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{c.duration}</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{c.lessons} lessons</span>
                  {paid && <span className="font-semibold text-ink-800">{formatPrice(priceFor(c))}</span>}
                </p>
                <div className="mt-auto pt-5">
                  {open ? (
                    <>
                      <ProgressBar value={p.percent} label={`${p.done} of ${p.total} lessons done`} showValue />
                      <Link to={`/learn/courses/${c.id}`} className={buttonClasses("primary", "md", "mt-4 w-full")}>
                        <PlayCircle className="h-4 w-4" aria-hidden="true" /> {p.done ? "Continue" : "Start course"}
                      </Link>
                    </>
                  ) : (
                    <BuyCourse course={c} size="md" />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
