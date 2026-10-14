import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { ContentItem } from '../db';
import { publicBundle } from './content';
import { config } from '../config';

/**
 * Serves the website's pages fully rendered, so search engines (and visitors' first paint)
 * get real HTML with the right title, description, canonical URL and structured data
 * instead of an empty <div id="root">. Also serves /sitemap.xml and /robots.txt.
 *
 * Needs the website build: `npm run build` in the project root makes dist/ (the page
 * template and assets) and dist-ssr/ (the renderer). WEB_DIST points at dist/ when it
 * is somewhere else (the Docker image sets it). Without the build, nothing here runs.
 */

interface RenderResult {
  status: number;
  head: string;
  html: string;
}

interface Renderer {
  setContent(bundle: unknown): void;
  render(url: string): Promise<RenderResult>;
  renderHead(url: string): RenderResult;
  shouldRender(pathname: string): boolean;
  buildSitemapXml(lastmod?: (collection: string, key: string) => string | undefined): string;
  buildRobotsTxt(): string;
}

const webDist = path.resolve(process.env.WEB_DIST || path.resolve(__dirname, '../../../dist'));
const ssrEntry = path.resolve(process.env.SSR_ENTRY || path.join(webDist, '../dist-ssr/entry-server.mjs'));

export const websiteBuildDir = fs.existsSync(path.join(webDist, 'index.html')) ? webDist : null;
export const ssrAvailable = Boolean(websiteBuildDir && fs.existsSync(ssrEntry));

// TypeScript compiles import() to require() for CommonJS; the renderer is an ES module.
const importEsm = new Function('p', 'return import(p)') as (p: string) => Promise<Renderer>;

let renderer: Promise<Renderer> | null = null;
let template = '';
const CONTENT_TTL_MS = 60_000;
let contentLoadedAt = 0;
let lastmods = new Map<string, string>();
const pageCache = new Map<string, RenderResult>();
const MAX_CACHED_PAGES = 1000;

function getRenderer(): Promise<Renderer> {
  if (!renderer) {
    template = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
    renderer = importEsm(`file://${ssrEntry}`).catch((err) => {
      renderer = null;
      throw err;
    });
  }
  return renderer;
}

/** Called after any admin change, so the next page view shows (and caches) the new content. */
export function invalidateRenderedPages() {
  contentLoadedAt = 0;
  pageCache.clear();
}

// Renders run one at a time: they read content that a refresh replaces in place.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function withFreshContent(r: Renderer) {
  if (Date.now() - contentLoadedAt < CONTENT_TTL_MS) return;
  const bundle = (await publicBundle()) as { site?: Record<string, unknown> };
  // Until the admin sets the real address, use PUBLIC_SITE_URL for canonical links.
  const site = bundle.site ?? {};
  const url = String(site.url ?? '');
  if ((!url || /\.example\b|localhost/.test(url)) && /^https:\/\//.test(config.publicSiteUrl)) {
    bundle.site = { ...site, url: config.publicSiteUrl };
  }
  r.setContent(bundle);
  const rows = await ContentItem.findAll({ where: { published: true }, attributes: ['collection', 'key', 'updatedAt'] });
  lastmods = new Map(rows.map((row) => [`${row.collection}/${row.key}`, row.updatedAt.toISOString()]));
  contentLoadedAt = Date.now();
  pageCache.clear();
}

function page(result: RenderResult) {
  return template
    .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, result.head)
    .replace('<!--app-html-->', result.html);
}

/** Express handler for every non-API GET: sitemap.xml, robots.txt and the website's pages. */
export async function serveWebsite(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!ssrAvailable) return next();
  const pathname = req.path;
  try {
    const r = await getRenderer();

    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      const body = await exclusive(async () => {
        await withFreshContent(r);
        return pathname === '/robots.txt' ? r.buildRobotsTxt() : r.buildSitemapXml((c, k) => lastmods.get(`${c}/${k}`));
      });
      res.type(pathname === '/robots.txt' ? 'text/plain' : 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(body);
      return;
    }

    // Missing files (/old-logo.png, /wp-login.php) get a plain 404, not a page.
    if (/\.[a-z0-9]{2,5}$/i.test(pathname) && pathname !== '/index.html') {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    // One URL per page: /grammar/ → /grammar.
    if (pathname.length > 1 && pathname.endsWith('/')) {
      const query = req.originalUrl.slice(req.originalUrl.indexOf('?') >= 0 ? req.originalUrl.indexOf('?') : req.originalUrl.length);
      res.redirect(301, pathname.replace(/\/+$/, '') + query);
      return;
    }

    const url = req.originalUrl;
    const result = await exclusive(async () => {
      await withFreshContent(r);
      const cached = pageCache.get(url);
      if (cached) return cached;
      let out: RenderResult;
      if (!r.shouldRender(pathname)) {
        out = r.renderHead(url);
      } else {
        try {
          out = await r.render(url);
        } catch (err) {
          console.error('Page render failed, sending the browser-rendered page instead:', url, err);
          return r.renderHead(url);
        }
      }
      // Search results pages vary endlessly; don't let them crowd out real pages.
      if (!req.query.q && pageCache.size < MAX_CACHED_PAGES) pageCache.set(url, out);
      return out;
    });

    res.status(result.status);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (result.status === 404) res.setHeader('X-Robots-Tag', 'noindex');
    res.send(page(result));
  } catch (err) {
    // The renderer could not load (or the database is down): fall back to the plain app.
    console.error('Website rendering unavailable:', err);
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(webDist, 'index.html'));
  }
}
