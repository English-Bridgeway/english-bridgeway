import type { AdminSession } from "./types";

// The admin session lives in sessionStorage: closing the tab signs the admin out.
const KEY = "english-bridgeway:admin-session";

export function getSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as AdminSession) : null;
    return s && s.token && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: AdminSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the session still works until reload.
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};
export const notifyUnauthorized = () => onUnauthorized();
