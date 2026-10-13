import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Pause, Play, Repeat, Volume2 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Badge, LevelBadge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Dialogue } from "../../components/Dialogue";
import { ListenButton } from "../../components/ListenButton";
import { Alert } from "../../components/Alert";
import { getSpokenLesson, spokenLessons } from "../../data/spokenEnglish";
import { canSpeak, makeUtterance, useCanSpeak } from "../../utils/speech";
import { cn } from "../../utils/cn";
import NotFound from "../NotFound";

export default function SpokenLesson() {
  const { lesson: id = "" } = useParams();
  const lesson = getSpokenLesson(id);

  const [playing, setPlaying] = useState<number | undefined>();
  const [mode, setMode] = useState<"read" | "repeat">("read");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const stopRef = useRef(false);
  const speakable = useCanSpeak();

  useEffect(() => () => { stopRef.current = true; if (canSpeak()) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { setStep(0); setMode("read"); setPlaying(undefined); setDone([]); }, [id]);

  if (!lesson) return <NotFound />;
  const i = spokenLessons.indexOf(lesson);
  const next = spokenLessons[(i + 1) % spokenLessons.length];

  const playAll = () => {
    if (!canSpeak()) return;
    if (playing !== undefined) {
      stopRef.current = true;
      window.speechSynthesis.cancel();
      setPlaying(undefined);
      return;
    }
    stopRef.current = false;
    const say = (n: number) => {
      if (stopRef.current || n >= lesson.dialogue.length) { setPlaying(undefined); return; }
      setPlaying(n);
      // Same friendly voice for both speakers; Speaker A a little lower so they sound different.
      const u = makeUtterance(lesson.dialogue[n].text, { pitchShift: lesson.dialogue[n].speaker === "A" ? -0.2 : 0 });
      u.onend = () => setTimeout(() => say(n + 1), 350);
      u.onerror = () => setPlaying(undefined);
      window.speechSynthesis.speak(u);
    };
    window.speechSynthesis.cancel();
    say(0);
  };

  const line = lesson.dialogue[step];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Spoken English", to: "/spoken-english" }, { label: lesson.title }]}
        eyebrow={<div className="flex flex-wrap gap-2"><Badge tone="ink">{lesson.category}</Badge><LevelBadge level={lesson.level} /></div>}
        title={lesson.title}
        description={`Situation: ${lesson.situation}`}
      />

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div role="group" aria-label="Practice mode" className="inline-flex rounded-xl bg-ink-50 p-1">
                {(["read", "repeat"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                    className={cn("rounded-lg px-3.5 py-1.5 text-sm font-semibold", mode === m ? "bg-brand-sky text-white shadow-card" : "text-muted hover:text-ink-900")}>
                    {m === "read" ? "Conversation" : "Repeat practice"}
                  </button>
                ))}
              </div>
              {mode === "read" && speakable && (
                <Button size="sm" variant={playing !== undefined ? "secondary" : "primary"} onClick={playAll}>
                  {playing !== undefined ? <><Pause className="h-4 w-4" aria-hidden="true" /> Stop</> : <><Play className="h-4 w-4" aria-hidden="true" /> Play conversation</>}
                </Button>
              )}
            </div>

            {mode === "read" ? (
              <div className="mt-6"><Dialogue lines={lesson.dialogue} highlight={playing} /></div>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-muted">Line {step + 1} of {lesson.dialogue.length}. Listen, then say the line out loud. Repeat until it feels natural.</p>
                <div className={cn("mt-4 rounded-2xl p-6", line.speaker === "A" ? "bg-brand-primary text-white" : "bg-amber-50 text-ink-900")}>
                  <p className={cn("text-sm font-semibold", line.speaker === "A" ? "text-ink-200" : "text-amber-800")}>{line.name} (Speaker {line.speaker})</p>
                  <p className="mt-2 font-display text-2xl font-semibold leading-snug">{line.text}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ListenButton text={line.text} label="Listen" />
                  <Button size="sm" variant={done[step] ? "secondary" : "outline"} onClick={() => setDone((d) => { const c = [...d]; c[step] = true; return c; })}>
                    <Repeat className="h-4 w-4" aria-hidden="true" /> {done[step] ? "Repeated ✓" : "I said it"}
                  </Button>
                </div>
                <div className="mt-6 flex justify-between gap-3 border-t border-line pt-4">
                  <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous</Button>
                  {step < lesson.dialogue.length - 1 ? (
                    <Button size="sm" onClick={() => setStep((s) => s + 1)}>Next line <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                  ) : (
                    <Button size="sm" variant="accent" onClick={() => { setMode("read"); setStep(0); }}>Finish practice</Button>
                  )}
                </div>
              </div>
            )}
            {!speakable && <Alert className="mt-6" tone="info">Audio isn't available in this browser, but you can still read and practise each line aloud.</Alert>}
          </Card>

          <section className="mt-8">
            <h2 className="text-xl font-semibold">Practice activity</h2>
            <ol className="mt-3 space-y-2">
              {lesson.activity.map((a, n) => (
                <li key={a} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-line">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">{n + 1}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Useful phrases</h2>
            <ul className="mt-3 space-y-3">
              {lesson.phrases.map((p) => (
                <li key={p.phrase} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{p.phrase}</p>
                    <p className="text-sm text-muted">{p.meaning}</p>
                  </div>
                  <ListenButton text={p.phrase.replace(/…/g, "")} compact />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold">Vocabulary</h2>
            <dl className="mt-3 space-y-2.5">
              {lesson.vocabulary.map((v) => (
                <div key={v.phrase}><dt className="font-semibold text-ink-900">{v.phrase}</dt><dd className="text-sm text-muted">{v.meaning}</dd></div>
              ))}
            </dl>
          </Card>
          <Link to={`/spoken-english/${next.id}`} className="group block rounded-2xl border border-line bg-white p-5 hover:border-ink-300">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted"><Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Next conversation</span>
            <span className="mt-1 block font-semibold group-hover:text-ink-600">{next.title} →</span>
          </Link>
        </aside>
      </div>
    </>
  );
}
