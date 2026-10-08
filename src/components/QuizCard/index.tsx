import { ArrowRight, Clock, ListChecks, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Quiz } from "../../types";
import { Card } from "../Card";
import { LevelBadge } from "../Badge";

export function QuizCard({ quiz, best }: { quiz: Quiz; best?: { score: number; total: number } }) {
  return (
    <Card interactive className="group flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <LevelBadge level={quiz.level} />
        {best && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Best {best.score}/{best.total}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold">
        <Link to={`/quiz/${quiz.categoryId}/${quiz.id}`} className="after:absolute after:inset-0 focus:outline-none">{quiz.title}</Link>
      </h3>
      <div className="mt-2 flex gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><ListChecks className="h-4 w-4" aria-hidden="true" /> {quiz.questions.length} questions</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> {quiz.minutes} min</span>
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-ink-700">
        {best ? "Try again" : "Start quiz"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Card>
  );
}
