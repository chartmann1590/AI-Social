#!/usr/bin/env bash
# Runs inside the emulator step: installs the amazon RELEASE APK (as shipped) and walks its main screens.
set -u
export OUT=/tmp/amz-out; mkdir -p $OUT
D=.github/amazon
BT=$ANDROID_HOME/build-tools/$(ls $ANDROID_HOME/build-tools | sort -V | tail -1)
adb wait-for-device; adb shell getprop ro.build.version.release </dev/null | sed 's/^/android /' | tee $OUT/device.txt
adb shell pm list packages </dev/null | grep -iE "google|gms|vending|amazon" | tee -a $OUT/device.txt
A=$(ls amz-apk/*-amazon-release.apk | head -1)
PKG=$($BT/aapt2 dump packagename "$A" 2>/dev/null || cat $D/package.txt)
bash $D/amazon-test.sh "$A" "$PKG" $D/steps-release.txt release || true
ls -la $OUT | tail -60
cat $OUT/*-fatal.txt 2>/dev/null | head -40
