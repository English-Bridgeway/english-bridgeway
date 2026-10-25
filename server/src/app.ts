import path from 'path';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config';
import { publicRouter } from './routes/public';
import { accountRouter } from './routes/account';
import { adminRouter } from './routes/admin';
import { webhookRouter } from './routes/webhooks';
import { ebooksRouter } from './routes/ebooks';
import { appRouter } from './routes/app';
import { OrderError } from './services/orders';
import { invalidateRenderedPages, serveWebsite, websiteBuildDir } from './services/ssr';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const origin = req.get('origin');
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // Webhooks need the raw body for signature checks, so they come before the JSON parser.
  app.use('/api/webhooks', webhookRouter);
  app.use(express.json({ limit: '2mb' }));
  // Any admin change (content, site settings) refreshes the server-rendered pages.
  app.use('/api/admin', (req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => res.statusCode < 400 && invalidateRenderedPages());
    next();
  });
  app.use('/api/admin', adminRouter);
  app.use('/api', accountRouter);
  app.use('/api', ebooksRouter);
  app.use('/api', appRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  // The website: server-rendered pages, sitemap.xml and robots.txt (see services/ssr.ts).
  // When the build is here too, its files are served as well, so the API alone can run the
  // whole site; behind Nginx (Docker) Nginx serves the files and sends page requests here.
  const dist = websiteBuildDir;
  if (dist) {
    app.get(['/robots.txt', '/sitemap.xml'], serveWebsite);
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use(serveWebsite);
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof OrderError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Invalid JSON.' });
      return;
    }
    console.error(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  };
  app.use(onError);
  return app;
}
