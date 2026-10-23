import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Transform, type Readable } from 'stream';
import { config } from '../config';
import { ContentItem, Ebook, Learner } from '../db';
import { accessState } from './access';
import { purchasedCourseIds } from './learners';

// E-books: PDFs the admin uploads. Only learners with a paid course (a bought course, a
// subscription or access the admin granted) can read or download them; the free trial can't.
// An e-book can also be tied to one course, and then only that course's buyers (or learners
// with full access) can open it.
//
// The PDF never has a public URL. A signed-in learner asks for a link (POST /api/ebooks/:id/link),
// the server checks their access and answers with a short-lived signed URL for that learner,
// and the file route checks the signature and the learner's access again before sending it.

export class EbookError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code?: string) {
    super(message);
  }
}

const COVER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const COVER_MAX_BYTES = 3 * 1024 * 1024;
/** Read links last long enough for a long reading session (the PDF viewer fetches pages as you scroll). */
const READ_LINK_SECONDS = 4 * 60 * 60;
const DOWNLOAD_LINK_SECONDS = 10 * 60;

const pdfPath = (id: string) => path.join(config.ebooksDir, `${id}.pdf`);
const coverPath = (id: string, mime: string) => path.join(config.ebooksDir, `${id}.cover.${COVER_TYPES[mime] ?? 'img'}`);
const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function findEbook(id: string): Promise<Ebook | null> {
  return isUuid(id) ? Ebook.findByPk(id) : null;
}

/** Paid courses by id, for titles and for checking an e-book's course. */
async function courseTitles(): Promise<Map<string, string>> {
  const rows = await ContentItem.findAll({ where: { collection: 'courses' }, attributes: ['key', 'data'] });
  return new Map(rows.map((r) => [r.key, String(r.data.title ?? r.key)]));
}

// ---- Who can open an e-book ----

export interface EbookAccess {
  /** True when the learner has full access (subscription, granted or unlimited). */
  full: boolean;
  purchased: string[];
  blocked: boolean;
}

export async function ebookAccessFor(learner: Learner | null | undefined): Promise<EbookAccess | null> {
  if (!learner) return null;
  const state = accessState(learner);
  return { full: state.full, purchased: await purchasedCourseIds(learner.id), blocked: state.status === 'blocked' };
}

export function canOpen(book: Ebook, access: EbookAccess | null): boolean {
  if (!access || access.blocked) return false;
  if (access.full) return true;
  return book.courseId ? access.purchased.includes(book.courseId) : access.purchased.length > 0;
}

function lockedMessage(book: Ebook, courseTitle: string | undefined, access: EbookAccess | null): string {
  if (!access) return 'Log in to read e-books.';
  if (access.blocked) return 'Your account is blocked. Please contact us.';
  if (book.courseId) return `This e-book comes with the course “${courseTitle ?? book.courseId}”. Buy the course or a subscription to read it.`;
  return 'E-books are for learners with a paid course. Buy a course or a subscription to read them.';
}

// ---- What learners and admins see ----

function base(b: Ebook, titles: Map<string, string>) {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    description: b.description,
    courseId: b.courseId,
    courseTitle: b.courseId ? (titles.get(b.courseId) ?? null) : null,
    fileSize: b.fileSize,
    // Covers are not secret (they show on the locked card too). The version busts caches.
    coverUrl: b.coverMime && b.coverUpdatedAt ? `/ebooks/${b.id}/cover?v=${b.coverUpdatedAt.getTime()}` : null,
    updatedAt: (b.fileUpdatedAt ?? b.updatedAt).toISOString(),
  };
}

/** The published e-books that have a PDF, each with whether this learner can open it. */
export async function listForLearner(learner: Learner | null | undefined) {
  const [books, titles, access] = await Promise.all([
    Ebook.findAll({ where: { published: true }, order: [['position', 'ASC'], ['createdAt', 'DESC']] }),
    courseTitles(),
    ebookAccessFor(learner),
  ]);
  return books
    .filter((b) => b.fileName)
    .map((b) => {
      const unlocked = canOpen(b, access);
      return { ...base(b, titles), unlocked, lockedReason: unlocked ? null : lockedMessage(b, titles.get(b.courseId ?? ''), access) };
    });
}

export async function listForAdmin() {
  const [books, titles] = await Promise.all([Ebook.findAll({ order: [['position', 'ASC'], ['createdAt', 'DESC']] }), courseTitles()]);
  return books.map((b) => adminDto(b, titles));
}

export function adminDto(b: Ebook, titles: Map<string, string>) {
  return { ...base(b, titles), published: b.published, position: b.position, fileName: b.fileName, createdAt: b.createdAt.toISOString() };
}

export async function adminEbook(id: string) {
  const b = await findEbook(id);
  if (!b) throw new EbookError('E-book not found.', 404);
  return adminDto(b, await courseTitles());
}

// ---- Admin changes ----

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function saveEbook(id: string | null, input: Record<string, unknown>) {
  const title = str(input.title, 200);
  if (!title) throw new EbookError('Please give the e-book a title.');
  const courseId = str(input.courseId, 160) || null;
  const titles = await courseTitles();
  if (courseId && !titles.has(courseId)) throw new EbookError('That course does not exist.');
  const fields = {
    title,
    author: str(input.author, 120),
    description: str(input.description, 4000),
    courseId,
    published: input.published === true,
  };
  let book: Ebook;
  if (id) {
    const existing = await findEbook(id);
    if (!existing) throw new EbookError('E-book not found.', 404);
    book = await existing.update(fields);
  } else {
    const last = (await Ebook.max('position')) as number | null;
    book = await Ebook.create({ ...fields, position: (last ?? 0) + 1 });
  }
  return adminDto(book, titles);
}

export async function reorderEbooks(ids: unknown) {
  if (!Array.isArray(ids)) throw new EbookError('Send the e-book ids in order.');
  await Promise.all(ids.filter((v): v is string => typeof v === 'string' && isUuid(v)).map((id, i) => Ebook.update({ position: i + 1 }, { where: { id } })));
}

export async function deleteEbook(id: string) {
  const book = await findEbook(id);
  if (!book) throw new EbookError('E-book not found.', 404);
  await fs.promises.rm(pdfPath(book.id), { force: true });
  if (book.coverMime) await fs.promises.rm(coverPath(book.id, book.coverMime), { force: true });
  await book.destroy();
  return book.title;
}

/** Streams the request body to a temporary file next to `target`, refusing anything over `max` bytes. */
async function receive(body: Readable, target: string, max: number, tooBig: string): Promise<{ size: number; head: Buffer; tmp: string }> {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${crypto.randomBytes(6).toString('hex')}.part`;
  let size = 0;
  let head = Buffer.alloc(0);
  const counter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
      done(size > max ? new EbookError(tooBig, 413) : null, chunk);
    },
  });
  try {
    await pipeline(body, counter, fs.createWriteStream(tmp));
  } catch (err) {
    await fs.promises.rm(tmp, { force: true });
    throw err instanceof EbookError ? err : new EbookError('The upload did not finish. Please try again.', 400);
  }
  return { size, head, tmp };
}

export async function uploadPdf(id: string, body: Readable, fileName: unknown) {
  const book = await findEbook(id);
  if (!book) throw new EbookError('E-book not found.', 404);
  const max = config.ebookMaxMb * 1024 * 1024;
  const got = (await receive(body, pdfPath(book.id), max, `The PDF is bigger than ${config.ebookMaxMb} MB.`));
  // A real PDF starts with "%PDF-" (some have a few junk bytes before it).
  if (got.size === 0 || !got.head.includes(Buffer.from('%PDF-'))) {
    await fs.promises.rm(got.tmp, { force: true });
    throw new EbookError('This file is not a PDF.');
  }
  await fs.promises.rename(got.tmp, pdfPath(book.id));
  const name = str(fileName, 200).replace(/[^\w.\- ()]+/g, '_') || `${book.title}.pdf`;
  await book.update({ fileName: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`, fileSize: got.size, fileUpdatedAt: new Date() });
  return adminDto(book, await courseTitles());
}

export async function uploadCover(id: string, body: Readable, mime: string) {
  const book = await findEbook(id);
  if (!book) throw new EbookError('E-book not found.', 404);
  if (!COVER_TYPES[mime]) throw new EbookError('The cover must be a JPG, PNG or WebP image.');
  const target = coverPath(book.id, mime);
  const got = (await receive(body, target, COVER_MAX_BYTES, 'The cover image must be under 3 MB.'));
  if (got.size === 0) {
    await fs.promises.rm(got.tmp, { force: true });
    throw new EbookError('The cover image is empty.');
  }
  if (book.coverMime && book.coverMime !== mime) await fs.promises.rm(coverPath(book.id, book.coverMime), { force: true });
  await fs.promises.rename(got.tmp, target);
  await book.update({ coverMime: mime, coverUpdatedAt: new Date() });
  return adminDto(book, await courseTitles());
}

export async function removeCover(id: string) {
  const book = await findEbook(id);
  if (!book) throw new EbookError('E-book not found.', 404);
  if (book.coverMime) await fs.promises.rm(coverPath(book.id, book.coverMime), { force: true });
  await book.update({ coverMime: null, coverUpdatedAt: null });
  return adminDto(book, await courseTitles());
}

export function coverFile(book: Ebook): { path: string; mime: string } | null {
  return book.coverMime ? { path: coverPath(book.id, book.coverMime), mime: book.coverMime } : null;
}

// ---- Signed links ----

const sign = (payload: string) => crypto.createHmac('sha256', `${config.jwtSecret}:ebook`).update(payload).digest('base64url');

/** A short-lived link to the PDF for this learner. The path is relative to the API (/api). */
export async function linkFor(learner: Learner, id: string, download: boolean) {
  const book = await findEbook(id);
  if (!book || !book.published || !book.fileName) throw new EbookError('E-book not found.', 404);
  const access = await ebookAccessFor(learner);
  if (!canOpen(book, access)) {
    const titles = await courseTitles();
    throw new EbookError(lockedMessage(book, titles.get(book.courseId ?? ''), access), 403, 'locked');
  }
  const exp = Math.floor(Date.now() / 1000) + (download ? DOWNLOAD_LINK_SECONDS : READ_LINK_SECONDS);
  const d = download ? 1 : 0;
  const sig = sign(`${book.id}.${learner.id}.${exp}.${d}`);
  return {
    url: `/ebooks/${book.id}/file?u=${learner.id}&exp=${exp}&d=${d}&sig=${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    fileName: book.fileName,
  };
}

/** Checks a signed link and the learner's access now. Returns the file to send. */
export async function fileForLink(id: string, q: Record<string, unknown>) {
  const u = String(q.u ?? '');
  const exp = Number(q.exp);
  const d = q.d === '1' ? 1 : 0;
  const sig = String(q.sig ?? '');
  const expected = sign(`${id}.${u}.${exp}.${d}`);
  const valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid || !isUuid(u)) throw new EbookError('This link is not valid.', 403);
  if (!(exp * 1000 > Date.now())) throw new EbookError('This link has expired. Open the e-book again from your library.', 410);
  const [book, learner] = await Promise.all([findEbook(id), Learner.findByPk(u)]);
  if (!book || !book.published || !book.fileName) throw new EbookError('E-book not found.', 404);
  // Access is checked again, so a refund, a block or an unpublished e-book stops old links too.
  if (!learner || !canOpen(book, await ebookAccessFor(learner))) throw new EbookError('You no longer have access to this e-book.', 403);
  return { path: pdfPath(book.id), fileName: book.fileName, download: d === 1 };
}
