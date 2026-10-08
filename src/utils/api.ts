/**
 * Thin API layer. Pages call these functions instead of fetch() directly,
 * so a real backend can be plugged in by changing this file only.
 */
export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// Set VITE_CONTACT_ENDPOINT in .env (e.g. a Formspree URL or your own API) to deliver messages.
const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined;
export const contactIsLive = Boolean(CONTACT_ENDPOINT);

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  if (!CONTACT_ENDPOINT) {
    // Demo mode: simulate a short network request.
    await new Promise((r) => setTimeout(r, 700));
    return;
  }
  const res = await fetch(CONTACT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
}
