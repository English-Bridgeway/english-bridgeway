/**
 * Where the API (server/) lives. Set VITE_API_BASE to its /api URL, e.g. "/api" when the
 * API serves the site, or "https://api.example.com/api". Without it the site runs in demo
 * mode: content, orders and admin changes are kept in this browser only (see demoStore.ts).
 */
const raw = import.meta.env.VITE_API_BASE as string | undefined;
export const API_BASE = raw ? raw.replace(/\/$/, "") : "";
export const isLive = Boolean(API_BASE);

export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown; token?: string } = {}): Promise<T> {
  const { json, token, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError((data as { message?: string }).message || `Request failed (${res.status})`, res.status);
  return data as T;
}
