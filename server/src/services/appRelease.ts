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

/** What the app reads on start. The download URL is relative to the API (/app/android.apk). */
export async function publicVersion() {
  const r = await getRelease();
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
