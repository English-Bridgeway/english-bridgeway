import type { QuizQuestion } from "../types";

const normalize = (s: string) =>
  s.toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?,]/g, "").replace(/\s+/g, " ").trim();

export function isCorrect(q: QuizQuestion, given: string | undefined): boolean {
  if (!given) return false;
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  return answers.some((a) => normalize(a) === normalize(given));
}

export const primaryAnswer = (q: QuizQuestion) => (Array.isArray(q.answer) ? q.answer[0] : q.answer);

export function scoreMessage(percent: number) {
  if (percent === 100) return "Perfect score! You've mastered this one.";
  if (percent >= 80) return "Great job! Keep practising.";
  if (percent >= 50) return "Good effort. Review the explanations and try again.";
  return "Keep going. Read the lesson again, then retry the quiz.";
}
