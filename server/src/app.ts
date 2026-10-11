import fs from 'fs';
import path from 'path';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config';
import { publicRouter } from './routes/public';
import { adminRouter } from './routes/admin';
import { webhookRouter } from './routes/webhooks';
import { OrderError } from './services/orders';

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
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  // Optionally serve the built website (npm run build in the project root) from the same server.
  const dist = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
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
