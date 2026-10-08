import { ArrowLeft, ArrowRight, CircleCheck, Clock, Lightbulb, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { LevelBadge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ListenButton } from "../../components/ListenButton";
import { QuizRunner } from "../../components/QuizRunner";
import { usePageMeta } from "../../hooks/usePageMeta";
import { getLesson, getLessonsForTopic, getTopic, grammarLessons } from "../../data/grammar";
import { useLearning } from "../../context/LearningContext";
import { cn } from "../../utils/cn";
import NotFound from "../NotFound";

export default function GrammarLesson() {
  const { topic: topicId = "", lesson: lessonId = "" } = useParams();
  const topic = getTopic(topicId);
  const lesson = getLesson(topicId, lessonId);
  usePageMeta({
    title: lesson ? `${lesson.title}: Rules, Examples and Practice` : "Lesson not found",
    description: lesson?.description,
    type: "article",
  });
  const { isLessonComplete, toggleLessonComplete } = useLearning();
  if (!topic || !lesson) return <NotFound />;

  const key = `${topic.id}/${lesson.id}`;
  const done = isLessonComplete(key);
  const i = grammarLessons.indexOf(lesson);
  const prev = grammarLessons[i - 1];
  const next = grammarLessons[i + 1];
  const siblings = getLessonsForTopic(topic.id);
  const toc = ["Definition", "Rules", ...lesson.sections.map((s) => s.heading), "Common mistakes", "Practice"];
  const anchor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_14rem]">
      {/* Left: lessons in topic */}
      <aside className="order-2 lg:order-1">
        <div className="lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{topic.title}</p>
          <ol className="mt-3 space-y-1">
            {siblings.map((s, n) => {
              const active = s.id === lesson.id;
              const complete = isLessonComplete(`${topic.id}/${s.id}`);
              return (
                <li key={s.id}>
                  <Link to={`/grammar/${topic.id}/${s.id}`} aria-current={active ? "page" : undefined}
                    className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm", active ? "bg-white font-semibold text-ink-900 shadow-card ring-1 ring-line" : "text-muted hover:bg-white hover:text-ink-900")}>
                    {complete ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Completed" /> : <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center text-xs tabular-nums">{n + 1}</span>}
                    {s.title}
                  </Link>
                </li>
              );
            })}
          </ol>
          <Link to="/grammar" className="mt-4 inline-block text-sm font-semibold text-ink-700 hover:text-ink-900">← All grammar topics</Link>
        </div>
      </aside>

      {/* Main lesson */}
      <article className="order-1 min-w-0 lg:order-2">
        <Breadcrumbs items={[{ label: "Grammar", to: "/grammar" }, { label: topic.title, to: `/grammar/${topic.id}` }, { label: lesson.title }]} />
        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <LevelBadge level={lesson.level} />
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> {lesson.minutes} min lesson</span>
            {done && <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CircleCheck className="h-4 w-4" aria-hidden="true" /> Completed</span>}
          </div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{lesson.title}</h1>
        </header>

        <section id="definition" className="mt-8 scroll-mt-24">
          <h2 className="text-xl font-semibold">Definition</h2>
          <div className="prose-lesson mt-3"><p>{lesson.definition}</p></div>
        </section>

        <section id="rules" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-semibold">Rules</h2>
          <ul className="mt-4 space-y-2.5">
            {lesson.rules.map((r) => (
              <li key={r} className="flex gap-3 rounded-xl bg-white p-3.5 ring-1 ring-line">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {lesson.sections.map((s) => (
          <section key={s.heading} id={anchor(s.heading)} className="mt-10 scroll-mt-24">
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            {s.structure && (
              <p className="mt-3 overflow-x-auto rounded-xl bg-ink-800 px-4 py-3 font-mono text-sm text-white">
                <span className="mr-2 text-xs uppercase tracking-wider text-amber-300">Structure</span>{s.structure}
              </p>
            )}
            {s.body && <div className="prose-lesson mt-3"><p>{s.body}</p></div>}
            {s.examples && (
              <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
                {s.examples.map((e) => (
                  <li key={e.sentence} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">{e.sentence}</p>
                      {e.note && <p className="text-sm text-muted">{e.note}</p>}
                    </div>
                    <ListenButton text={e.sentence} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section id="common-mistakes" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-semibold">Common mistakes</h2>
          <div className="mt-4 grid gap-3">
            {lesson.mistakes.map((m) => (
              <div key={m.wrong} className="rounded-2xl border border-line bg-white p-4">
                <p className="flex items-start gap-2 text-red-700"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><span className="sr-only">Incorrect: </span><s>{m.wrong}</s></span></p>
                <p className="mt-1.5 flex items-start gap-2 font-semibold text-emerald-700"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><span className="sr-only">Correct: </span>{m.right}</span></p>
                <p className="mt-1.5 pl-6 text-sm text-muted">{m.why}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="practice" className="mt-10 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" /> Practice</h2>
          <Card className="mt-4 p-5 sm:p-7">
            <QuizRunner key={lesson.id} questions={lesson.practice} title="Lesson practice" />
          </Card>
        </section>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{done ? "Nice work! This lesson is complete." : "Finished reading and practising?"}</p>
            <p className="text-sm text-muted">Your progress is saved on this device.</p>
          </div>
          <Button variant={done ? "secondary" : "primary"} onClick={() => toggleLessonComplete(key)} aria-pressed={done}>
            <CircleCheck className="h-4 w-4" aria-hidden="true" /> {done ? "Completed" : "Mark as completed"}
          </Button>
        </div>

        <nav aria-label="Lesson navigation" className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link to={`/grammar/${prev.topicId}/${prev.id}`} className="group rounded-2xl border border-line bg-white p-4 hover:border-ink-300">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous lesson</span>
              <span className="mt-1 block font-semibold group-hover:text-ink-600">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/grammar/${next.topicId}/${next.id}`} className="group rounded-2xl border border-line bg-white p-4 text-right hover:border-ink-300">
              <span className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-muted">Next lesson <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
              <span className="mt-1 block font-semibold group-hover:text-ink-600">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      {/* Right: on this page */}
      <aside className="order-3 hidden xl:block">
        <nav aria-label="On this page" className="sticky top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
          <ul className="mt-3 space-y-1 border-l border-line text-sm">
            {toc.map((t) => (
              <li key={t}><a href={`#${anchor(t)}`} onClick={(e) => { e.preventDefault(); document.getElementById(anchor(t))?.scrollIntoView({ behavior: "smooth" }); }}
                className="-ml-px block border-l border-transparent py-1 pl-3 text-muted hover:border-ink-500 hover:text-ink-900">{t}</a></li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
