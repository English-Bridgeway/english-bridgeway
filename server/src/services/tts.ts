import crypto from 'crypto';
import { Setting } from '../db';
import { config } from '../config';
import { decryptSecret, encryptSecret, maskSecret } from './settings';

// The AI tutor's voice. With an ElevenLabs key saved in Admin → AI tutor → Tutor voice, replies
// are spoken by an ElevenLabs voice (eleven_v3 reads Marathi and English in one sentence and
// performs audio tags such as [laughs] or [sighs]). Without one, the browser's own voice is used.
// The key stays on the server; browsers get MP3 audio from /api/ai/speak.

export const ELEVEN_BASE = (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/+$/, '');
/** "Sarah": a soft, warm young female voice from the ElevenLabs default library. */
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
export const DEFAULT_TTS_MODEL = 'eleven_v3';
/** eleven_v3 only accepts these: 0 = creative (most expressive), 0.5 = natural, 1 = robust. */
const V3_STABILITY = [0, 0.5, 1];

export interface TtsConfig {
  provider: 'browser' | 'elevenlabs';
  apiKey: string;
  voiceId: string;
  model: string;
  /** 0 to 1. Lower is livelier, higher is steadier. */
  stability: number;
  /** 0 to 1. How much emotion and style to add. */
  style: number;
}

interface StoredTts extends Omit<TtsConfig, 'apiKey'> {
  apiKeyEnc: string | null;
}

export class TtsError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

const clamp01 = (n: unknown, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
};

export async function getTtsConfig(): Promise<TtsConfig> {
  const row = await Setting.findByPk('tts');
  const s = (row?.value ?? null) as StoredTts | null;
  const envKey = process.env.ELEVENLABS_API_KEY || '';
  const apiKey = decryptSecret(s?.apiKeyEnc ?? null) || envKey;
  return {
    provider: s?.provider ?? (envKey ? 'elevenlabs' : 'browser'),
    apiKey,
    voiceId: s?.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    model: s?.model || process.env.ELEVENLABS_MODEL || DEFAULT_TTS_MODEL,
    stability: s?.stability ?? 0.5,
    style: s?.style ?? 0.6,
  };
}

/** True when replies should be spoken by ElevenLabs. */
export const ttsReady = (c: TtsConfig) => c.provider === 'elevenlabs' && Boolean(c.apiKey && c.voiceId);

export async function saveTtsConfig(input: Partial<Omit<TtsConfig, 'apiKey'>> & { apiKey?: string; clearKey?: boolean }) {
  const row = await Setting.findByPk('tts');
  const prev = (row?.value ?? null) as StoredTts | null;
  const voiceId = String(input.voiceId ?? prev?.voiceId ?? '').trim();
  if (voiceId && !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) throw new TtsError('The voice ID should be letters and numbers only, like EXAVITQu4vr4xnSDxMaL.', 400);
  const model = String(input.model ?? prev?.model ?? '').trim().slice(0, 60);
  if (model && !/^[a-z0-9_]+$/.test(model)) throw new TtsError('The model ID looks wrong. Use eleven_v3 for Marathi with expressions.', 400);
  const next: StoredTts = {
    provider: input.provider === 'elevenlabs' || input.provider === 'browser' ? input.provider : (prev?.provider ?? 'browser'),
    apiKeyEnc: input.clearKey ? null : input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : (prev?.apiKeyEnc ?? null),
    voiceId,
    model,
    stability: clamp01(input.stability ?? prev?.stability, 0.5),
    style: clamp01(input.style ?? prev?.style, 0.6),
  };
  await Setting.upsert({ key: 'tts', value: next as unknown as Record<string, unknown> });
  cache.clear();
}

export async function ttsSettingsForAdmin() {
  const c = await getTtsConfig();
  return { provider: c.provider, voiceId: c.voiceId, model: c.model, stability: c.stability, style: c.style, apiKeyMasked: maskSecret(c.apiKey) };
}

// ---- Signing: /api/ai/speak only reads text this server wrote, so the key can't be used as a free TTS service. ----

const signKey = () => crypto.createHash('sha256').update(`english-bridgeway-tts:${config.jwtSecret}`).digest();
export const signSpeech = (text: string) => crypto.createHmac('sha256', signKey()).update(text).digest('base64url');
export function verifySpeech(text: string, sig: unknown) {
  if (typeof sig !== 'string') return false;
  const want = Buffer.from(signSpeech(text));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// ---- Speaking ----

// Recent audio, so the scenario openers and repeated "Listen" presses are not paid for twice.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 60;

function voiceSettings(c: TtsConfig) {
  if (c.model === 'eleven_v3') {
    const stability = V3_STABILITY.reduce((a, b) => (Math.abs(b - c.stability) < Math.abs(a - c.stability) ? b : a));
    return { stability };
  }
  return { stability: c.stability, similarity_boost: 0.8, style: c.style, use_speaker_boost: true };
}

/** Older models read audio tags out loud, so only eleven_v3 gets them. */
export const stripAudioTags = (text: string) => text.replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/\s{2,}/g, ' ').trim();

export async function synthesize(text: string, c?: TtsConfig): Promise<Buffer> {
  const cfg = c ?? (await getTtsConfig());
  if (!ttsReady(cfg)) throw new TtsError('The ElevenLabs voice is not set up.', 503);
  const spoken = (cfg.model === 'eleven_v3' ? text : stripAudioTags(text)).slice(0, 1500);
  if (!spoken) throw new TtsError('Nothing to say.', 400);
  const key = crypto.createHash('sha1').update(`${cfg.voiceId}|${cfg.model}|${cfg.stability}|${cfg.style}|${spoken}`).digest('hex');
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let res: globalThis.Response;
  try {
    res = await fetch(`${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg', 'xi-api-key': cfg.apiKey },
      body: JSON.stringify({ text: spoken, model_id: cfg.model, voice_settings: voiceSettings(cfg) }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new TtsError('ElevenLabs did not answer. Please try again.');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { detail?: { message?: string; status?: string } | string } | null;
    const detail = typeof data?.detail === 'string' ? data.detail : data?.detail?.message;
    if (res.status === 401) throw new TtsError(`ElevenLabs rejected the API key${detail ? `: ${detail.slice(0, 160)}` : ''}.`);
    if (res.status === 429) throw new TtsError('ElevenLabs is busy or the monthly characters are used up.', 429);
    throw new TtsError(`ElevenLabs returned an error (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  cache.set(key, audio);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return audio;
}

/** For the admin's "Play sample" button. */
export async function testTts(): Promise<{ ok: boolean; message: string; audio?: string }> {
  const cfg = await getTtsConfig();
  if (!cfg.apiKey) return { ok: false, message: 'Add an ElevenLabs API key first.' };
  try {
    const audio = await synthesize(
      '[chuckling] Hmm… अगं, छोटीशी चूक झाली! आपण "I goes" नाही, "I go" म्हणतो. [pause] [softly] Say it with me… [slowly] I go to school every day. [excited] Ooh, perfect!',
      { ...cfg, provider: 'elevenlabs' },
    );
    return { ok: true, message: `Connected. Voice ${cfg.voiceId} on ${cfg.model} is working.`, audio: `data:audio/mpeg;base64,${audio.toString('base64')}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'The test failed.' };
  }
}
