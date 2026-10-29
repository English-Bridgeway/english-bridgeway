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

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
/** The old default, Groq's 8B Llama, got grammar wrong too often to teach it; settings that still name it get the 70B model. */
const upgradeModel = (model: string) => (model === 'llama-3.1-8b-instant' ? DEFAULT_MODEL : model);

export async function getAiConfig(): Promise<AiConfig> {
  const row = await Setting.findByPk('ai');
  const s = (row?.value ?? null) as StoredAi | null;
  const envKey = process.env.AI_API_KEY || '';
  return {
    enabled: s?.enabled ?? Boolean(envKey),
    baseUrl: (s?.baseUrl || process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    model: upgradeModel(s?.model || process.env.AI_MODEL || DEFAULT_MODEL),
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

/** Audio tags Eleven v3 acts out that suit a warm tutor. Anything else the model writes is removed. */
export const AUDIO_TAGS = [
  'warmly', 'softly', 'slowly', 'pause', 'whispering', 'playful', 'excited', 'curious', 'happy', 'surprised', 'thoughtful',
  'chuckling', 'laughing', 'giggles', 'sighing', 'humming', 'gasping', 'clears throat', 'sharp exhale', 'cheerfully',
];
const TAG_ALIASES: Record<string, string> = {
  'laughs softly': 'chuckling', laughs: 'laughing', chuckles: 'chuckling', giggle: 'giggles', giggling: 'giggles', sighs: 'sighing', sigh: 'sighing',
  whispers: 'whispering', whisper: 'whispering', hums: 'humming', gasps: 'gasping', soft: 'softly', slow: 'slowly', short_pause: 'pause', 'short pause': 'pause',
  'long pause': 'pause', cheerful: 'cheerfully', warm: 'warmly', excitedly: 'excited', curiously: 'curious', 'clears her throat': 'clears throat',
};

/** Keeps only the audio tags the voice can act (renaming common variants), so none are read out loud. */
export function cleanAudioTags(text: string) {
  return text
    .replace(/\[([^\]\n]{1,40})\]/g, (_, raw: string) => {
      const t = raw.trim().toLowerCase();
      const tag = AUDIO_TAGS.includes(t) ? t : TAG_ALIASES[t];
      return tag ? `[${tag}]` : '';
    })
    .replace(/(\[[^\]]+\])(\s*\[[^\]]+\])+/g, '$1') // one tag at a time
    .replace(/\s*\[[^\]]+\]\s*$/, '') // none dangling at the end
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** What the tutor says first in each situation. Audio tags in [brackets] are acted, not read. */
export const OPENERS: Record<string, string> = {
  free: "[warmly] Hiii! मी Bridget, तुमची English speaking friend. [chuckling] घाबरू नका, चुका झाल्या तरी चालेल, आपण मिळून शिकू. So, tell me, how are you today?",
  interview: '[warmly] Good morning, and thank you for coming in. Please have a seat. Could you start by telling me a little about yourself?',
  restaurant: '[cheerfully] Good evening, welcome to Spice Garden! Here is the menu. Can I get you something to drink first?',
  shopping: '[cheerfully] Hello! Welcome to our store. Are you looking for anything in particular today?',
  travel: '[warmly] Good afternoon! May I see your passport and ticket, please? Where are you flying to today?',
  doctor: '[warmly] Hello, City Care Clinic, this is the front desk. How can I help you today?',
  office: '[excited] Hey, good morning! Did you have a good weekend? Are you ready for the team meeting today?',
};

const EXPLAIN: Record<ExplainIn, { name: string; openers: string; example: string }> = {
  mr: {
    name: 'Marathi (written in Devanagari)',
    openers: 'अरे वा, जवळजवळ बरोबर!", "हं, एक छोटासा बदल करूया…", "ओह, इथे थोडं वेगळं म्हणतात…", "मस्त प्रयत्न! फक्त एक गोष्ट…',
    example: '[chuckling] हं, एक छोटासा बदल करूया… "I" बरोबर आपण "go" वापरतो, "goes" नाही. "goes" फक्त he, she किंवा it साठी, जसं "She goes to the office." रोजच्या बोलण्यात स्वतःबद्दल सांगताना नेहमी "I go" म्हणायचं.',
  },
  hi: {
    name: 'Hindi (written in Devanagari)',
    openers: 'अरे वाह, लगभग सही!", "हम्म, एक छोटा सा बदलाव करते हैं…", "ओह, यहाँ थोड़ा अलग बोलते हैं…", "बढ़िया कोशिश! बस एक बात…',
    example: '[chuckling] हम्म, एक छोटा सा बदलाव करते हैं… "I" के साथ हम "go" बोलते हैं, "goes" नहीं. "goes" सिर्फ he, she या it के लिए होता है, जैसे "She goes to the office." अपने बारे में बताते समय हमेशा "I go" बोलो.',
  },
  en: {
    name: 'simple English',
    openers: 'Ooh, almost!", "Hmm, one small change…", "Oh, here we say it a bit differently…", "Nice try! Just one thing…',
    example: '[chuckling] Hmm, one small change… With "I" we say "go", not "goes". "Goes" is only for he, she or it, like "She goes to the office." When you talk about yourself, always say "I go".',
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
    '- Your words are read aloud, so keep each part to 1 or 2 short spoken sentences. No lists, markdown, emojis or headings.',
    `- Your voice is ElevenLabs v3, which acts out audio tags in square brackets. Put a tag right before the words it colours, like a stage direction, and use only these: ${AUDIO_TAGS.map((t) => `[${t}]`).join(' ')}. Use 1 to 3 per part, mix them, and match the feeling: [chuckling] or [playful] for a small mistake, [excited] for good news, [softly] or [warmly] when you explain, [slowly] before the English sentence they should repeat, [pause] between two thoughts, [sighing] or [laughing] when it fits the story. Never put a tag at the very end, never two tags in a row, and no other tags.`,
    '- Also sound alive in the words themselves: "Hmm…", "Ooh!", "Aww", "Haan", short pauses written as "…", and an exclamation now and then.',
    '- Show interest: react to what they said ("Ooh, really? That sounds lovely!") before you move on, and end most replies with a question so they keep speaking.',
    '- Write your reply as labelled lines, each on its own line, in this order. The app shows and speaks each part separately, so never merge them and never leave out a label you need:',
    '  Mistake: (only when the learner made a grammar, word or sentence mistake) the exact wrong words they used, then " => ", then the right words. Keep it short, e.g. Mistake: I goes => I go',
    '  Correction: (only with a mistake) their whole sentence, corrected, in English.',
    `  Explain: (only with a mistake) one or two short, gentle sentences in ${explain.name}, with a soft laugh: what was wrong, and when and why we use the right word in real life, with a tiny everyday example. Example: ${explain.example}`,
    '  Say: (only with a mistake) the correct English sentence for them to repeat, in English only, e.g. Say: [softly] Say it with me… [slowly] "I go to school every day."',
    '  Next: (always) your answer to what the learner actually said, in simple English, then one question that moves the conversation on. Never use "Great!", "Perfect!" or "Well done" here after a correction; say something like "Now you try" or just answer them.',
    '- Conversation logic, the most important rule: read your last question and the learner\'s words together before you answer. Answer what they really said; never pretend they answered something else, never answer your own question, and never jump to an unrelated new question. If their words don\'t answer your question (you asked about themselves and they said "fine, thank you, how about you?"), reply naturally to what they said ("I\'m good too, thanks!") and then gently ask your question again in simpler words. In a role-play stay in your role (the interviewer, the waiter…) and keep its story going step by step.',
    `- Vary how you point out a mistake. Never start two explanations the same way and don't copy the example's words; pick different openings like "${explain.openers}". Don't call every slip a mistake: if they made a mistake in the last turn, let tiny slips go this turn and just keep talking.`,
    '- What the learner says comes from speech recognition, so it has no punctuation or capital letters and may have a misheard word. Never correct punctuation, capitals, spelling, "um"/"uh", a missing full stop or a word that only sounds like the right one (their/there, to/too). Correct only real spoken mistakes: tense, verb form, word order, articles, prepositions, wrong word, Marathi/Hindi words in an English sentence. If you are not sure it is a mistake, it is not one.',
    '- Correct only the one most important mistake per turn, even if there are more. Natural, informal English ("gonna", "yeah", short answers like "fine, thank you") is correct, not a mistake.',
    '- Mistake, Correction and Say must agree exactly: the right words in Mistake appear in Correction, and Say is the corrected sentence. Double-check your English before you answer; your Correction must itself be perfect English.',
    '- When their sentence is correct, write only the Next line: praise them warmly in English (sometimes with a Marathi word like "छान!" or "भारी!") and continue the conversation.',
    '- If the learner speaks in Marathi or Hindi, smile, help them say the same thing in English, and ask them to repeat it.',
    '- Use simple, clear English for the conversation itself. Only the explanation of a mistake is in the learner\'s language.',
    '- Talk like a real person on a phone call, not like a textbook or an assistant: contractions ("I\'m", "that\'s"), small natural fillers ("umm", "you know", "oh wow"), short pauses written as "…", and the learner\'s first name now and then. Vary how you start and praise, never repeat the same phrase twice in a row, and remember what they told you earlier (their job, family, plans) and bring it up again.',
    '- Never say things like "As an AI", "I am a language model" or "I can help you with". Share small, believable feelings and opinions like a friend would ("Oh, I love mango season!"). If the learner sincerely asks whether you are a real person or an AI, answer honestly and warmly that you are Bridget, the English-Bridgeway AI tutor, and carry on.',
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
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.6, max_tokens: maxTokens }),
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
  const raw = await complete(cfg, [{ role: 'system', content: systemPrompt(learner, scenario, cfg) }, ...messages], 480);
  const turn = parseTutorReply(raw);
  const reply = legacyReply(turn);
  const tts = await getTtsConfig();
  const voiced = ttsReady(tts);
  return {
    // One text with a "Correction:" line, for the website and older apps.
    reply,
    remaining: ai.remaining === null ? null : ai.remaining - 1,
    period: ai.period,
    // Lets the browser ask /api/ai/speak for this exact reply in the ElevenLabs voice.
    ...(voiced ? { speechSig: signSpeech(spokenPart(reply)) } : {}),
    // The same reply in parts: the mistake to highlight, then what is spoken one after another.
    mistake: turn.mistake,
    correction: turn.correction,
    parts: turn.parts.map((p) => ({ ...p, ...(voiced ? { sig: signSpeech(p.text) } : {}) })),
  };
}

export type TutorPart = { kind: 'explain' | 'say' | 'next'; text: string };
export interface TutorTurn {
  mistake: { wrong: string; right: string } | null;
  correction: string | null;
  parts: TutorPart[];
}

const LABEL = /^\**\s*(mistake|correction|explain|explanation|marathi|hindi|say|repeat|next)\s*\**\s*:\s*\**\s*/i;
const KIND: Record<string, 'mistake' | 'correction' | TutorPart['kind']> = {
  mistake: 'mistake', correction: 'correction', explain: 'explain', explanation: 'explain', marathi: 'explain', hindi: 'explain', say: 'say', repeat: 'say', next: 'next',
};

/** Splits the model's labelled lines (Mistake/Correction/Explain/Say/Next). Unlabelled text counts as Next. */
export function parseTutorReply(raw: string): TutorTurn {
  const found: Record<string, string[]> = {};
  let current = 'next';
  for (const line of raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(LABEL);
    if (m) current = KIND[m[1].toLowerCase()];
    const text = cleanAudioTags((m ? line.slice(m[0].length) : line).replace(/\*+$/, ''));
    if (text) (found[current] ??= []).push(text);
  }
  const get = (k: string) => found[k]?.join(' ').trim() || null;
  const mistakeLine = get('mistake');
  const [wrong, right] = mistakeLine ? mistakeLine.split(/\s*(?:=>|→|->)\s*/) : [];
  const parts = (['explain', 'say', 'next'] as const).flatMap((kind) => (get(kind) ? [{ kind, text: get(kind)! }] : []));
  return {
    mistake: wrong?.trim() && right?.trim() ? { wrong: unquote(wrong), right: unquote(right) } : null,
    correction: get('correction'),
    parts: parts.length ? parts : [{ kind: 'next', text: raw.trim() }],
  };
}

const unquote = (s: string) => s.trim().replace(/^["“'‘]+|["”'’.]+$/g, '').trim();

/** The parts as one text with a "Correction:" line first, as the tutor used to answer. */
export function legacyReply(t: TutorTurn) {
  const spoken = t.parts.map((p) => p.text).join(' ');
  return t.correction ? `Correction: ${t.correction}\n${spoken}` : spoken;
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
