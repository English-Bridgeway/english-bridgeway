import { cn } from "../../utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ink-100/70", className)} aria-hidden="true" />;
}

/** Fallback shown while a lazy-loaded page chunk downloads. */
export function PageSkeleton() {
  return (
    <div className="container-page py-12" role="status" aria-label="Loading page">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
      </div>
    </div>
  );
}
