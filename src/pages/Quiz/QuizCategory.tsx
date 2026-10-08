import { useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { QuizCard } from "../../components/QuizCard";
import { Icon } from "../../components/Icon";
import { usePageMeta } from "../../hooks/usePageMeta";
import { getQuizCategory, getQuizzesForCategory } from "../../data/quizzes";
import { useLearning } from "../../context/LearningContext";
import NotFound from "../NotFound";

export default function QuizCategory() {
  const { category = "" } = useParams();
  const cat = getQuizCategory(category);
  usePageMeta({
    title: cat ? `${cat.title} Quizzes` : "Quiz category not found",
    description: cat ? `${cat.description} Free ${cat.title.toLowerCase()} quizzes with instant explanations.` : undefined,
  });
  const { quizScores } = useLearning();
  if (!cat) return <NotFound />;
  const list = getQuizzesForCategory(cat.id);
  return (
    <>
      <PageHeader crumbs={[{ label: "Quiz", to: "/quiz" }, { label: cat.title }]}
        eyebrow={<span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-700"><Icon name={cat.icon} className="h-5 w-5" /></span>}
        title={`${cat.title} quizzes`} description={cat.description} />
      <section className="container-page py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((q) => <QuizCard key={q.id} quiz={q} best={quizScores[q.id]} />)}
        </div>
      </section>
    </>
  );
}
