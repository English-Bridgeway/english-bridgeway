import { Router, type ErrorRequestHandler } from 'express';
import { asyncHandler, requireOwner } from '../middleware';
import { audit } from '../services/audit';
import { apkFile, AppReleaseError, getRelease, publicVersion, updateRelease, uploadApk } from '../services/appRelease';

// The Android app's update check and APK download (see services/appRelease.ts).
export const appRouter = Router();

appRouter.get(
  '/app/version',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await publicVersion());
  }),
);

appRouter.get(
  '/app/android.apk',
  asyncHandler(async (_req, res) => {
    const r = await getRelease();
    if (!r) {
      res.status(404).json({ message: 'No app download yet.' });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="english-bridgeway-${r.versionName}.apk"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.sendFile(apkFile(), { headers: { 'Content-Type': 'application/vnd.android.package-archive' }, lastModified: false }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'The APK file is missing. Please tell us.' });
    });
  }),
);

// Admin → Mobile app (owners only: a wrong APK reaches every learner's phone).
export const adminAppRouter = Router();

adminAppRouter.get(
  '/app/release',
  asyncHandler(async (_req, res) => {
    res.json({ release: await getRelease() });
  }),
);

adminAppRouter.put(
  '/app/release',
  requireOwner,
  asyncHandler(async (req, res) => {
    const release = await updateRelease(req.body ?? {});
    await audit(req.admin!.email, 'Updated app release', `${release.versionName} (${release.buildNumber}), minimum ${release.minBuild || 'none'}`);
    res.json({ release });
  }),
);

/** The APK as the raw body; ?versionName=1.0.3&buildNumber=42&minBuild=&notes=. */
adminAppRouter.put(
  '/app/apk',
  requireOwner,
  asyncHandler(async (req, res) => {
    const release = await uploadApk(req, req.query as Record<string, unknown>);
    await audit(req.admin!.email, 'Published app update', `${release.versionName} (${release.buildNumber})`);
    res.json({ release });
  }),
);

const onAppError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof AppReleaseError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  next(err);
};
appRouter.use(onAppError);
adminAppRouter.use(onAppError);
