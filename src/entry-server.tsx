import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import { AppShell } from "./App";
import { applyContent, getBundledContent, type ContentBundle } from "./data/content";
import { buildSitemapXml } from "./utils/sitemap";
import { getRouteSeo, headHtml, siteOrigin } from "./seo/routeSeo";

/**
 * Server-side rendering for search engines and a fast first paint. The API server
 * (server/src/services/ssr.ts) loads this bundle, keeps the live content in it with
 * setContent() and calls render() for each page request.
 */
export { buildSitemapXml };

export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /dashboard",
    "Disallow: /learn",
    "Disallow: /payment/",
    "",
    `Sitemap: ${siteOrigin()}/sitemap.xml`,
    "",
  ].join("\n");
}

/** The address search engines should use, from Admin → Site settings (falls back to englishbridgeway.com). */
export { siteOrigin };

// Pages for signed-in learners and the admin panel are drawn in the browser only.
const CLIENT_ONLY = /^\/(admin|learn|dashboard|speak|payment)(\/|$)/;
export const shouldRender = (pathname: string) => !CLIENT_ONLY.test(pathname);

const bundled = getBundledContent();

/** Replaces the content every page renders from (the admin panel's published content). */
export function setContent(bundle: Partial<ContentBundle> | null) {
  applyContent(bundled);
  if (bundle) applyContent(bundle);
}

export interface RenderResult {
  status: number;
  head: string;
  html: string;
}

/** Only the <head> tags, for pages that are not rendered on the server (e.g. /admin). */
export function renderHead(url: string): RenderResult {
  const u = new URL(url, "http://localhost");
  const seo = getRouteSeo(u.pathname, u.search);
  return { status: seo.status, head: headHtml(seo), html: "" };
}

export async function render(url: string): Promise<RenderResult> {
  const u = new URL(url, "http://localhost");
  const seo = getRouteSeo(u.pathname, u.search);
  // prerender waits for every lazy page chunk, so the HTML holds the whole page.
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={u.pathname + u.search}>
        <AppShell />
      </StaticRouter>
    </StrictMode>,
  );
  return { status: seo.status, head: headHtml(seo), html: await new Response(prelude).text() };
}
