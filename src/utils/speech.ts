/** Text-to-speech using the browser's built-in voices. No network calls. */
import { useSyncExternalStore } from "react";
import { site } from "../data/site";

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const noSubscribe = () => () => {};
/**
 * canSpeak() for rendering: false in the server-rendered HTML and while React takes it over,
 * then the browser's real answer, so the first render matches the server's.
 */
export const useCanSpeak = () => useSyncExternalStore(noSubscribe, canSpeak, () => false);

// Friendly female English voices, best first. Names differ by browser and OS:
// Edge's "Online (Natural)" voices, Chrome's Google voices, Apple and Windows voices.
const PREFERRED_FEMALE = [
  "Microsoft Libby Online (Natural)",
  "Microsoft Sonia Online (Natural)",
  "Microsoft Maisie Online (Natural)",
  "Microsoft Ava Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Aria Online (Natural)",
  "Microsoft Emma Online (Natural)",
  "Google UK English Female",
  "Google US English",
  "Samantha",
  "Serena",
  "Kate",
  "Stephanie",
  "Martha",
  "Tessa",
  "Karen",
  "Moira",
  "Fiona",
  "Victoria",
  "Microsoft Hazel",
  "Microsoft Susan",
  "Microsoft Zira",
];
const FEMALE_HINT = /female|woman|girl|libby|sonia|maisie|ava|jenny|aria|emma|samantha|serena|kate|stephanie|martha|tessa|karen|moira|fiona|victoria|hazel|susan|zira|heera|veena/i;
const MALE_HINT = /\bmale\b|daniel|arthur|oliver|george|ryan|guy|david|mark|alex|fred|rishi|thomas|james|ravi/i;

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (!canSpeak()) return [];
  if (!voices.length) voices = window.speechSynthesis.getVoices();
  return voices;
}
if (canSpeak()) {
  // Chrome loads voices asynchronously; refresh the list when it arrives.
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    voices = window.speechSynthesis.getVoices();
  });
}

/** English voices available in this browser, for the admin voice picker. */
export function englishVoices(): SpeechSynthesisVoice[] {
  return loadVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

/** The voice to use: the one chosen in Site settings if this device has it, else a friendly female English voice. */
export function pickVoice(preferred = site.voice?.name): SpeechSynthesisVoice | undefined {
  const english = englishVoices();
  if (!english.length) return undefined;
  if (preferred) {
    const chosen = english.find((v) => v.name === preferred);
    if (chosen) return chosen;
  }
  for (const name of PREFERRED_FEMALE) {
    const v = english.find((x) => x.name === name || x.name.startsWith(name));
    if (v) return v;
  }
  const female = english.filter((v) => FEMALE_HINT.test(v.name) && !MALE_HINT.test(v.name));
  const byLang = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => v.lang === "en-GB") ?? list.find((v) => v.lang === "en-IN") ?? list.find((v) => v.lang === "en-US") ?? list[0];
  return byLang(female) ?? byLang(english.filter((v) => !MALE_HINT.test(v.name))) ?? byLang(english);
}

export interface SpeakOptions {
  rate?: number;
  /** Added to the configured pitch, e.g. to tell two speakers apart. */
  pitchShift?: number;
  voiceName?: string;
  pitch?: number;
}

/** Builds an utterance with the site's voice, pitch and speed. */
export function makeUtterance(text: string, opts: SpeakOptions = {}): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(opts.voiceName);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-GB";
  u.rate = opts.rate ?? site.voice?.rate ?? 0.92;
  u.pitch = Math.min(2, Math.max(0, (opts.pitch ?? site.voice?.pitch ?? 1.15) + (opts.pitchShift ?? 0)));
  return u;
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!canSpeak()) return false;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(makeUtterance(text, opts));
    return true;
  } catch {
    return false;
  }
}
