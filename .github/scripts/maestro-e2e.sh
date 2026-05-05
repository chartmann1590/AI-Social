#!/usr/bin/env bash
# Runs the Maestro smoke test against an emulator booted by reactivecircus/android-emulator-runner.
# Invoked from the action's script: as a single line so variable scope persists.
set -euo pipefail

# Anchor every path to the workflow checkout root so artifact upload (which resolves
# `path:` against $GITHUB_WORKSPACE) can find the debug output afterwards.
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
cd "$ROOT"

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
test -f "$APK"

adb wait-for-device
adb shell input keyevent 82 || true
adb install -r -t "$APK"

curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$HOME/.maestro/bin:$PATH"
maestro --version

OUT="$ROOT/maestro-output"
mkdir -p "$OUT"

# Always capture a screenshot and UI hierarchy dump after launch so we have artifacts
# even if maestro itself bails before writing its debug bundle.
trap '
  set +e
  echo "Capturing post-failure diagnostics into $OUT"
  adb shell screencap -p /sdcard/maestro-fail.png
  adb pull /sdcard/maestro-fail.png "$OUT/maestro-fail.png" || true
  adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window_dump.xml "$OUT/window_dump.xml" || true
  adb logcat -d > "$OUT/logcat.txt" || true
' EXIT

maestro test --debug-output "$OUT" .maestro/smoke.yaml
