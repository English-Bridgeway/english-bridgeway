import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Loader2, Lock, Mic, MicOff, RotateCcw, Send, Sparkles, Square, Volume2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { UserAvatar } from "../Avatar";
import { AccessBanner } from "../AccessBanner";
import { askTutor, AiTutorError, canRecognizeSpeech, createRecognition, getAiStatus, SCENARIOS, splitCorrection, type AiStatus, type ChatTurn, type ScenarioId } from "../../utils/aiTutor";
import { canSpeak, makeUtterance } from "../../utils/speech";
import { cn } from "../../utils/cn";

type Recognition = NonNullable<ReturnType<typeof createRecognition>>;

/** Speak with AI: talk out loud with an AI English tutor (or type). Replies are read aloud in the site's voice. */
export default function SpeakAI() {
  const { token, user, access } = useAuth();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("free");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [handsFree, setHandsFree] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const micSupported = canRecognizeSpeech();

  useEffect(() => {
    if (!token) return;
    getAiStatus(token, Boolean(access?.ai)).then(setStatus).catch(() => setStatus({ enabled: true, allowed: Boolean(access?.ai), remaining: null }));
  }, [token, access?.ai]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, interim, thinking]);

  // Stop talking and listening when leaving the page.
  useEffect(() => () => {
    recRef.current?.abort();
    if (canSpeak()) window.speechSynthesis.cancel();
  }, []);

  const startListening = useCallback(() => {
    if (!micSupported || listening) return;
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    const rec = createRecognition();
    if (!rec) return;
    recRef.current = rec;
    let finalText = "";
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError({ message: "The microphone is blocked. Allow it in the browser's address bar, or type your answer below." });
      else if (e.error !== "no-speech" && e.error !== "aborted") setError({ message: `The microphone stopped (${e.error}). Try again or type below.` });
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
      const said = finalText.trim();
      if (said) void sendRef.current(said);
    };
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micSupported, listening]);

  const stopListening = () => recRef.current?.stop();

  const speakReply = useCallback((text: string, index: number, thenListen: boolean) => {
    if (!canSpeak()) {
      if (thenListen) startListening();
      return;
    }
    window.speechSynthesis.cancel();
    const u = makeUtterance(text);
    u.onend = () => {
      setSpeakingIndex(null);
      if (thenListen && handsFreeRef.current) startListening();
    };
    u.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(u);
  }, [startListening]);

  const send = async (text: string, fromVoice = true) => {
    const content = text.trim();
    if (!content || !token || thinking) return;
    const next: ChatTurn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setDraft("");
    setThinking(true);
    setError(null);
    try {
      const { reply, remaining } = await askTutor(token, scenario, next, user?.name ?? "friend");
      const all: ChatTurn[] = [...next, { role: "assistant", content: reply }];
      setTurns(all);
      setStatus((s) => (s ? { ...s, remaining } : s));
      speakReply(splitCorrection(reply).text, all.length - 1, fromVoice);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Something went wrong.", code: e instanceof AiTutorError ? e.code : undefined });
      // Free messages used up: show the plans screen instead of the chat.
      if (e instanceof AiTutorError && e.code === "access") setStatus((st) => (st ? { ...st, allowed: false, remaining: 0, period: "trial", message: e.message } : st));
    } finally {
      setThinking(false);
    }
  };
  // `send` is used from the recognition callback; keep the newest copy reachable.
  const sendRef = useRef(send);
  sendRef.current = send;

  const begin = (id: ScenarioId) => {
    recRef.current?.abort();
    if (canSpeak()) window.speechSynthesis.cancel();
    const s = SCENARIOS.find((x) => x.id === id)!;
    setScenario(id);
    setError(null);
    setTurns([{ role: "assistant", content: s.opener }]);
    speakReply(s.opener, 0, true);
  };

  if (status && !status.allowed) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Speak with AI</h1>
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-50 text-ink-700"><Lock className="h-7 w-7" aria-hidden="true" /></span>
          <h2 className="mt-4 text-xl font-semibold">{status.period === "day" ? "You've used today's messages" : status.period === "trial" ? "Your free AI messages are used up" : access?.trialEndsAt ? "Your free trial has ended" : "Speak with AI is for members"}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">{status.message ?? "Subscribe or buy a course to keep practising speaking with your AI tutor."}</p>
          {status.period !== "day" && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button to="/learn/billing#plans">See plans</Button>
              <Button to="/learn/courses" variant="outline">See courses</Button>
            </div>
          )}
        </div>
        <AccessBanner className="mt-6" />
      </div>
    );
  }

  const started = turns.length > 0;
  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Speak with AI</h1>
          <p className="mt-1 text-muted">Talk out loud with Bridget, your AI English partner. She replies by voice and fixes your mistakes.</p>
        </div>
        {status?.remaining != null && (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", status.remaining <= 10 ? "bg-amber-50 text-amber-800" : "bg-ink-50 text-muted")}>
            {status.remaining} message{status.remaining === 1 ? "" : "s"} left{status.period === "day" ? " today" : status.period === "trial" ? " in your free trial" : ""}
          </span>
        )}
      </div>

      {status && !status.enabled && (
        <Alert tone="warning" className="mt-5" title="The AI tutor is not switched on yet">
          The site owner can turn it on in Admin → AI tutor with a free Groq or Gemini key, or their own OpenAI key.
        </Alert>
      )}
      {!micSupported && (
        <Alert tone="info" className="mt-5" title="Voice input needs Chrome, Edge or Safari">You can still type your answers; Bridget's replies are read aloud.</Alert>
      )}

      <div className="mt-5">
        <p className="text-sm font-semibold">Choose a situation</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => begin(s.id)} title={s.hint}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", started && scenario === s.id ? "border-brand-primary bg-brand-primary text-white" : "border-line bg-white text-ink-900 hover:bg-ink-50")}>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 min-h-[22rem] flex-1 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
        {!started ? (
          <div className="grid h-full min-h-[20rem] place-items-center text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-primary text-white"><Bot className="h-8 w-8" aria-hidden="true" /></span>
              <p className="mt-4 text-lg font-semibold">Ready when you are</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Pick a situation above, or just press Start and say hello.</p>
              <Button className="mt-5" onClick={() => begin("free")} disabled={status?.enabled === false}><Sparkles className="h-4 w-4" aria-hidden="true" /> Start talking</Button>
            </div>
          </div>
        ) : (
          <ol className="space-y-4">
            {turns.map((t, i) => {
              const mine = t.role === "user";
              const { correction, text } = mine ? { correction: null, text: t.content } : splitCorrection(t.content);
              return (
                <li key={i} className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                  {mine ? <UserAvatar user={user} className="h-8 w-8 text-xs" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-primary text-white"><Bot className="h-4 w-4" aria-hidden="true" /></span>}
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-sm bg-brand-primary text-white" : "rounded-bl-sm bg-ink-50 text-ink-900")}>
                    {correction && (
                      <p className="mb-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-sm text-amber-900"><span className="font-semibold">Better: </span>{correction}</p>
                    )}
                    <p className="leading-relaxed">{text}</p>
                    {!mine && canSpeak() && (
                      <button type="button" onClick={() => (speakingIndex === i ? (window.speechSynthesis.cancel(), setSpeakingIndex(null)) : speakReply(text, i, false))}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-ink-900">
                        {speakingIndex === i ? <><Square className="h-3 w-3" aria-hidden="true" /> Stop</> : <><Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Listen</>}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {interim && (
              <li className="flex flex-row-reverse items-end gap-2.5">
                <UserAvatar user={user} className="h-8 w-8 text-xs" />
                <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-primary/60 px-4 py-2.5 italic text-white">{interim}…</p>
              </li>
            )}
            {thinking && (
              <li className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Bridget is thinking…</li>
            )}
            <div ref={endRef} />
          </ol>
        )}
      </div>

      {error && (
        <Alert tone="error" className="mt-4">
          {error.message}
          {(error.code === "access" || error.code === "limit") && <> <Link to="/learn/billing#plans" className="font-semibold underline">See plans</Link></>}
        </Alert>
      )}

      {started && (
        <div className="sticky bottom-0 mt-4 rounded-2xl border border-line bg-white/95 p-3 shadow-card backdrop-blur">
          <div className="flex items-center gap-2">
            {micSupported && (
              <button type="button" onClick={listening ? stopListening : startListening} disabled={thinking}
                aria-label={listening ? "Stop listening and send" : "Speak"}
                className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-sm disabled:opacity-50", listening ? "animate-pulse bg-red-600" : "bg-brand-primary hover:bg-brand-primary/90")}>
                {listening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
              </button>
            )}
            <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void sendRef.current(draft, false); }}>
              <label htmlFor="ai-draft" className="sr-only">Type a message</label>
              <input id="ai-draft" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder={listening ? "Listening…" : "Speak, or type here"}
                className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 text-[0.95rem] focus:border-ink-500 focus:outline-none focus:ring-3 focus:ring-ink-100" />
              <Button type="submit" disabled={!draft.trim() || thinking} aria-label="Send"><Send className="h-4 w-4" aria-hidden="true" /></Button>
            </form>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            {micSupported ? (
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="h-4 w-4 accent-[var(--primary-color)]" />
                Hands-free: listen again after Bridget speaks
              </label>
            ) : <span />}
            <button type="button" onClick={() => begin(scenario)} className="inline-flex items-center gap-1 font-semibold text-ink-600 hover:text-ink-900">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
