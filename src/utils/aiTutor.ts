/**
 * Speak with AI. Live: the server (/api/ai/*) holds the provider key and talks to the AI.
 * Demo mode: the browser calls the provider saved in the demo admin panel directly, so the
 * preview can be tried with your own key (it never leaves this browser).
 */
import { apiFetch, HttpError, isLive } from "./backend";
import { DEMO_AI_DEFAULTS, readDemoDb } from "./demoStore";

export const SCENARIOS = [
  { id: "free", title: "Free talk", hint: "Chat about your day, hobbies and plans", opener: "Hi! I'm Bridget, your English speaking partner. How are you today, and what did you do this morning?" },
  { id: "interview", title: "Job interview", hint: "Practise answering interview questions", opener: "Good morning, and thank you for coming in. Please have a seat. Could you start by telling me a little about yourself?" },
  { id: "restaurant", title: "At a restaurant", hint: "Order food and drinks", opener: "Good evening, welcome to Spice Garden! Here is the menu. Can I get you something to drink first?" },
  { id: "shopping", title: "Shopping", hint: "Buy clothes, ask for sizes and prices", opener: "Hello! Welcome to our store. Are you looking for anything in particular today?" },
  { id: "travel", title: "Travel", hint: "Airport check-in and hotel", opener: "Good afternoon! May I see your passport and ticket, please? Where are you flying to today?" },
  { id: "doctor", title: "Doctor's appointment", hint: "Call a clinic and book a visit", opener: "Hello, City Care Clinic, this is the front desk. How can I help you today?" },
  { id: "office", title: "At the office", hint: "Talk with a colleague about work", opener: "Hey, good morning! Did you have a good weekend? Are you ready for the team meeting today?" },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiStatus {
  enabled: boolean;
  allowed: boolean;
  remainingToday: number | null;
}

export class AiTutorError extends Error {
  constructor(message: string, public readonly code?: "access" | "limit" | "off") {
    super(message);
  }
}

export async function getAiStatus(token: string, demoAllowed: boolean): Promise<AiStatus> {
  if (!isLive) {
    const ai = readDemoDb().ai ?? DEMO_AI_DEFAULTS;
    return { enabled: ai.enabled && Boolean(ai.apiKey), allowed: demoAllowed, remainingToday: null };
  }
  return apiFetch<AiStatus>("/ai/status", { token });
}

export async function askTutor(token: string, scenario: ScenarioId, messages: ChatTurn[], learnerName: string): Promise<{ reply: string; remainingToday: number | null }> {
  if (!isLive) return demoAsk(scenario, messages, learnerName);
  try {
    return await apiFetch("/ai/chat", { method: "POST", token, json: { scenario, messages: messages.slice(-16) } });
  } catch (e) {
    if (e instanceof HttpError) {
      const code = e.status === 402 ? "access" : e.status === 429 && /limit/i.test(e.message) ? "limit" : e.status === 503 ? "off" : undefined;
      throw new AiTutorError(e.message, code);
    }
    throw new AiTutorError("Could not reach the server. Check your connection.");
  }
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
  const system = [
    `You are "Bridget", a warm, patient spoken-English tutor talking by voice with ${learnerName.split(" ")[0]}, an Indian learner of English. Situation: ${situation} (you play the other person).`,
    "Reply in 1 to 3 short spoken sentences, no lists or markdown, and usually end with a question.",
    'If the learner\'s last message has a mistake, begin with one line "Correction: <corrected sentence>", then continue on a new line.',
    ai.instructions,
  ].filter(Boolean).join("\n");
  let res: Response;
  try {
    res = await fetch(`${ai.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({ model: ai.model, temperature: 0.7, max_tokens: 220, messages: [{ role: "system", content: system }, ...messages.slice(-16)] }),
    });
  } catch {
    throw new AiTutorError("The browser could not reach the AI service (some providers only accept calls from a server). Connect the API server to use it.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AiTutorError(`The AI service returned an error (${res.status})${data?.error?.message ? `: ${data.error.message}` : ""}`);
  const reply = String(data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!reply) throw new AiTutorError("The AI service sent an empty answer. Please try again.");
  return { reply, remainingToday: null };
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
