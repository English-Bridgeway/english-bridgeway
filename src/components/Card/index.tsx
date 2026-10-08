import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({ children, className, interactive, ...rest }: { children: ReactNode; interactive?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-line bg-white shadow-card",
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:border-ink-200",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
