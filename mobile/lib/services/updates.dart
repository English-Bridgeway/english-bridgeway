import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../nav.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'api.dart';

/// A newer build than the one installed (GET /api/app/version: the latest GitHub Release or an APK from Admin → Mobile app).
class AppRelease {
  final String versionName, notes, url;
  final int buildNumber, minBuild, size;
  AppRelease(this.versionName, this.buildNumber, this.minBuild, this.notes, this.url, this.size);

  static AppRelease? fromJson(dynamic j) {
    if (j is! Map) return null;
    final build = (j['buildNumber'] as num?)?.toInt() ?? 0;
    final url = '${j['url'] ?? ''}';
    if (build <= 0 || url.isEmpty) return null;
    return AppRelease('${j['versionName'] ?? ''}', build, (j['minBuild'] as num?)?.toInt() ?? 0, '${j['notes'] ?? ''}', url,
        (j['size'] as num?)?.toInt() ?? 0);
  }
}

enum UpdatePrompt { none, optional, required }

/// What to show for [release] when build [installed] is on the phone. An optional update that was
/// put off ("Later") is asked about again a day later; a required one is asked every time.
UpdatePrompt updatePromptFor(int installed, AppRelease? release, {DateTime? laterAt, int? laterBuild, DateTime? now}) {
  if (release == null || installed <= 0 || release.buildNumber <= installed) return UpdatePrompt.none;
  if (installed < release.minBuild) return UpdatePrompt.required;
  final putOff = laterBuild == release.buildNumber && laterAt != null && (now ?? DateTime.now()).difference(laterAt) < const Duration(hours: 24);
  return putOff ? UpdatePrompt.none : UpdatePrompt.optional;
}

/// Checks for a new version once per app start and shows the "Update available" popup.
///
/// Installed from Google Play: Play's in-app update finds and installs the new version.
/// Installed from the APK: the server's latest APK (Admin → Mobile app) opens in the browser,
/// which downloads it so Android can install it over the old one.
class Updates {
  static const _laterAtKey = 'update-later-at';
  static const _laterBuildKey = 'update-later-build';
  static bool _checked = false;

  static Future<void> check(BuildContext context, Api api, SharedPreferences prefs) async {
    if (_checked || kIsWeb || !Platform.isAndroid) return;
    _checked = true;
    try {
      final info = await PackageInfo.fromPlatform();
      final installed = int.tryParse(info.buildNumber) ?? 0;
      if (!context.mounted) return;
      if (info.installerStore == 'com.android.vending') {
        await _checkPlay(context, prefs);
      } else {
        final release = AppRelease.fromJson((await api.get('/app/version') as Map?)?['android']);
        final prompt = updatePromptFor(installed, release,
            laterAt: DateTime.tryParse(prefs.getString(_laterAtKey) ?? ''), laterBuild: prefs.getInt(_laterBuildKey));
        if (prompt == UpdatePrompt.none || !context.mounted) return;
        await _show(context, prefs,
            version: release!.versionName,
            notes: release.notes,
            size: release.size,
            build: release.buildNumber,
            mustUpdate: prompt == UpdatePrompt.required,
            onUpdate: () => openExternal(Api.absolute(release.url)));
      }
    } catch (_) {
      // Offline, or the store isn't reachable: try again on the next start.
    }
  }

  static Future<void> _checkPlay(BuildContext context, SharedPreferences prefs) async {
    final info = await InAppUpdate.checkForUpdate();
    if (info.updateAvailability == UpdateAvailability.developerTriggeredUpdateInProgress) {
      await InAppUpdate.performImmediateUpdate();
      return;
    }
    if (info.updateAvailability != UpdateAvailability.updateAvailable || !info.immediateUpdateAllowed) return;
    final build = info.availableVersionCode ?? 0;
    final laterAt = DateTime.tryParse(prefs.getString(_laterAtKey) ?? '');
    final putOff = prefs.getInt(_laterBuildKey) == build && laterAt != null && DateTime.now().difference(laterAt) < const Duration(hours: 24);
    // Priority 4-5 (set when uploading to Play) means the old version must not stay in use.
    final mustUpdate = info.updatePriority >= 4;
    if ((putOff && !mustUpdate) || !context.mounted) return;
    await _show(context, prefs,
        version: null, notes: '', size: 0, build: build, mustUpdate: mustUpdate, onUpdate: InAppUpdate.performImmediateUpdate);
  }

  static Future<void> _show(BuildContext context, SharedPreferences prefs,
      {required String? version,
      required String notes,
      required int size,
      required int build,
      required bool mustUpdate,
      required Future<Object?> Function() onUpdate}) async {
    final later = await showDialog<bool>(
      context: context,
      barrierDismissible: !mustUpdate,
      builder: (_) => UpdateDialog(version: version, notes: notes, size: size, mustUpdate: mustUpdate, onUpdate: onUpdate),
    );
    if (later == true) {
      await prefs.setString(_laterAtKey, DateTime.now().toIso8601String());
      await prefs.setInt(_laterBuildKey, build);
    }
  }
}

/// The "New version available" popup. Pops `true` for "Later".
class UpdateDialog extends StatelessWidget {
  const UpdateDialog({super.key, this.version, this.notes = '', this.size = 0, this.mustUpdate = false, required this.onUpdate});
  final String? version;
  final String notes;
  final int size;
  final bool mustUpdate;
  final Future<Object?> Function() onUpdate;

  @override
  Widget build(BuildContext context) {
    final lines = notes.split('\n').map((l) => l.trim().replaceFirst(RegExp(r'^[-•*]\s*'), '')).where((l) => l.isNotEmpty).toList();
    return PopScope(
      canPop: !mustUpdate,
      child: Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
        clipBehavior: Clip.antiAlias,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            color: AppColors.indigo,
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: Column(children: [
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(color: AppColors.yellow, shape: BoxShape.circle),
                child: const Icon(Icons.system_update_rounded, color: AppColors.navy, size: 30),
              ),
              const SizedBox(height: 12),
              Text(mustUpdate ? 'Update required' : 'New version available',
                  textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
              if (version != null && version!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('Version $version${size > 0 ? ' · ${(size / 1048576).toStringAsFixed(1)} MB' : ''}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  mustUpdate
                      ? 'This version of English-Bridgeway is no longer supported. Please update to keep learning.'
                      : 'Update English-Bridgeway to get the latest lessons, features and fixes.',
                  style: const TextStyle(color: AppColors.onSurfaceVariant, fontSize: 14, height: 1.5),
                ),
                if (lines.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text("WHAT'S NEW", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.outline, letterSpacing: 0.8)),
                  const SizedBox(height: 6),
                  for (final l in lines.take(8))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.check_circle_rounded, size: 16, color: AppColors.success)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(l, style: const TextStyle(fontSize: 13.5, height: 1.4, fontWeight: FontWeight.w500))),
                      ]),
                    ),
                ],
              ]),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Column(children: [
              AppButton('Update now', kind: ButtonKind.indigo, icon: Icons.download_rounded, onPressed: () async {
                await onUpdate();
                // A required update stays on screen until the new version is installed.
                if (!mustUpdate && context.mounted) Navigator.of(context).pop(false);
              }),
              if (!mustUpdate)
                TextButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Later', style: TextStyle(color: AppColors.outline, fontWeight: FontWeight.w600)),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}
