#!/usr/bin/env bash
# Runs the Maestro smoke test against an emulator booted by reactivecircus/android-emulator-runner.
# Invoked from the action's script: as a single line so variable scope persists.
set -euo pipefail

APK=android/app/build/outputs/apk/debug/app-debug.apk
test -f "$APK"

adb wait-for-device
adb shell input keyevent 82 || true
adb install -r -t "$APK"

curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$HOME/.maestro/bin:$PATH"
maestro --version

mkdir -p maestro-output
maestro test --debug-output maestro-output .maestro/smoke.yaml
