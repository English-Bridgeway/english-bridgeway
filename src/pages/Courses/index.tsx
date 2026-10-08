import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { CourseCard } from "../../components/CourseCard";
import { Tabs } from "../../components/Tabs";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/Button";
import { usePageMeta } from "../../hooks/usePageMeta";
import { courses } from "../../data/courses";
import { useCourseProgress } from "./useCourseProgress";

const levels = ["All levels", "Beginner", "Intermediate", "Advanced"] as const;
const sorts = { popular: "Most popular", rating: "Highest rated", short: "Fewest lessons" } as const;

export default function Courses() {
  usePageMeta({
    title: "English Courses for Every Level",
    description: "Structured English courses: Beginner English, Spoken English in 30 Days, Grammar Basics and English Vocabulary Mastery. Free to start.",
  });
  const [level, setLevel] = useState<(typeof levels)[number]>("All levels");
  const [sort, setSort] = useState<keyof typeof sorts>("popular");
  const [q, setQ] = useState("");
  const progressFor = useCourseProgress();

  const list = useMemo(() => {
    const term = q.toLowerCase().trim();
    const filtered = courses.filter((c) =>
      (level === "All levels" || c.level === level) && (!term || `${c.title} ${c.description}`.toLowerCase().includes(term)));
    return [...filtered].sort((a, b) =>
      sort === "rating" ? b.rating - a.rating : sort === "short" ? a.lessons - b.lessons : b.students - a.students);
  }, [level, sort, q]);

  return (
    <>
      <PageHeader crumbs={[{ label: "Courses" }]} title="Courses"
        description="Follow a structured path with a clear goal for every week. All courses are free and work on any device." />
      <section className="container-page py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs options={levels} value={level} onChange={setLevel} label="Filter by level" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <label htmlFor="course-search" className="sr-only">Search courses</label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input id="course-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses"
                className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100 sm:w-60" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)}
                className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink-900 focus:border-ink-500 focus:outline-none">
                {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        </div>
        {list.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((c) => {
              const p = progressFor(c);
              return <CourseCard key={c.id} course={c} index={courses.indexOf(c)} progress={p.done > 0 ? p.percent : undefined} />;
            })}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState title="No courses match" action={<Button variant="outline" onClick={() => { setQ(""); setLevel("All levels"); }}>Show all courses</Button>}>
              Try another level or search term.
            </EmptyState>
          </div>
        )}
      </section>
    </>
  );
}
