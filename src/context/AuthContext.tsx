import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "../types";
import { HttpError } from "../utils/backend";
import { clearLearnerSession, fetchMe, getLearnerSession, login, register } from "../utils/account";

/**
 * The signed-in learner. Sessions are kept on this device for 30 days; the server is asked
 * who the learner is (and which paid courses they own) when the site loads and after a purchase.
 */
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** False until the saved session has been checked with the server. */
  ready: boolean;
  purchasedCourseIds: string[];
  hasCourse: (courseId: string) => boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(getLearnerSession);
  const [purchasedCourseIds, setPurchased] = useState<string[]>([]);
  const [ready, setReady] = useState(!session);

  const token = session?.token ?? null;

  const signOut = useCallback(() => {
    clearLearnerSession();
    setSession(null);
    setPurchased([]);
  }, []);

  const refresh = useCallback(async () => {
    const current = getLearnerSession();
    if (!current) return;
    try {
      const me = await fetchMe(current.token);
      setSession((s) => (s ? { ...s, user: me.user } : s));
      setPurchased(me.purchasedCourseIds);
    } catch (e) {
      // Only a rejected session logs the learner out; a network blip keeps them signed in.
      if (e instanceof HttpError && e.status === 401) signOut();
    }
  }, [signOut]);

  useEffect(() => {
    if (!token) return;
    refresh().finally(() => setReady(true));
  }, [token, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token,
      isAuthenticated: Boolean(session),
      ready,
      purchasedCourseIds,
      hasCourse: (id) => purchasedCourseIds.includes(id),
      refresh,
      signIn: async (email, password) => {
        const s = await login(email, password);
        setReady(false);
        setSession(s);
      },
      signUp: async (name, email, password) => {
        const s = await register(name, email, password);
        setReady(false);
        setSession(s);
      },
      signOut,
    }),
    [session, token, ready, purchasedCourseIds, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
