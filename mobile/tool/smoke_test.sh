#!/usr/bin/env bash
# Installs the release APK on the emulator, opens the app and checks it is still running after
# 40 seconds. Saves a screenshot and the device log to mobile/build/smoke/.
set -u
APK=${1:-build/app/outputs/flutter-apk/app-release.apk}
PKG=com.englishbridgeway.english_bridgeway
OUT=build/smoke
mkdir -p "$OUT"

adb install -r "$APK" || { echo "::error::adb install failed"; exit 1; }
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 40

adb exec-out screencap -p > "$OUT/screen.png"
adb logcat -d -v time > "$OUT/logcat.txt"
grep -E "AndroidRuntime|FATAL|flutter|$PKG|cashfree|Exception|Error" "$OUT/logcat.txt" | grep -v "^--------- beginning" > "$OUT/app-log.txt" || true

# Show the important lines as annotations so they appear on the run summary.
grep -E "FATAL EXCEPTION|AndroidRuntime: |E/flutter|Unhandled Exception" "$OUT/logcat.txt" | head -40 | while IFS= read -r line; do
  echo "::warning title=device log::${line//%/%25}"
done

if grep -qE "FATAL EXCEPTION|Unhandled Exception" "$OUT/logcat.txt"; then
  echo "::error::The app threw an error while starting (see the device log annotations)."
  tail -n 200 "$OUT/app-log.txt"
  exit 1
elif adb shell pidof "$PKG" > /dev/null; then
  echo "App is running after 40 seconds."
else
  echo "::error::The app is not running 40 seconds after launch (it crashed or closed)."
  tail -n 200 "$OUT/app-log.txt"
  exit 1
fi
