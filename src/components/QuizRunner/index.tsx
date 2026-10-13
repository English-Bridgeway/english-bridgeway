import { ArrowLeft, ArrowRight, CircleCheck, CircleX, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "../../types";
import { Button } from "../Button";
import { ProgressBar } from "../ProgressBar";
import { isCorrect, primaryAnswer, scoreMessage } from "../../utils/quiz";
import { cn } from "../../utils/cn";

interface Props {
  questions: QuizQuestion[];
  title?: string;
  onSubmit?: (score: number, total: number) => void;
  /** Extra actions shown on the results screen (e.g. "Back to quizzes"). */
  resultActions?: React.ReactNode;
}

function Prompt({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="mx-1 inline-block w-16 border-b-3 border-amber-400 align-baseline" aria-label="blank" />}
        </span>
      ))}
    </>
  );
}

export function QuizRunner({ questions, title, onSubmit, resultActions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = questions.length;
  const q = questions[index];
  const answeredCount = questions.filter((x) => answers[x.id]?.trim()).length;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [index, submitted]);

  const setAnswer = (value: string) => setAnswers((a) => ({ ...a, [q.id]: value }));

  const submit = () => {
    const score = questions.filter((x) => isCorrect(x, answers[x.id])).length;
    setSubmitted(true);
    onSubmit?.(score, total);
  };

  const retry = () => {
    setAnswers({});
    setIndex(0);
    setSubmitted(false);
  };

  if (submitted) {
    const score = questions.filter((x) => isCorrect(x, answers[x.id])).length;
    const percent = Math.round((score / total) * 100);
    return (
      <section aria-labelledby="quiz-result" className="animate-fade-in">
        <div className="rounded-2xl bg-brand-primary p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-200">{title ? `${title} · ` : ""}Results</p>
          <h2 id="quiz-result" ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold text-amber-400 sm:text-4xl">
            Your score: <span className="tabular-nums">{score}/{total}</span>
          </h2>
          <p className="mt-2 text-lg text-ink-100">{scoreMessage(percent)}</p>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 p-3"><dt className="text-xs text-ink-200">Correct</dt><dd className="font-display text-2xl font-semibold tabular-nums">{score}</dd></div>
            <div className="rounded-xl bg-white/10 p-3"><dt className="text-xs text-ink-200">Wrong</dt><dd className="font-display text-2xl font-semibold tabular-nums">{total - score}</dd></div>
            <div className="rounded-xl bg-white/10 p-3"><dt className="text-xs text-ink-200">Percentage</dt><dd className="font-display text-2xl font-semibold tabular-nums">{percent}%</dd></div>
          </dl>
        </div>

        <h3 className="mt-8 text-lg font-semibold">Review your answers</h3>
        <ol className="mt-4 space-y-3">
          {questions.map((x, i) => {
            const ok = isCorrect(x, answers[x.id]);
            return (
              <li key={x.id} className={cn("rounded-xl border bg-white p-4", ok ? "border-brand-sky/25" : "border-danger/30")}>
                <div className="flex gap-3">
                  {ok ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-sky" aria-label="Correct" /> : <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-label="Wrong" />}
                  <div className="min-w-0">
                    <p className="font-medium"><span className="text-muted">{i + 1}.</span> <Prompt text={x.prompt} /></p>
                    <p className="mt-1 text-sm">
                      Your answer: <span className={ok ? "font-semibold text-brand-sky" : "font-semibold text-danger"}>{answers[x.id]?.trim() || "No answer"}</span>
                      {!ok && <> · Correct: <span className="font-semibold text-brand-sky">{primaryAnswer(x)}</span></>}
                    </p>
                    <p className="mt-1 text-sm text-muted">{x.explanation}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={retry}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry quiz</Button>
          {resultActions}
        </div>
      </section>
    );
  }

  const value = answers[q.id] ?? "";
  const last = index === total - 1;

  return (
    <section aria-label={title ?? "Quiz"}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink-800">Question {index + 1} of {total}</span>
        <span className="text-muted tabular-nums">{answeredCount} answered</span>
      </div>
      <ProgressBar value={((index + 1) / total) * 100} label="Quiz progress" className="mt-2" />

      <div key={q.id} className="mt-6 animate-fade-in">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{q.type === "mcq" ? "Multiple choice" : "Fill in the blank"}</p>
        <h2 ref={headingRef} tabIndex={-1} id={`q-${q.id}`} className="mt-2 text-xl font-semibold leading-snug sm:text-2xl focus:outline-none">
          <Prompt text={q.prompt} />
        </h2>

        {q.type === "mcq" ? (
          <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-5 grid gap-2.5">
            {q.options!.map((opt, i) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAnswer(opt)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    selected ? "border-brand-sky bg-ink-50 ring-1 ring-brand-sky" : "border-line bg-white hover:border-ink-300",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold", selected ? "bg-brand-sky text-white" : "bg-ink-50 text-ink-700")}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <label htmlFor={`fill-${q.id}`} className="text-sm font-semibold">Type your answer</label>
            <input
              id={`fill-${q.id}`}
              type="text"
              value={value}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (last) submit();
                  else setIndex((i) => i + 1);
                }
              }}
              className="mt-1.5 w-full max-w-md rounded-xl border border-line bg-white px-4 py-3 text-lg focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100"
              placeholder="Your answer"
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Button variant="outline" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
        </Button>
        {last ? (
          <Button onClick={submit} variant="accent">
            Submit quiz <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <nav aria-label="Jump to question" className="mt-5 flex flex-wrap gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[x.id]?.trim() ? ", answered" : ""}`}
            aria-current={i === index ? "step" : undefined}
            className={cn(
              "h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition-colors",
              i === index ? "bg-ink-800 text-white" : answers[x.id]?.trim() ? "bg-ink-100 text-ink-800" : "bg-white text-muted ring-1 ring-line hover:ring-ink-300",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>
    </section>
  );
}
