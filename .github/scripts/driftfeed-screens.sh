#!/usr/bin/env bash
# Captures Driftfeed store screenshots on the CI emulator (see .maestro/screens.yaml).
set -euo pipefail
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
cd "$ROOT"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
adb wait-for-device
adb shell input keyevent 82 || true
adb install -r -t "$APK"
if ! command -v maestro >/dev/null 2>&1 && [ ! -x "$HOME/.maestro/bin/maestro" ]; then
  curl -Ls "https://get.maestro.mobile.dev" | bash
fi
export PATH="$HOME/.maestro/bin:$PATH"
OUT="$ROOT/driftfeed-screens"
mkdir -p "$OUT"
curl -s http://127.0.0.1:11434/api/tags | head -c 400 || true
cd "$OUT"
set +e
maestro test --debug-output "$OUT/debug" "$ROOT/.maestro/screens.yaml"
rc=$?
adb shell screencap -p /sdcard/last.png && adb pull /sdcard/last.png "$OUT/99-last.png" || true
adb logcat -d | tail -n 4000 > "$OUT/logcat.txt" || true
find "$ROOT/.maestro" "$HOME/.maestro/tests" "$ROOT" -maxdepth 3 -name "0*.png" -newer "$APK" -exec cp -n {} "$OUT/" \; 2>/dev/null || true
ls -la "$OUT"
exit $rc
