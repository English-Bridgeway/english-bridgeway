import { applyContent, type ContentBundle } from "../data/content";
import { apiFetch, isLive } from "./backend";
import { demoContentBundle } from "./demoStore";

export async function loadContent(): Promise<void> {
  // The admin panel loads its own data; it doesn't need the public bundle.
  const path = window.location.hash.replace(/^#/, "") || window.location.pathname;
  if (path.startsWith("/admin")) return;
  try {
    if (isLive) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const bundle = await apiFetch<ContentBundle>("/content", { signal: controller.signal }).finally(() => clearTimeout(timer));
      applyContent(bundle);
    } else {
      const bundle = demoContentBundle();
      if (bundle) applyContent(bundle);
    }
  } catch {
    // API unreachable: keep the bundled content so the site still works.
  }
}
