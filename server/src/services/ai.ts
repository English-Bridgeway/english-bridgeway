import { Setting, type Learner } from '../db';
import { decryptSecret, encryptSecret, maskSecret } from './settings';
import { countAiMessage, limitMessage, usageSummary } from './usage';
import { getTtsConfig, signSpeech, ttsReady } from './tts';

// "Speak with AI": a spoken-English tutor backed by any OpenAI-compatible chat API (Groq,
// Google Gemini, OpenRouter, OpenAI, a local Ollama…). The provider, model and key are set in
// Admin → AI tutor; the key is stored encrypted and never sent to browsers. The AI_* environment
// variables are used when nothing is saved in the admin panel.

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** Extra instructions added to the tutor's built-in ones. */
  instructions: string;
  /** Messages each learner may send per day (0 = no limit). */
  dailyLimit: number;
  /** The language the tutor uses to explain mistakes: Marathi, Hindi or English. */
  explainIn: ExplainIn;
}

export type ExplainIn = 'mr' | 'hi' | 'en';
const EXPLAIN_IN: ExplainIn[] = ['mr', 'hi', 'en'];

interface StoredAi {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeyEnc: string | null;
  instructions: string;
  dailyLimit: number;
  explainIn?: ExplainIn;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly code?: 'access' | 'limit' | 'off',
  ) {
    super(message);
  }
}

export async function getAiConfig(): Promise<AiConfig> {
  const row = await Setting.findByPk('ai');
  const s = (row?.value ?? null) as StoredAi | null;
  const envKey = process.env.AI_API_KEY || '';
  return {
    enabled: s?.enabled ?? Boolean(envKey),
    baseUrl: (s?.baseUrl || process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    model: s?.model || process.env.AI_MODEL || 'llama-3.1-8b-instant',
    apiKey: decryptSecret(s?.apiKeyEnc ?? null) || envKey,
    instructions: s?.instructions ?? '',
    dailyLimit: s?.dailyLimit ?? 200,
    explainIn: s?.explainIn ?? 'mr',
  };
}

export async function saveAiConfig(input: Partial<Omit<AiConfig, 'apiKey' | 'explainIn'>> & { apiKey?: string; clearKey?: boolean; explainIn?: unknown }) {
  const row = await Setting.findByPk('ai');
  const prev = (row?.value ?? null) as StoredAi | null;
  const baseUrl = String(input.baseUrl ?? prev?.baseUrl ?? '').trim().replace(/\/+$/, '');
  if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw new AiError('The API base URL must start with https:// (or http:// for a local server).', 400);
  const next: StoredAi = {
    enabled: Boolean(input.enabled ?? prev?.enabled),
    baseUrl,
    model: String(input.model ?? prev?.model ?? '').trim().slice(0, 120),
    apiKeyEnc: input.clearKey ? null : input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : (prev?.apiKeyEnc ?? null),
    instructions: String(input.instructions ?? prev?.instructions ?? '').slice(0, 2000),
    dailyLimit: Math.max(0, Math.min(10_000, Math.round(Number(input.dailyLimit ?? prev?.dailyLimit ?? 200)) || 0)),
    explainIn: EXPLAIN_IN.includes(input.explainIn as ExplainIn) ? (input.explainIn as ExplainIn) : (prev?.explainIn ?? 'mr'),
  };
  await Setting.upsert({ key: 'ai', value: next as unknown as Record<string, unknown> });
}

export async function aiSettingsForAdmin() {
  const c = await getAiConfig();
  return {
    enabled: c.enabled,
    baseUrl: c.baseUrl,
    model: c.model,
    apiKeyMasked: maskSecret(c.apiKey),
    instructions: c.instructions,
    dailyLimit: c.dailyLimit,
    explainIn: c.explainIn,
  };
}

export const SCENARIOS: Record<string, string> = {
  free: 'Have a friendly, natural everyday conversation. Ask the learner about their day, hobbies, family or plans.',
  interview: 'Play a job interviewer for an entry-level office job. Ask one interview question at a time and react to the answers.',
  restaurant: 'Play a waiter in a restaurant. The learner is the customer ordering food and drinks.',
  shopping: 'Play a shop assistant in a clothes shop. The learner wants to buy something.',
  travel: 'Play an airport check-in agent, then a hotel receptionist. The learner is a traveller.',
  doctor: 'Play a receptionist at a clinic. The learner calls to book a doctor appointment.',
  office: 'Play a friendly colleague. Talk about work, meetings and plans for the week.',
};

/** What the tutor says first in each situation. Audio tags in [brackets] are acted, not read. */
export const OPENERS: Record<string, string> = {
  free: "[warmly] Hiii! मी Bridget, तुमची English speaking friend. [giggles] घाबरू नका, चुका झाल्या तरी चालेल, आपण मिळून शिकू. So, tell me, how are you today?",
  interview: '[warmly] Good morning, and thank you for coming in. Please have a seat. Could you start by telling me a little about yourself?',
  restaurant: '[cheerfully] Good evening, welcome to Spice Garden! Here is the menu. Can I get you something to drink first?',
  shopping: '[cheerfully] Hello! Welcome to our store. Are you looking for anything in particular today?',
  travel: '[warmly] Good afternoon! May I see your passport and ticket, please? Where are you flying to today?',
  doctor: '[warmly] Hello, City Care Clinic, this is the front desk. How can I help you today?',
  office: '[excited] Hey, good morning! Did you have a good weekend? Are you ready for the team meeting today?',
};

const EXPLAIN: Record<ExplainIn, { name: string; example: string }> = {
  mr: {
    name: 'Marathi (written in Devanagari)',
    example: 'Hmm, [laughs softly] अगं, छोटीशी चूक झाली! आपण "I goes" नाही, "I go" म्हणतो, कारण "I" बरोबर "s" लागत नाही. Say it with me: "I go to school every day." [excited] Ooh, try it!',
  },
  hi: {
    name: 'Hindi (written in Devanagari)',
    example: 'Hmm, [laughs softly] अरे, छोटी सी गलती हो गई! हम "I goes" नहीं, "I go" बोलते हैं, क्योंकि "I" के साथ "s" नहीं लगता. Say it with me: "I go to school every day." [excited] Ooh, try it!',
  },
  en: {
    name: 'simple English',
    example: 'Hmm, [laughs softly] oh, a tiny mistake! We say "I go", not "I goes", because "I" never takes an "s". Say it with me: "I go to school every day." [excited] Ooh, try it!',
  },
};

function systemPrompt(learner: Learner, scenario: string, cfg: Pick<AiConfig, 'instructions' | 'explainIn'>) {
  const level = learner.profile?.englishLevel ? ` Their level: ${learner.profile.englishLevel}.` : '';
  const explain = EXPLAIN[cfg.explainIn] ?? EXPLAIN.mr;
  return [
    `You are "Bridget", a sweet, soft-spoken and caring young woman who teaches spoken English on the English-Bridgeway website. You are talking by voice with ${learner.name.split(' ')[0]}, a learner from Maharashtra whose first language is usually Marathi.${level}`,
    'You are like a kind elder sister: warm, playful and genuinely interested in what the learner says. You smile in your voice, laugh softly, and make mistakes feel safe and even fun, never embarrassing.',
    `Situation: ${SCENARIOS[scenario] ?? SCENARIOS.free}`,
    'Rules:',
    '- Your words are read aloud, so reply in 1 to 3 short spoken sentences. No lists, markdown, emojis or headings.',
    '- Sound alive: use natural sounds like "Hmm…", "Ooh!", "Aww", "Haan", "Hehe" and audio tags in square brackets that the voice acts out: [laughs softly], [giggles], [sighs], [excited], [curious], [warmly], [whispers]. Use one or two per reply, not more.',
    '- Show interest: react to what they said ("Ooh, really? That sounds lovely!") before you move on, and end most replies with a question so they keep speaking.',
    `- When the learner makes a grammar, word or sentence mistake: first write one line that starts with "Correction:" and gives only the corrected English sentence. Then, on a new line, gently and with a little laugh tell them it was not quite right and explain why in ${explain.name}, in one short sentence. Then say the correct English sentence and ask them to say it again. Never make them feel bad. Example of the spoken part: ${explain.example}`,
    '- When their sentence is correct, do not add a correction line. Praise them warmly in English (sometimes with a Marathi word like "छान!" or "भारी!") and continue the conversation in simple English.',
    '- If the learner speaks in Marathi or Hindi, smile, help them say the same thing in English, and ask them to repeat it.',
    '- Use simple, clear English for the conversation itself. Only the explanation of a mistake is in the learner\'s language.',
    '- Stay on English practice. Politely refuse anything unsafe or unrelated.',
    cfg.instructions ? `Extra instructions from the site owner: ${cfg.instructions}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function cleanMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, 1200) }));
}

async function complete(cfg: AiConfig, messages: { role: string; content: string }[], maxTokens = 220): Promise<string> {
  if (!cfg.apiKey && !/localhost|127\.0\.0\.1|ollama/.test(cfg.baseUrl)) throw new AiError('The AI tutor has no API key yet. Add one in Admin → AI tutor.', 503, 'off');
  let res: globalThis.Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AiError('The AI service did not answer. Please try again.');
  }
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  if (!res.ok) {
    const detail = data?.error?.message ? `: ${data.error.message.slice(0, 200)}` : '';
    if (res.status === 429) throw new AiError('The AI service is busy right now. Please wait a moment and try again.', 429);
    throw new AiError(`The AI service returned an error (${res.status})${detail}`);
  }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError('The AI service sent an empty answer. Please try again.');
  // Some models think out loud in <think> tags; learners only hear the answer.
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export async function tutorReply(learner: Learner, input: { messages?: unknown; scenario?: unknown }) {
  const cfg = await getAiConfig();
  if (!cfg.enabled) throw new AiError('Speak with AI is switched off right now.', 503, 'off');
  const { ai } = await usageSummary(learner);
  if (ai.remaining !== null && ai.remaining <= 0) {
    throw new AiError(limitMessage('ai', ai), ai.period === 'day' ? 429 : 402, ai.period === 'day' ? 'limit' : 'access');
  }
  const messages = cleanMessages(input.messages);
  const scenario = typeof input.scenario === 'string' && SCENARIOS[input.scenario] ? input.scenario : 'free';
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new AiError('Say something first.', 400);
  await countAiMessage(learner.id);
  const reply = await complete(cfg, [{ role: 'system', content: systemPrompt(learner, scenario, cfg) }, ...messages], 320);
  const tts = await getTtsConfig();
  return {
    reply,
    remaining: ai.remaining === null ? null : ai.remaining - 1,
    period: ai.period,
    // Lets the browser ask /api/ai/speak for this exact reply in the ElevenLabs voice.
    ...(ttsReady(tts) ? { speechSig: signSpeech(spokenPart(reply)) } : {}),
  };
}

/** The reply without its "Correction:" line: what the tutor says out loud. Mirrors splitCorrection() in the site. */
export function spokenPart(reply: string) {
  const lines = reply.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^correction\s*:/i.test(l));
  return (i < 0 ? reply.trim() : lines.filter((_, j) => j !== i).join(' ').trim());
}

/** Openers with their speech signatures, for /api/ai/status. */
export async function signedOpeners() {
  const tts = await getTtsConfig();
  if (!ttsReady(tts)) return { voice: 'browser' as const, openers: OPENERS };
  return { voice: 'elevenlabs' as const, openers: OPENERS, openerSigs: Object.fromEntries(Object.entries(OPENERS).map(([k, t]) => [k, signSpeech(t)])) };
}

/** For the admin's "Test" button: one tiny request with the saved settings. */
export async function testAi(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getAiConfig();
  try {
    const reply = await complete(cfg, [{ role: 'user', content: 'Say "Hello from the AI tutor" and nothing else.' }], 20);
    return { ok: true, message: `Connected to ${cfg.model}. It said: “${reply.slice(0, 120)}”` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'The test failed.' };
  }
}
