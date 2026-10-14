import { Clock, ListChecks } from "lucide-react";
import { useParams } from "react-router-dom";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { LevelBadge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { QuizRunner } from "../../components/QuizRunner";
import { getQuiz, getQuizCategory } from "../../data/quizzes";
import { useLearning } from "../../context/LearningContext";
import NotFound from "../NotFound";

export default function QuizPlay() {
  const { category = "", quizId = "" } = useParams();
  const cat = getQuizCategory(category);
  const quiz = getQuiz(category, quizId);
  const { saveQuizScore, quizScores } = useLearning();
  if (!cat || !quiz) return <NotFound />;
  const best = quizScores[quiz.id];

  return (
    <div className="container-page max-w-3xl py-10">
      <Breadcrumbs items={[{ label: "Quiz", to: "/quiz" }, { label: cat.title, to: `/quiz/${cat.id}` }, { label: quiz.title }]} />
      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <LevelBadge level={quiz.level} />
          <span className="inline-flex items-center gap-1"><ListChecks className="h-4 w-4" aria-hidden="true" /> {quiz.questions.length} questions</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> About {quiz.minutes} min</span>
          {best && <span className="font-semibold text-amber-800">Your best: {best.score}/{best.total}</span>}
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{quiz.title}</h1>
      </header>
      <Card className="mt-6 p-5 sm:p-8">
        <QuizRunner
          key={quiz.id}
          questions={quiz.questions}
          title={quiz.title}
          onSubmit={(score, total) => saveQuizScore(quiz.id, score, total)}
          resultActions={<Button to={`/quiz/${cat.id}`} variant="outline">More {cat.title.toLowerCase()} quizzes</Button>}
        />
      </Card>
    </div>
  );
}
