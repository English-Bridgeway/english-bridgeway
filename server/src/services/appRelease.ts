import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import { config } from '../config';
import { Setting } from '../db';
import { EbookError, receive } from './ebooks';

// The Android app's latest release, for learners who installed the APK outside Google Play.
// The admin uploads the APK built by GitHub Actions (Admin → Mobile app) with its build number;
// the app asks GET /api/app/version on start and offers the download when its own build is older.
// Play Store installs update through Google Play instead (in-app updates), so they never use this.
//
// The latest GitHub Release counts too (APP_GITHUB_REPO, the public repo by default): a release
// tagged like `app-v1.1.0-build10100` with an .apk asset is offered without an admin upload. Whichever
// of the two has the higher build number wins.

export class AppReleaseError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export interface AppRelease {
  versionName: string;
  buildNumber: number;
  /** Builds older than this must update before they can be used. 0 = never force. */
  minBuild: number;
  notes: string;
  fileSize: number;
  sha256: string;
  uploadedAt: string;
}

const KEY = 'appRelease';
const APK_MAX_BYTES = 200 * 1024 * 1024;
const apkPath = () => path.join(config.appDir, 'english-bridgeway.apk');

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const whole = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

export async function getRelease(): Promise<AppRelease | null> {
  const row = await Setting.findByPk(KEY);
  const r = row?.value as AppRelease | undefined;
  return r?.buildNumber ? r : null;
}

async function write(r: AppRelease) {
  await Setting.upsert({ key: KEY, value: r as unknown as Record<string, unknown> });
}

function details(input: Record<string, unknown>, current: AppRelease | null) {
  const versionName = text(input.versionName ?? current?.versionName, 40);
  const buildNumber = whole(input.buildNumber ?? current?.buildNumber);
  const minBuild = input.minBuild === undefined || input.minBuild === '' || input.minBuild === null ? (current?.minBuild ?? 0) : whole(input.minBuild);
  if (!/^\d+(\.\d+){0,3}$/.test(versionName)) throw new AppReleaseError('Enter the version like 1.0.3.');
  if (!buildNumber) throw new AppReleaseError('Enter the build number (the GitHub Actions run number, e.g. 42).');
  if (Number.isNaN(minBuild) || minBuild > buildNumber) throw new AppReleaseError('The minimum build must be a number no higher than this build.');
  return { versionName, buildNumber, minBuild, notes: text(input.notes ?? current?.notes, 2000) };
}

/** A new APK: the file as the raw body, its version, build number and notes in the query. */
export async function uploadApk(body: Readable, input: Record<string, unknown>): Promise<AppRelease> {
  const current = await getRelease();
  const meta = details(input, null);
  if (current && meta.buildNumber <= current.buildNumber) {
    throw new AppReleaseError(`Build ${meta.buildNumber} is not newer than the published build ${current.buildNumber}. Phones only update to a higher build number.`);
  }
  let got: Awaited<ReturnType<typeof receive>>;
  try {
    got = await receive(body, apkPath(), APK_MAX_BYTES, 'The APK is bigger than 200 MB.');
  } catch (err) {
    throw err instanceof EbookError ? new AppReleaseError(err.message, err.status) : err;
  }
  // An APK is a ZIP file, which starts with "PK\x03\x04".
  if (got.size < 1024 || !got.head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    await fs.promises.rm(got.tmp, { force: true });
    throw new AppReleaseError('This file is not an APK.');
  }
  const sha256 = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(got.tmp)) sha256.update(chunk as Buffer);
  await fs.promises.rename(got.tmp, apkPath());
  const release: AppRelease = { ...meta, fileSize: got.size, sha256: sha256.digest('hex'), uploadedAt: new Date().toISOString() };
  await write(release);
  return release;
}

/** Changes the notes or the minimum build of the published APK without uploading it again. */
export async function updateRelease(input: Record<string, unknown>): Promise<AppRelease> {
  const current = await getRelease();
  if (!current) throw new AppReleaseError('Upload an APK first.', 404);
  const meta = details({ ...input, versionName: current.versionName, buildNumber: current.buildNumber }, current);
  const release = { ...current, minBuild: meta.minBuild, notes: meta.notes };
  await write(release);
  return release;
}

export function apkFile(): string {
  return apkPath();
}

export interface GithubRelease {
  versionName: string;
  buildNumber: number;
  notes: string;
  size: number;
  url: string;
  page: string;
  publishedAt: string;
}

const githubRepo = () => (process.env.APP_GITHUB_REPO ?? 'English-Bridgeway/english-bridgeway').trim();
let githubCache: { at: number; value: GithubRelease | null } | null = null;

/** The "- " items of a release body (mobile/CHANGELOG.md) before its "## Install" section, without markdown bold. */
export function releaseNotes(body: string): string {
  const items: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^#{1,3}\s*install/i.test(line.trim())) break;
    const m = /^\s*[-*]\s+(.+)$/.exec(line);
    if (m) items.push(m[1]!.replace(/\*\*|__/g, '').trim());
  }
  return items.slice(0, 6).join('\n').slice(0, 2000);
}

/** Reads a release's tag ("app-v1.1.0-build42") and its first .apk asset. */
export function parseGithubRelease(r: unknown): GithubRelease | null {
  const rel = r as { tag_name?: string; body?: string; html_url?: string; published_at?: string; draft?: boolean; prerelease?: boolean;
    assets?: { name?: string; size?: number; browser_download_url?: string }[] } | null;
  if (!rel || rel.draft || rel.prerelease) return null;
  const tag = String(rel.tag_name ?? '');
  const build = Number(/build[-_.]?(\d+)/i.exec(tag)?.[1]);
  const version = /v?(\d+(?:\.\d+){0,3})/.exec(tag)?.[1] ?? '';
  const apk = rel.assets?.find((a) => String(a.name ?? '').toLowerCase().endsWith('.apk') && a.browser_download_url);
  if (!build || !version || !apk) return null;
  return {
    versionName: version,
    buildNumber: build,
    notes: releaseNotes(String(rel.body ?? '')),
    size: Number(apk.size) || 0,
    url: apk.browser_download_url!,
    page: String(rel.html_url ?? ''),
    publishedAt: String(rel.published_at ?? ''),
  };
}

/** The latest GitHub Release with an APK, checked at most every 10 minutes. Null when there is none or GitHub is unreachable. */
export async function latestGithubRelease(): Promise<GithubRelease | null> {
  const repo = githubRepo();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  if (githubCache && Date.now() - githubCache.at < 10 * 60_000) return githubCache.value;
  let value: GithubRelease | null = githubCache?.value ?? null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'english-bridgeway-server' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) value = parseGithubRelease(await res.json());
    else if (res.status === 404) value = null;
  } catch {
    // Keep the last answer; try again after the cache time.
  }
  githubCache = { at: Date.now(), value };
  return value;
}

/** What the app reads on start. An uploaded APK's URL is relative to the API (/app/android.apk). */
export async function publicVersion() {
  const [r, gh] = await Promise.all([getRelease(), latestGithubRelease()]);
  if (gh && (!r || gh.buildNumber > r.buildNumber)) {
    return {
      android: {
        versionName: gh.versionName,
        buildNumber: gh.buildNumber,
        // "Required update" in the admin still applies to phones older than the uploaded build.
        minBuild: r?.minBuild ?? 0,
        notes: gh.notes,
        size: gh.size,
        sha256: null,
        url: gh.url,
      },
    };
  }
  return {
    android: r && {
      versionName: r.versionName,
      buildNumber: r.buildNumber,
      minBuild: r.minBuild,
      notes: r.notes,
      size: r.fileSize,
      sha256: r.sha256,
      url: `/app/android.apk?build=${r.buildNumber}`,
    },
  };
}
