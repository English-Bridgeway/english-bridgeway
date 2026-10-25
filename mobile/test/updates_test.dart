import 'package:english_bridgeway/services/updates.dart';
import 'package:english_bridgeway/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

AppRelease release({int build = 42, int minBuild = 0}) =>
    AppRelease.fromJson({'versionName': '1.2.0', 'buildNumber': build, 'minBuild': minBuild, 'notes': '', 'url': '/app/android.apk', 'size': 0})!;

void main() {
  test('asks to update only when the server has a newer build', () {
    expect(updatePromptFor(42, release()), UpdatePrompt.none);
    expect(updatePromptFor(50, release()), UpdatePrompt.none);
    expect(updatePromptFor(41, release()), UpdatePrompt.optional);
    expect(updatePromptFor(41, null), UpdatePrompt.none);
    expect(AppRelease.fromJson(null), isNull);
    expect(AppRelease.fromJson({'buildNumber': 0, 'url': '/x'}), isNull);
  });

  test('"Later" waits a day; a required update always asks', () {
    final now = DateTime(2026, 10, 25, 12);
    final putOff = now.subtract(const Duration(hours: 3));
    expect(updatePromptFor(41, release(), laterAt: putOff, laterBuild: 42, now: now), UpdatePrompt.none);
    expect(updatePromptFor(41, release(), laterAt: now.subtract(const Duration(hours: 25)), laterBuild: 42, now: now), UpdatePrompt.optional);
    // A newer build than the one put off asks again at once.
    expect(updatePromptFor(41, release(build: 43), laterAt: putOff, laterBuild: 42, now: now), UpdatePrompt.optional);
    expect(updatePromptFor(41, release(minBuild: 42), laterAt: putOff, laterBuild: 42, now: now), UpdatePrompt.required);
  });

  testWidgets('the popup lists what is new; a required update has no Later', (tester) async {
    var updates = 0;
    Future<void> show(bool mustUpdate) async {
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(googleFonts: false),
        home: Scaffold(
          body: UpdateDialog(version: '1.2.0', notes: '- New dashboard\n- Welcome pages', size: 31457280, mustUpdate: mustUpdate, onUpdate: () async => updates++),
        ),
      ));
    }

    await show(false);
    expect(find.text('New version available'), findsOneWidget);
    expect(find.text('Version 1.2.0 · 30.0 MB'), findsOneWidget);
    expect(find.text('New dashboard'), findsOneWidget);
    expect(find.text('Later'), findsOneWidget);
    await show(true);
    expect(find.text('Update required'), findsOneWidget);
    expect(find.text('Later'), findsNothing);
    await tester.tap(find.text('Update now'));
    await tester.pump();
    expect(updates, 1);
  });
}
