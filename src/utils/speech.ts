/** Text-to-speech using the browser's built-in voices. No network calls. */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text: string, rate = 0.9) {
  if (!canSpeak()) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
