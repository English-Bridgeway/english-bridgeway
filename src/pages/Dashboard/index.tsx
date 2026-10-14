import { Link } from "react-router-dom";
import { BookOpen, CircleCheck, Flame, Heart, ListChecks, Mic, PlayCircle, Sparkles, Target, Trophy } from "lucide-react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { ProgressBar } from "../../components/ProgressBar";
import { LessonCard } from "../../components/LessonCard";
import { Alert } from "../../components/Alert";
import { ListenButton } from "../../components/ListenButton";
import { useAuth } from "../../context/AuthContext";
import { useLearning } from "../../context/LearningContext";
import { demoProgress, recentActivity } from "../../data/dashboard";
import { getCourse } from "../../data/courses";
import { grammarLessons, getTopic } from "../../data/grammar";
import { getWord, getWordOfTheDay } from "../../data/vocabulary";
import { quizzes } from "../../data/quizzes";
import { useCourseProgress } from "../Courses/useCourseProgress";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const activityIcon = { lesson: CircleCheck, quiz: Trophy, word: Heart, course: PlayCircle };

export default function Dashboard() {
  const { user, purchasedCourseIds } = useAuth();
  const myCourses = purchasedCourseIds.map(getCourse).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const { completedLessons, quizScores, favoriteWords, streak } = useLearning();
  const progressFor = useCourseProgress();

  const course = getCourse(demoProgress.currentCourseId)!;
  const real = progressFor(course);
  const hasRealData = completedLessons.length > 0 || Object.keys(quizScores).length > 0;
  const scores = Object.values(quizScores);
  const avgScore = scores.length ? Math.round((scores.reduce((s, q) => s + q.score / q.total, 0) / scores.length) * 100) : null;

  const coursePercent = hasRealData ? real.percent : demoProgress.coursePercent;
  const stats = [
    { icon: BookOpen, label: "Lessons completed", value: hasRealData ? completedLessons.length : demoProgress.completedLessons },
    { icon: Target, label: "Average quiz score", value: `${avgScore ?? (hasRealData ? 0 : demoProgress.averageQuizScore)}%` },
    { icon: Flame, label: "Day streak", value: hasRealData ? streak : demoProgress.streakDays },
    { icon: Heart, label: "Favourite words", value: favoriteWords.length },
  ];
  const recommended = grammarLessons.filter((l) => !completedLessons.includes(`${l.topicId}/${l.id}`)).slice(0, 3);
  const favWords = favoriteWords.map(getWord).filter((w): w is NonNullable<typeof w> => Boolean(w)).slice(0, 6);
  const maxMin = Math.max(...demoProgress.weeklyMinutes);
  const quizList = quizzes.filter((q) => quizScores[q.id]);

  return (
    <div className="container-page py-10">
      {!hasRealData && (
        <Alert tone="info" className="mb-6" title="You're viewing a sample dashboard">
          Complete a lesson or quiz and these numbers will switch to your own progress, saved on this device.
        </Alert>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-3xl bg-brand-primary p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-ink-600/50" aria-hidden="true" />
          <p className="relative text-sm font-semibold text-amber-300">Welcome back</p>
          <h1 className="relative mt-1 text-3xl font-bold text-amber-400 sm:text-4xl">Welcome back, {user?.name ?? "Student"}!</h1>
          <p className="relative mt-3 text-lg text-ink-100">You're {Math.round(coursePercent)}% through {course.title}.</p>
          <ProgressBar value={coursePercent} label={`${course.title} progress`} tone="amber" className="relative mt-5 max-w-md" />
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Button to={`/courses/${course.id}`} variant="accent"><PlayCircle className="h-4 w-4" aria-hidden="true" /> Continue course</Button>
            <Button to="/quiz" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30">Take a quiz</Button>
          </div>
        </div>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 font-display font-semibold text-amber-800" aria-hidden="true">{user?.avatarInitials}</span>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted">{user?.email}</p>
            </div>
          </div>
          <h2 className="mt-6 text-sm font-semibold">This week</h2>
          <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label={`Minutes studied this week: ${demoProgress.weeklyMinutes.map((m, i) => `${days[i]} ${m}`).join(", ")}`}>
            {demoProgress.weeklyMinutes.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md bg-ink-500/85" style={{ height: `${Math.max(4, (m / maxMin) * 88)}px` }} />
                <span className="text-[0.7rem] text-muted">{days[i]}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{demoProgress.weeklyMinutes.reduce((a, b) => a + b, 0)} minutes studied (sample)</p>
        </Card>
      </section>

      <section aria-label="Your stats" className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-700"><s.icon className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="font-display text-2xl font-semibold tabular-nums">{s.value}</p><p className="text-sm text-muted">{s.label}</p></div>
          </Card>
        ))}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-10">
          <section>
            <div className="flex items-end justify-between"><h2 className="text-xl font-semibold">My courses</h2><Link to="/courses" className="text-sm font-semibold text-ink-700">All courses →</Link></div>
            {myCourses.length ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {myCourses.map((c) => {
                  const p = progressFor(c);
                  return (
                    <li key={c.id}>
                      <Card className="p-5">
                        <Link to={`/courses/${c.id}`} className="font-semibold hover:text-ink-600">{c.title}</Link>
                        <ProgressBar value={p.percent} label={`${p.done} of ${p.total} lessons done`} className="mt-3" showValue />
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white p-5 text-muted">You haven't bought a course yet. Free courses are open to everyone. <Link to="/courses" className="font-semibold text-ink-700">Browse courses →</Link></p>
            )}
          </section>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-50 p-5">
              <div>
                <h2 className="text-lg font-semibold">Practise speaking live</h2>
                <p className="text-sm text-muted">Call another learner one-to-one, or start a team room for up to six people.</p>
              </div>
              <Button to="/speak"><Mic className="h-4 w-4" aria-hidden="true" /> Open Speak Live</Button>
            </div>
          </section>
          <section>
            <div className="flex items-end justify-between"><h2 className="text-xl font-semibold">Recommended lessons</h2><Link to="/grammar" className="text-sm font-semibold text-ink-700">All lessons →</Link></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommended.map((l) => (
                <LessonCard key={l.id} to={`/grammar/${l.topicId}/${l.id}`} title={l.title} description={l.description} category={getTopic(l.topicId)?.title} minutes={l.minutes} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Quiz scores</h2>
            {quizList.length ? (
              <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
                {quizList.map((q) => {
                  const s = quizScores[q.id];
                  return (
                    <li key={q.id} className="flex items-center gap-4 p-4">
                      <ListChecks className="h-5 w-5 text-ink-500" aria-hidden="true" />
                      <Link to={`/quiz/${q.categoryId}/${q.id}`} className="min-w-0 flex-1 font-medium hover:text-ink-600">{q.title}</Link>
                      <Badge tone={s.score / s.total >= 0.8 ? "green" : "amber"}>{s.score}/{s.total}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white p-5 text-muted">No quiz scores yet. <Link to="/quiz" className="font-semibold text-ink-700">Take your first quiz →</Link></p>
            )}
          </section>
        </div>
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Recent activity</h2>
            <ol className="mt-4 space-y-3">
              {recentActivity.map((a) => {
                const I = activityIcon[a.kind];
                return (
                  <li key={a.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden="true" />
                    <div className="min-w-0"><p className="font-medium">{a.label}: <span className="text-ink-700">{a.detail}</span></p><p className="text-xs text-muted">{a.when}</p></div>
                  </li>
                );
              })}
            </ol>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Favourite vocabulary</h2>
            {favWords.length ? (
              <ul className="mt-4 space-y-2">
                {favWords.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
                    <Link to={`/vocabulary/${w.id}`} className="min-w-0 flex-1"><span className="font-semibold">{w.word}</span> <span className="text-sm text-muted">· {w.meaning}</span></Link>
                    <ListenButton text={w.word} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-white p-5">
                <p className="text-muted">Save words with the heart button and they'll appear here. Start with today's word:</p>
                <Link to={`/vocabulary/${getWordOfTheDay().id}`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-ink-700"><Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" /> {getWordOfTheDay().word}</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
