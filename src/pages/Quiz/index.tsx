import { ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { QuizCard } from "../../components/QuizCard";
import { usePageMeta } from "../../hooks/usePageMeta";
import { getQuizzesForCategory, quizCategories, quizzes } from "../../data/quizzes";
import { useLearning } from "../../context/LearningContext";
import { pluralize } from "../../utils/format";

export default function Quiz() {
  usePageMeta({
    title: "English Quizzes: Grammar, Vocabulary and Speaking",
    description: "Free English quizzes with multiple choice and fill-in-the-blank questions on grammar, tenses, articles, prepositions, vocabulary and spoken English.",
  });
  const { quizScores } = useLearning();
  const taken = Object.keys(quizScores).length;

  return (
    <>
      <PageHeader crumbs={[{ label: "Quiz" }]} title="Quizzes"
        description="Test what you know with short quizzes. Every answer comes with an explanation, and your best score is saved.">
        {taken > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
            <Trophy className="h-4 w-4" aria-hidden="true" /> You've completed {pluralize(taken, "quiz", "quizzes")}
          </p>
        )}
      </PageHeader>
      <section className="container-page py-10">
        <h2 className="text-xl font-semibold">Choose a category</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {quizCategories.map((c) => {
            const n = getQuizzesForCategory(c.id);
            return (
              <Card key={c.id} interactive className="group flex flex-col p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-700 group-hover:bg-brand-primary group-hover:text-white"><Icon name={c.icon} className="h-5 w-5" /></span>
                <h3 className="mt-4 text-lg font-semibold">
                  <Link to={`/quiz/${c.id}`} className="after:absolute after:inset-0 focus:outline-none">{c.title}</Link>
                </h3>
                <p className="mt-1 flex-1 text-sm text-muted">{c.description}</p>
                <p className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted">{pluralize(n.length, "quiz", "quizzes")} · {n.reduce((s, q) => s + q.questions.length, 0)} questions</span>
                  <ArrowRight className="h-4 w-4 text-ink-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </p>
              </Card>
            );
          })}
        </div>

        <h2 className="mt-14 text-xl font-semibold">All quizzes</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {quizzes.map((q) => <QuizCard key={q.id} quiz={q} best={quizScores[q.id]} />)}
        </div>
      </section>
    </>
  );
}
