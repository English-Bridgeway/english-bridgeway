import { Router, type ErrorRequestHandler } from 'express';
import { asyncHandler } from '../middleware';
import { audit } from '../services/audit';
import {
  adminEbook, deleteEbook, EbookError, listForAdmin, removeCover, reorderEbooks, saveEbook, uploadCover, uploadPdf,
} from '../services/ebooks';

// Admin → E-books: add an e-book, upload its PDF and cover, choose who can open it, publish.
// The PDF and cover are sent as the raw request body (not JSON), so big files stream to disk.
export const adminEbooksRouter = Router();

adminEbooksRouter.get(
  '/ebooks',
  asyncHandler(async (_req, res) => {
    res.json(await listForAdmin());
  }),
);

adminEbooksRouter.post(
  '/ebooks',
  asyncHandler(async (req, res) => {
    const book = await saveEbook(null, req.body ?? {});
    await audit(req.admin!.email, 'Added e-book', book.title);
    res.status(201).json(book);
  }),
);

adminEbooksRouter.post(
  '/ebooks/reorder',
  asyncHandler(async (req, res) => {
    await reorderEbooks(req.body?.ids);
    res.json(await listForAdmin());
  }),
);

adminEbooksRouter.get(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    res.json(await adminEbook(req.params.id));
  }),
);

adminEbooksRouter.put(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    const book = await saveEbook(req.params.id, req.body ?? {});
    await audit(req.admin!.email, 'Updated e-book', book.title);
    res.json(book);
  }),
);

adminEbooksRouter.delete(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    const title = await deleteEbook(req.params.id);
    await audit(req.admin!.email, 'Deleted e-book', title);
    res.status(204).end();
  }),
);

/** The PDF itself: Content-Type application/pdf, the file as the body, its name in ?name=. */
adminEbooksRouter.put(
  '/ebooks/:id/file',
  asyncHandler(async (req, res) => {
    if (!/^application\/(pdf|octet-stream)/.test(req.get('content-type') ?? '')) throw new EbookError('Send the PDF with Content-Type: application/pdf.', 415);
    const book = await uploadPdf(req.params.id, req, req.query.name);
    await audit(req.admin!.email, 'Uploaded e-book PDF', `${book.title} (${book.fileName})`);
    res.json(book);
  }),
);

/** The cover: a JPG, PNG or WebP image as the body. */
adminEbooksRouter.put(
  '/ebooks/:id/cover',
  asyncHandler(async (req, res) => {
    res.json(await uploadCover(req.params.id, req, (req.get('content-type') ?? '').split(';')[0]!.trim()));
  }),
);

adminEbooksRouter.delete(
  '/ebooks/:id/cover',
  asyncHandler(async (req, res) => {
    res.json(await removeCover(req.params.id));
  }),
);

const onEbookError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof EbookError) {
    res.status(err.status).json({ message: err.message, code: err.code });
    return;
  }
  next(err);
};
adminEbooksRouter.use(onEbookError);
