import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminApi, type AdminSession, type AdminUser } from "./api";
import { clearSession, getSession, saveSession, setUnauthorizedHandler } from "./api/session";

interface Toast { id: number; tone: "success" | "error"; text: string }

interface AdminContextValue {
  admin: AdminUser | null;
  isOwner: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const Ctx = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => getSession());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  // Refresh the admin's details (role, active) on load.
  useEffect(() => {
    if (!session) return;
    adminApi.me().then((admin) => {
      const next = { ...session, admin };
      saveSession(next);
      setSession(next);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo<AdminContextValue>(() => ({
    admin: session?.admin ?? null,
    isOwner: session?.admin.role === "owner",
    signIn: async (email, password) => {
      const s = await adminApi.login(email, password);
      saveSession(s);
      setSession(s);
    },
    signOut,
    toast,
  }), [session, signOut, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === "error" ? "bg-red-700" : "bg-ink-900"}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAdmin() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin must be used inside AdminProvider");
  return v;
}
