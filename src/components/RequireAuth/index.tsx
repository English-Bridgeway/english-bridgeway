import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

/** Shows its page only to signed-in learners; everyone else goes to Log in and comes back after. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-ink-500" aria-label="Loading your account" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Where to go after logging in: the ?next= page when it is on this site, else the learner portal. */
export function safeNext(search: string) {
  const next = new URLSearchParams(search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}
