import { Router, type ErrorRequestHandler } from 'express';
import { asyncHandler, rateLimit, requireLearner } from '../middleware';
import { learnerFromToken } from '../services/learners';
import { coverFile, EbookError, fileForLink, findEbook, linkFor, listForLearner } from '../services/ebooks';

// E-books for learners. Anyone can see the library (locked e-books show what a paid course
// unlocks); reading and downloading need a paid course, checked on every request.
export const ebooksRouter = Router();

ebooksRouter.get(
  '/ebooks',
  asyncHandler(async (req, res) => {
    const header = req.get('authorization') || '';
    const learner = header.startsWith('Bearer ') ? await learnerFromToken(header.slice(7)) : null;
    res.setHeader('Cache-Control', 'private, no-cache');
    res.json(await listForLearner(learner));
  }),
);

/** A short-lived link to read ({download:false}) or download ({download:true}) the PDF. */
ebooksRouter.post(
  '/ebooks/:id/link',
  requireLearner,
  rateLimit({ windowMs: 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    res.json(await linkFor(req.learner!, req.params.id, req.body?.download === true));
  }),
);

ebooksRouter.get(
  '/ebooks/:id/file',
  asyncHandler(async (req, res) => {
    const file = await fileForLink(req.params.id, req.query as Record<string, unknown>);
    const name = file.fileName.replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Disposition', `${file.download ? 'attachment' : 'inline'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    // sendFile answers Range requests, so PDF viewers can load page by page.
    res.sendFile(file.path, { headers: { 'Content-Type': 'application/pdf' }, cacheControl: false, lastModified: false }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The PDF file is missing. Please tell us.' });
    });
  }),
);

ebooksRouter.get(
  '/ebooks/:id/cover',
  asyncHandler(async (req, res) => {
    const book = await findEbook(req.params.id);
    const cover = book?.published ? coverFile(book) : null;
    if (!cover) {
      res.status(404).json({ message: 'No cover.' });
      return;
    }
    res.sendFile(cover.path, { headers: { 'Content-Type': cover.mime }, maxAge: req.query.v ? '365d' : 0, immutable: Boolean(req.query.v) }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'No cover.' });
    });
  }),
);

const onEbookError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof EbookError) {
    res.status(err.status).json({ message: err.message, code: err.code });
    return;
  }
  next(err);
};
ebooksRouter.use(onEbookError);
