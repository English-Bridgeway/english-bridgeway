import { useEffect, useState } from "react";

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(totalSeconds: number) {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Seconds since `since`, ticking once a second (0 when there is no start time). */
export function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}

let audioCtx: AudioContext | null = null;

/** True while there is sound on this stream (someone talking). Cheap: one sample every 120 ms. */
export function useSpeaking(stream: MediaStream | null | undefined, enabled = true) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || !enabled || !stream.getAudioTracks().length) {
      setSpeaking(false);
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      audioCtx ??= new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => undefined);
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = false;
      timer = setInterval(() => {
        analyser!.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) * (v - 128);
        const now = Math.sqrt(sum / data.length) > 6;
        if (now !== last) setSpeaking((last = now));
      }, 120);
    } catch {
      /* no level meter on this browser */
    }
    return () => {
      if (timer) clearInterval(timer);
      source?.disconnect();
      analyser?.disconnect();
    };
  }, [stream, enabled]);
  return speaking;
}
