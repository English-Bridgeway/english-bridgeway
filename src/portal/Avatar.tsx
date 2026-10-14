import { useState } from "react";
import type { User } from "../types";
import { cn } from "../utils/cn";

/** The learner's photo, or their initials when there is none (or it fails to load). */
export function UserAvatar({ user, className }: { user: Pick<User, "name" | "avatarInitials" | "avatarUrl"> | null | undefined; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const url = user?.avatarUrl && user.avatarUrl !== broken ? user.avatarUrl : null;
  return url ? (
    <img src={url} alt="" onError={() => setBroken(url)} className={cn("shrink-0 rounded-full object-cover", className ?? "h-10 w-10")} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-amber-100 font-display font-semibold text-amber-800", className ?? "h-10 w-10")} aria-hidden="true">
      {user?.avatarInitials ?? "ST"}
    </span>
  );
}
