import { Volume2 } from "lucide-react";
import { useState } from "react";
import { speak, useCanSpeak } from "../../utils/speech";
import { cn } from "../../utils/cn";

export function ListenButton({ text, label = "Listen", compact, className }: { text: string; label?: string; compact?: boolean; className?: string }) {
  const [active, setActive] = useState(false);
  if (!useCanSpeak()) return null;
  const onClick = () => {
    if (speak(text)) {
      setActive(true);
      setTimeout(() => setActive(false), Math.min(6000, 600 + text.length * 70));
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={compact ? `${label}: ${text}` : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-white font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50",
        compact ? "h-9 w-9" : "h-9 px-3.5 text-sm",
        active && "border-amber-400 bg-amber-50",
        className,
      )}
    >
      <Volume2 className={cn("h-4 w-4", active && "text-amber-600")} aria-hidden="true" />
      {!compact && label}
    </button>
  );
}
