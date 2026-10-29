/**
 * The AI tutor's ElevenLabs voice. Live: the server holds the key and returns MP3 from
 * /api/ai/speak. Demo mode: the browser calls ElevenLabs with the key saved in the demo admin panel.
 */
import { DEMO_TTS_DEFAULTS, readDemoDb } from "./demoStore";

/** Audio tags like [chuckling] are acted by eleven_v3; everywhere else they are hidden. */
export const stripAudioTags = (text: string) => text.replace(/\[[^\]\n]{1,40}\]/g, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();

export const TTS_SAMPLE =
  '[chuckling] Hmm… अगं, छोटीशी चूक झाली! आपण "I goes" नाही, "I go" म्हणतो. [pause] [softly] Say it with me… [slowly] I go to school every day. [excited] Ooh, perfect!';

type TtsConfig = typeof DEMO_TTS_DEFAULTS;

export const demoTts = (): TtsConfig => ({ ...DEMO_TTS_DEFAULTS, ...readDemoDb().tts });
export const demoTtsReady = (c = demoTts()) => c.provider === "elevenlabs" && Boolean(c.apiKey && c.voiceId);

/** Calls ElevenLabs from the browser (demo mode only; the live site goes through the server). */
export async function elevenLabsFromBrowser(text: string, c: TtsConfig = demoTts()): Promise<Blob> {
  const v3 = c.model === "eleven_v3";
  const voice_settings = v3
    ? { stability: [0, 0.5, 1].reduce((a, b) => (Math.abs(b - c.stability) < Math.abs(a - c.stability) ? b : a)) }
    : { stability: c.stability, similarity_boost: 0.8, style: c.style, use_speaker_boost: true };
  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg", "xi-api-key": c.apiKey },
      body: JSON.stringify({ text: (v3 ? text : stripAudioTags(text)).slice(0, 1500), model_id: c.model, voice_settings }),
    });
  } catch {
    throw new Error("The browser could not reach ElevenLabs.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail = typeof data?.detail === "string" ? data.detail : data?.detail?.message;
    throw new Error(`ElevenLabs returned an error (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return res.blob();
}
