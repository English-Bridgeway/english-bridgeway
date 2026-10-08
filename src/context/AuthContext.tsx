import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { User } from "../types";
import { mockUser } from "../data/dashboard";

/**
 * Authentication placeholder. No real sign-in happens yet: the app always shows the demo student.
 * To add auth later, implement signIn/signUp/signOut with your provider and keep this interface,
 * so pages (Navbar, Dashboard, Login, Register) don't need to change.
 */
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  authEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const notReady = { ok: false, message: "Student accounts are coming soon. Your progress is saved on this device for now." };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User | null>(mockUser);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: false,
      authEnabled: false,
      signIn: async () => notReady,
      signUp: async () => notReady,
      signOut: () => {},
    }),
    [user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
