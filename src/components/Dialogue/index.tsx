import type { DialogueLine } from "../../types";
import { ListenButton } from "../ListenButton";
import { cn } from "../../utils/cn";

/** Chat-style conversation: Speaker A on the left, Speaker B on the right. */
export function Dialogue({ lines, highlight }: { lines: DialogueLine[]; highlight?: number }) {
  return (
    <ol className="space-y-4">
      {lines.map((l, i) => {
        const b = l.speaker === "B";
        return (
          <li key={i} className={cn("flex items-end gap-2.5", b && "flex-row-reverse")}>
            <span
              aria-hidden="true"
              className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold", b ? "bg-amber-100 text-amber-800" : "bg-ink-100 text-ink-800")}
            >
              {l.name.slice(0, 2)}
            </span>
            <div className={cn("flex max-w-[85%] items-end gap-2 sm:max-w-[75%]", b && "flex-row-reverse")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 transition-shadow",
                  b ? "rounded-br-md bg-amber-50 text-ink-900" : "rounded-bl-md bg-ink-800 text-white",
                  highlight === i && "ring-3 ring-amber-400",
                )}
              >
                <p className={cn("text-xs font-semibold", b ? "text-amber-800" : "text-ink-200")}>
                  <span className="sr-only">Speaker {l.speaker}, </span>{l.name}
                </p>
                <p className="mt-0.5 text-[0.98rem] leading-relaxed">{l.text}</p>
              </div>
              <ListenButton text={l.text} compact label={`Listen to ${l.name}`} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
