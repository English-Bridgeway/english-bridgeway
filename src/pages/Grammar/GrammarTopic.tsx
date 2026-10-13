import { useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { LessonCard } from "../../components/LessonCard";
import { LevelBadge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { getLessonsForTopic, getTopic, grammarTopics } from "../../data/grammar";
import { useLearning } from "../../context/LearningContext";
import NotFound from "../NotFound";

export default function GrammarTopic() {
  const { topic: topicId = "" } = useParams();
  const topic = getTopic(topicId);
  const { isLessonComplete } = useLearning();
  if (!topic) return <NotFound />;
  const lessons = getLessonsForTopic(topic.id);
  const others = grammarTopics.filter((t) => t.id !== topic.id).slice(0, 6);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Grammar", to: "/grammar" }, { label: topic.title }]}
        eyebrow={
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-700"><Icon name={topic.icon} className="h-5 w-5" /></span>
            <LevelBadge level={topic.level} />
          </div>
        }
        title={topic.title}
        description={topic.summary}
      >
        <Button to={`/grammar/${topic.id}/${lessons[0].id}`}>Start first lesson</Button>
      </PageHeader>
      <section className="container-page py-10">
        <h2 className="text-xl font-semibold">Lessons in this topic</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l, i) => (
            <LessonCard key={l.id} index={i + 1} to={`/grammar/${topic.id}/${l.id}`} title={l.title} description={l.description}
              level={l.level} minutes={l.minutes} completed={isLessonComplete(`${topic.id}/${l.id}`)} />
          ))}
        </div>
        <h2 className="mt-14 text-xl font-semibold">More grammar topics</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map((t) => (
            <li key={t.id}><Button to={`/grammar/${t.id}`} variant="outline" size="sm"><Icon name={t.icon} className="h-4 w-4" />{t.title}</Button></li>
          ))}
        </ul>
      </section>
    </>
  );
}
