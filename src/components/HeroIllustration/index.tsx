import { CircleCheck, Flame, Volume2 } from "lucide-react";

/** Product-style hero visual built from UI fragments (no image download needed). Decorative. */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-lg select-none" aria-hidden="true">
      {/* backdrop */}
      <div className="absolute inset-[6%] rounded-[2.5rem] bg-ink-100" />
      <div className="absolute left-[12%] top-[10%] font-display text-[7rem] font-bold leading-none text-ink-200/70 sm:text-[9rem]">Aa</div>

      {/* lesson card */}
      <div className="absolute right-[4%] top-[8%] w-[58%] rounded-2xl border border-line bg-white p-4 shadow-lift">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-500">Grammar · Lesson 3</p>
        <p className="mt-1 font-display text-sm font-semibold text-ink-900 sm:text-base">Present Simple Tense</p>
        <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2 font-mono text-[0.7rem] text-ink-700 sm:text-xs">Subject + V1(s/es) + Object</div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-50"><div className="h-full w-[65%] rounded-full bg-ink-500" /></div>
        <p className="mt-1.5 text-[0.65rem] text-muted">65% complete</p>
      </div>

      {/* chat bubbles */}
      <div className="absolute left-[4%] top-[44%] w-[52%] space-y-2">
        <div className="w-fit rounded-2xl rounded-bl-md bg-brand-primary px-3.5 py-2 text-xs text-white shadow-card sm:text-sm">Hi, what's your name?</div>
        <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-amber-100 px-3.5 py-2 text-xs text-ink-900 shadow-card sm:text-sm">I'm Rahul. Nice to meet you!</div>
      </div>

      {/* word card */}
      <div className="absolute bottom-[6%] right-[8%] w-[46%] rounded-2xl border border-line bg-white p-4 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold text-ink-900 sm:text-lg">punctual</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-50 text-amber-600"><Volume2 className="h-3.5 w-3.5" /></span>
        </div>
        <p className="font-mono text-[0.65rem] text-muted">/ˈpʌŋk.tʃu.əl/ · adj.</p>
        <p className="mt-1.5 text-[0.7rem] text-ink-800 sm:text-xs">Arriving at the expected time.</p>
      </div>

      {/* quiz chip */}
      <div className="absolute bottom-[14%] left-[10%] flex items-center gap-2 rounded-xl border border-brand-sky/25 bg-white px-3 py-2 shadow-card">
        <CircleCheck className="h-4 w-4 text-brand-sky" />
        <span className="text-xs font-semibold text-ink-900">She <u className="decoration-amber-400 decoration-2">goes</u> to school.</span>
      </div>

      {/* streak chip */}
      <div className="absolute left-[38%] top-[2%] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-card">
        <Flame className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold text-ink-900">12-day streak</span>
      </div>
    </div>
  );
}
