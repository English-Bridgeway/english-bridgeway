import fs from 'fs';
import path from 'path';
import { ContentItem } from '../db';
import { getSiteSettings } from './settings';

export const COLLECTIONS = [
  'grammarTopics',
  'grammarLessons',
  'vocabularyWords',
  'spokenLessons',
  'quizCategories',
  'quizzes',
  'courses',
  'blogPosts',
] as const;

export type CollectionKey = (typeof COLLECTIONS)[number];

export const ID_FIELD: Record<CollectionKey, string> = {
  grammarTopics: 'id',
  grammarLessons: 'id',
  vocabularyWords: 'id',
  spokenLessons: 'id',
  quizCategories: 'id',
  quizzes: 'id',
  courses: 'id',
  blogPosts: 'slug',
};

export function isCollection(value: string): value is CollectionKey {
  return (COLLECTIONS as readonly string[]).includes(value);
}

export function toRecord(row: ContentItem) {
  return {
    key: row.key,
    data: row.data,
    published: row.published,
    position: row.position,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Everything the public website needs, published items only, in admin-defined order. */
export async function publicBundle() {
  const rows = await ContentItem.findAll({ where: { published: true }, order: [['position', 'ASC'], ['id', 'ASC']] });
  const collections = Object.fromEntries(COLLECTIONS.map((c) => [c, [] as unknown[]])) as Record<CollectionKey, unknown[]>;
  for (const row of rows) {
    if (isCollection(row.collection)) collections[row.collection].push(row.data);
  }
  const site = await getSiteSettings();
  return { ...(site ? { site } : {}), collections };
}

export async function getPublishedItem(collection: CollectionKey, key: string) {
  return ContentItem.findOne({ where: { collection, key, published: true } });
}

/** Loads the website's built-in content (seed/content.json) into an empty database. */
export async function seedContentIfEmpty(force = false): Promise<number> {
  if (!force && (await ContentItem.count()) > 0) return 0;
  const file = path.resolve(__dirname, '../../seed/content.json');
  if (!fs.existsSync(file)) return 0;
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8')) as { collections: Record<string, Record<string, unknown>[]> };
  let count = 0;
  for (const collection of COLLECTIONS) {
    const items = bundle.collections[collection] ?? [];
    for (const [position, data] of items.entries()) {
      const key = String(data[ID_FIELD[collection]]);
      await ContentItem.upsert({ collection, key, data, published: true, position });
      count++;
    }
  }
  return count;
}
