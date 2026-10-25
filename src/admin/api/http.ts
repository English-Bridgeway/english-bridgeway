import { apiFetch, HttpError } from "../../utils/backend";
import type { CollectionKey } from "../../data/content";
import type { SiteSettings } from "../../data/site";
import { ApiError, type AdminApi, type AdminEbook, type AdminSession, type AppRelease, type AdminUser, type LearnerDetail, type LearnerSummary } from "./types";
import { API_BASE } from "../../utils/backend";
import { getSession, notifyUnauthorized } from "./session";

async function call<T>(path: string, init: { method?: string; json?: unknown; auth?: boolean } = {}): Promise<T> {
  const token = init.auth === false ? undefined : getSession()?.token;
  try {
    return await apiFetch<T>(`/admin${path}`, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), json: init.json, token });
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 401 && init.auth !== false) notifyUnauthorized();
      throw new ApiError(err.message, err.status);
    }
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  }
}

const enc = encodeURIComponent;

/** Photo paths come relative to the API (/avatars/…). */
const withBase = <T extends LearnerSummary>(l: T): T => (l.avatarUrl?.startsWith("/avatars/") ? { ...l, avatarUrl: `${API_BASE}${l.avatarUrl}` } : l);
const learner = (p: Promise<LearnerDetail>) => p.then(withBase);

/** Cover paths come relative to the API (/ebooks/…). */
const ebook = (b: AdminEbook): AdminEbook => (b.coverUrl?.startsWith("/") ? { ...b, coverUrl: `${API_BASE}${b.coverUrl}` } : b);

/** Sends a file as the raw request body. XHR rather than fetch, for upload progress on big PDFs. */
function upload<T>(path: string, file: File, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${API_BASE}/admin${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${getSession()?.token ?? ""}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("Accept", "application/json");
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data: { message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Nginx answers 413 with HTML.
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      if (xhr.status === 401) notifyUnauthorized();
      reject(new ApiError(data.message || (xhr.status === 413 ? "The file is too big for the server. Raise client_max_body_size in Nginx." : `Upload failed (${xhr.status})`), xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("The upload stopped. Check your connection and try again.", 0));
    xhr.send(file);
  });
}

/** Admin API backed by the server in server/ (VITE_API_BASE). */
export const httpApi: AdminApi = {
  mode: "live",
  async login(email, password) {
    const res = await call<{ token: string; admin: AdminUser; expiresInHours: number }>("/auth/login", { json: { email, password }, auth: false });
    return { token: res.token, admin: res.admin, expiresAt: Date.now() + res.expiresInHours * 3600_000 } satisfies AdminSession;
  },
  me: () => call("/me"),
  stats: () => call("/stats"),
  listContent: (c: CollectionKey) => call(`/content/${c}`),
  saveContent: (c, record, originalKey) => call(`/content/${c}/${enc(originalKey ?? record.key)}`, { method: "PUT", json: record }),
  deleteContent: (c, key) => call(`/content/${c}/${enc(key)}`, { method: "DELETE" }),
  reorderContent: (c, keys) => call(`/content/${c}/reorder`, { json: { keys } }),
  getSite: () => call<SiteSettings>("/settings/site"),
  saveSite: (site) => call("/settings/site", { method: "PUT", json: site }),
  getPolicies: () => call("/settings/policies"),
  savePolicies: (policies) => call("/settings/policies", { method: "PUT", json: policies }),
  getPayments: () => call("/settings/payments"),
  savePayments: (input) => call("/settings/payments", { method: "PUT", json: input }),
  testPayments: () => call("/settings/payments/test", { json: {} }),
  listOrders: () => call("/orders"),
  syncOrder: (id) => call(`/orders/${enc(id)}/sync`, { json: {} }),
  refundOrder: (id, reason) => call(`/orders/${enc(id)}/refund`, { json: { reason } }),
  listMessages: () => call("/messages"),
  updateMessage: (id, status) => call(`/messages/${enc(id)}`, { method: "PATCH", json: { status } }),
  deleteMessage: (id) => call(`/messages/${enc(id)}`, { method: "DELETE" }),
  listAdmins: () => call("/admins"),
  saveAdmin: ({ id, ...input }) => (id ? call(`/admins/${enc(id)}`, { method: "PUT", json: input }) : call("/admins", { json: input })),
  deleteAdmin: (id) => call(`/admins/${enc(id)}`, { method: "DELETE" }),
  changePassword: (current, next) => call("/me/password", { json: { current, next } }),
  listAudit: () => call("/audit"),
  listLearners: (q) => call<LearnerSummary[]>(`/learners${q ? `?q=${enc(q)}` : ""}`).then((rows) => rows.map(withBase)),
  getLearner: (id) => learner(call(`/learners/${enc(id)}`)),
  setLearnerAccess: (id, change) => learner(call(`/learners/${enc(id)}/access`, { method: "PUT", json: change })),
  setLearnerOffer: (id, offer) => learner(offer ? call(`/learners/${enc(id)}/offer`, { method: "PUT", json: offer }) : call(`/learners/${enc(id)}/offer`, { method: "DELETE" })),
  setLearnerBlocked: (id, blocked, reason) => learner(call(`/learners/${enc(id)}/block`, { method: "PUT", json: { blocked, reason } })),
  saveLearnerNote: (id, adminNote) => learner(call(`/learners/${enc(id)}`, { method: "PATCH", json: { adminNote } })),
  deleteLearner: (id) => call(`/learners/${enc(id)}`, { method: "DELETE" }),
  getAccessSettings: () => call("/settings/access"),
  saveAccessSettings: (input) => call("/settings/access", { method: "PUT", json: input }),
  getPlans: () => call("/settings/plans"),
  savePlans: (plans) => call("/settings/plans", { method: "PUT", json: { plans } }),
  listEbooks: () => call<AdminEbook[]>("/ebooks").then((rows) => rows.map(ebook)),
  saveEbook: (input, id) => call<AdminEbook>(id ? `/ebooks/${enc(id)}` : "/ebooks", { method: id ? "PUT" : "POST", json: input }).then(ebook),
  deleteEbook: (id) => call(`/ebooks/${enc(id)}`, { method: "DELETE" }),
  reorderEbooks: (ids) => call<AdminEbook[]>("/ebooks/reorder", { json: { ids } }).then((rows) => rows.map(ebook)),
  uploadEbookFile: (id, file, onProgress) =>
    upload<AdminEbook>(`/ebooks/${enc(id)}/file?name=${enc(file.name)}`, new File([file], file.name, { type: "application/pdf" }), onProgress).then(ebook),
  uploadEbookCover: (id, file) => upload<AdminEbook>(`/ebooks/${enc(id)}/cover`, file).then(ebook),
  removeEbookCover: (id) => call<AdminEbook>(`/ebooks/${enc(id)}/cover`, { method: "DELETE" }).then(ebook),
  getAppRelease: () => call<{ release: AppRelease | null }>("/app/release").then((r) => r.release),
  uploadApk: (file, input, onProgress) => {
    const q = new URLSearchParams({ versionName: input.versionName, buildNumber: String(input.buildNumber), minBuild: String(input.minBuild), notes: input.notes });
    return upload<{ release: AppRelease }>(`/app/apk?${q}`, new File([file], file.name, { type: "application/vnd.android.package-archive" }), onProgress).then((r) => r.release);
  },
  updateAppRelease: (input) => call<{ release: AppRelease }>("/app/release", { method: "PUT", json: input }).then((r) => r.release),
  getAi: () => call("/settings/ai"),
  saveAi: (input) => call("/settings/ai", { method: "PUT", json: input }),
  testAi: () => call("/settings/ai/test", { json: {} }),
  getTts: () => call("/settings/tts"),
  saveTts: (input) => call("/settings/tts", { method: "PUT", json: input }),
  testTts: () => call("/settings/tts/test", { json: {} }),
};
