import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { TopicCard } from "../../components/TopicCard";
import { Tabs } from "../../components/Tabs";
import { ProgressBar } from "../../components/ProgressBar";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/Button";
import { usePageMeta } from "../../hooks/usePageMeta";
import { grammarLessons, grammarTopics, getLessonsForTopic } from "../../data/grammar";
import { useLearning } from "../../context/LearningContext";
import type { Level } from "../../types";

const levels = ["All levels", "Beginner", "Intermediate", "Advanced"] as const;

export default function Grammar() {
  usePageMeta({
    title: "English Grammar Lessons",
    description: "Free English grammar lessons: tenses, nouns, pronouns, verbs, articles, prepositions, voice and reported speech, with examples and practice.",
  });
  const [level, setLevel] = useState<(typeof levels)[number]>("All levels");
  const [q, setQ] = useState("");
  const { completedLessons } = useLearning();

  const topics = useMemo(
    () => grammarTopics.filter((t) =>
      (level === "All levels" || t.level === (level as Level)) &&
      `${t.title} ${t.summary}`.toLowerCase().includes(q.toLowerCase().trim())),
    [level, q],
  );
  const doneCount = completedLessons.filter((k) => grammarLessons.some((l) => `${l.topicId}/${l.id}` === k)).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Grammar" }]}
        title="Grammar"
        description="Clear explanations, real examples and the mistakes to avoid. Choose a topic and start with its first lesson."
      >
        <div className="grid max-w-3xl gap-4 sm:grid-cols-[1fr_16rem] sm:items-end">
          <div className="relative">
            <label htmlFor="grammar-search" className="sr-only">Search grammar topics</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id="grammar-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics, e.g. articles"
              className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100" />
          </div>
          <ProgressBar value={(doneCount / grammarLessons.length) * 100} label={`${doneCount} of ${grammarLessons.length} lessons done`} showValue />
        </div>
      </PageHeader>

      <section className="container-page py-10">
        <Tabs options={levels} value={level} onChange={setLevel} label="Filter by level" className="mb-6" />
        {topics.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => {
              const lessons = getLessonsForTopic(t.id);
              const done = lessons.filter((l) => completedLessons.includes(`${t.id}/${l.id}`)).length;
              return (
                <TopicCard key={t.id} to={`/grammar/${t.id}`} icon={t.icon} title={t.title} summary={t.summary} level={t.level}
                  lessons={lessons.length} done={done} cta={done ? "Continue" : "Start lesson"} />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No topics match your search" action={<Button variant="outline" onClick={() => { setQ(""); setLevel("All levels"); }}>Clear filters</Button>}>
            Try a different word, or show all levels.
          </EmptyState>
        )}
      </section>
    </>
  );
}
