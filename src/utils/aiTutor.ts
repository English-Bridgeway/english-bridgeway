/**
 * Speak with AI. Live: the server (/api/ai/*) holds the provider key and talks to the AI.
 * Demo mode: the browser calls the provider saved in the demo admin panel directly, so the
 * preview can be tried with your own key (it never leaves this browser).
 */
import { API_BASE, apiFetch, HttpError, isLive } from "./backend";
import { DEMO_AI_DEFAULTS, readDemoDb } from "./demoStore";
import { demoTtsReady, elevenLabsFromBrowser } from "./tutorVoice";

export const SCENARIOS = [
  // Keep the openers the same as OPENERS in server/src/services/ai.ts (the live site uses the server's).
  { id: "free", title: "Free talk", hint: "Chat about your day, hobbies and plans", opener: "[warmly] Hiii! मी Bridget, तुमची English speaking friend. [giggles] घाबरू नका, चुका झाल्या तरी चालेल, आपण मिळून शिकू. So, tell me, how are you today?" },
  { id: "interview", title: "Job interview", hint: "Practise answering interview questions", opener: "[warmly] Good morning, and thank you for coming in. Please have a seat. Could you start by telling me a little about yourself?" },
  { id: "restaurant", title: "At a restaurant", hint: "Order food and drinks", opener: "[cheerfully] Good evening, welcome to Spice Garden! Here is the menu. Can I get you something to drink first?" },
  { id: "shopping", title: "Shopping", hint: "Buy clothes, ask for sizes and prices", opener: "[cheerfully] Hello! Welcome to our store. Are you looking for anything in particular today?" },
  { id: "travel", title: "Travel", hint: "Airport check-in and hotel", opener: "[warmly] Good afternoon! May I see your passport and ticket, please? Where are you flying to today?" },
  { id: "doctor", title: "Doctor's appointment", hint: "Call a clinic and book a visit", opener: "[warmly] Hello, City Care Clinic, this is the front desk. How can I help you today?" },
  { id: "office", title: "At the office", hint: "Talk with a colleague about work", opener: "[excited] Hey, good morning! Did you have a good weekend? Are you ready for the team meeting today?" },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiStatus {
  enabled: boolean;
  allowed: boolean;
  /** Messages left (today for paid learners, for the whole trial otherwise); null = no limit. */
  remaining: number | null;
  limit?: number | null;
  period?: "day" | "trial" | "none";
  /** Why the learner can't chat, when they can't. */
  message?: string | null;
  /** "elevenlabs" when replies can be fetched as audio from /api/ai/speak. */
  voice?: "elevenlabs" | "browser";
  openers?: Partial<Record<ScenarioId, string>>;
  openerSigs?: Partial<Record<ScenarioId, string>>;
}

export class AiTutorError extends Error {
  constructor(message: string, public readonly code?: "access" | "limit" | "off") {
    super(message);
  }
}

export async function getAiStatus(token: string, demoAllowed: boolean): Promise<AiStatus> {
  if (!isLive) {
    const ai = readDemoDb().ai ?? DEMO_AI_DEFAULTS;
    return { enabled: ai.enabled && Boolean(ai.apiKey), allowed: demoAllowed, remaining: null, voice: demoTtsReady() ? "elevenlabs" : "browser" };
  }
  return apiFetch<AiStatus>("/ai/status", { token });
}

/** A reply in parts (live server): the mistake to mark, then what is said one after another. */
export interface TutorTurnParts {
  mistake?: { wrong: string; right: string } | null;
  correction?: string | null;
  parts?: { kind: "explain" | "say" | "next"; text: string }[];
}

export async function askTutor(token: string, scenario: ScenarioId, messages: ChatTurn[], learnerName: string): Promise<{ reply: string; remaining: number | null; period?: AiStatus["period"]; speechSig?: string } & TutorTurnParts> {
  if (!isLive) return demoAsk(scenario, messages, learnerName);
  try {
    return await apiFetch("/ai/chat", { method: "POST", token, json: { scenario, messages: messages.slice(-16) } });
  } catch (e) {
    if (e instanceof HttpError) {
      const code = e.status === 402 ? "access" : e.status === 429 && /limit|used/i.test(e.message) ? "limit" : e.status === 503 ? "off" : undefined;
      throw new AiTutorError(e.message, code);
    }
    throw new AiTutorError("Could not reach the server. Check your connection.");
  }
}

/**
 * The tutor's spoken words as MP3 in the ElevenLabs voice, or null when that voice isn't set up
 * (the caller then uses the browser's voice). `sig` comes from the server with each reply.
 */
export async function tutorAudio(token: string, text: string, sig?: string): Promise<Blob | null> {
  if (!isLive) return demoTtsReady() ? elevenLabsFromBrowser(text) : null;
  if (!sig) return null;
  const res = await fetch(`${API_BASE}/ai/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, sig }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? `The voice failed (${res.status}).`);
  return res.blob();
}

/** Splits "Correction: …" (the tutor's fix for the learner's sentence) from the spoken reply. */
export function splitCorrection(reply: string): { correction: string | null; text: string } {
  const lines = reply.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^correction\s*:/i.test(l));
  if (i < 0) return { correction: null, text: reply.trim() };
  const correction = lines[i].replace(/^correction\s*:\s*/i, "").trim();
  return { correction: correction || null, text: lines.filter((_, j) => j !== i).join(" ").trim() };
}

async function demoAsk(scenario: ScenarioId, messages: ChatTurn[], learnerName: string) {
  const ai = readDemoDb().ai ?? DEMO_AI_DEFAULTS;
  if (!ai.enabled || !ai.apiKey) throw new AiTutorError("Speak with AI is not set up yet. Add an API key in Admin → AI tutor.", "off");
  const situation = SCENARIOS.find((s) => s.id === scenario)?.hint ?? "Free conversation";
  const lang = { mr: "Marathi (Devanagari)", hi: "Hindi (Devanagari)", en: "simple English" }[ai.explainIn ?? "mr"];
  // A shorter copy of systemPrompt() in server/src/services/ai.ts.
  const system = [
    `You are "Bridget", a sweet, soft-spoken, caring young woman teaching spoken English by voice to ${learnerName.split(" ")[0]}, a Marathi-speaking learner from Maharashtra. Situation: ${situation} (you play the other person).`,
    "Be warm, playful and interested, like a kind elder sister. Reply in 1 to 3 short spoken sentences, no lists or markdown, and usually end with a question.",
    'Sound alive: use "Hmm…", "Ooh!", "Aww", "Hehe" and one to three audio tags like [chuckling], [excited], [softly], [slowly], [pause], [sighing], [playful], [warmly], each right before the words it colours.',
    `If the learner's last message has a mistake, begin with one line "Correction: <corrected sentence>". Then on a new line, laughing softly, kindly say it wasn't quite right and explain why in ${lang} in one short sentence, say the correct sentence and ask them to repeat it. Otherwise praise them and continue in simple English.`,
    ai.instructions,
  ].filter(Boolean).join("\n");
  let res: Response;
  try {
    res = await fetch(`${ai.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({ model: ai.model, temperature: 0.7, max_tokens: 320, messages: [{ role: "system", content: system }, ...messages.slice(-16)] }),
    });
  } catch {
    throw new AiTutorError("The browser could not reach the AI service (some providers only accept calls from a server). Connect the API server to use it.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AiTutorError(`The AI service returned an error (${res.status})${data?.error?.message ? `: ${data.error.message}` : ""}`);
  const reply = String(data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!reply) throw new AiTutorError("The AI service sent an empty answer. Please try again.");
  return { reply, remaining: null };
}

// ---- Speech recognition (Chrome, Edge, Safari) ----

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function createRecognition(): RecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-IN";
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

export const canRecognizeSpeech = () =>
  typeof window !== "undefined" && Boolean((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
