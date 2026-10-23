import { API_BASE, apiFetch, isLive } from "./backend";

/** An e-book in the learner's library. `unlocked` says whether this learner can read it. */
export interface Ebook {
  id: string;
  title: string;
  author: string;
  description: string;
  courseId: string | null;
  courseTitle: string | null;
  fileSize: number | null;
  coverUrl: string | null;
  updatedAt: string;
  unlocked: boolean;
  lockedReason: string | null;
}

const withBase = (path: string) => (path.startsWith("/") ? `${API_BASE}${path}` : path);

/** The published e-books. Empty in demo mode: the PDFs live on the server. */
export async function getEbooks(token: string | null): Promise<Ebook[]> {
  if (!isLive) return [];
  const rows = await apiFetch<Ebook[]>("/ebooks", { token: token ?? undefined });
  return rows.map((b) => ({ ...b, coverUrl: b.coverUrl ? withBase(b.coverUrl) : null }));
}

/** A short-lived link to the PDF, signed for this learner. The server checks their access first. */
export async function getEbookLink(token: string, id: string, download: boolean): Promise<string> {
  const { url } = await apiFetch<{ url: string }>(`/ebooks/${encodeURIComponent(id)}/link`, { method: "POST", token, json: { download } });
  return withBase(url);
}
