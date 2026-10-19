#!/usr/bin/env bash
# Builds the FORM / TIME screen saver for macOS: "FORM TIME.saver", one
# universal bundle for Apple silicon and Intel, macOS 11 or later.
#
#   bash screensaver/macos/build.sh
#
# The clock is drawn natively (no web view: macOS 26.4+ blanks web content in
# screen savers), from Sources/ and Resources/dial-themes.json, which
# scripts/export-themes.mjs generates from the web app's dial colours.
#
# Needs a Mac with Xcode or just its Command Line Tools (xcode-select --install),
# and Node.js (only to read the version). Produces, in screensaver/build:
#   FORM TIME.saver                  install with install.sh, or double-click it
#   FORM-TIME-Screensaver-mac.zip    the same, zipped, to share
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
build="$here/../build"
mkdir -p "$build"
build="$(cd "$build" && pwd)"
saver="$build/FORM TIME.saver"
objects="$build/macos-obj"

command -v xcrun >/dev/null || { echo "Xcode Command Line Tools are needed: xcode-select --install" >&2; exit 1; }
version="$(node -p "require('$root/package.json').version")"
echo "FORM / TIME screen saver $version for macOS"

sdk="$(xcrun --sdk macosx --show-sdk-path)"
rm -rf "$saver" "$objects"
mkdir -p "$saver/Contents/MacOS" "$saver/Contents/Resources" "$objects"

for arch in arm64 x86_64; do
  echo "Compiling for ${arch}…"
  xcrun --sdk macosx swiftc \
    -swift-version 5 -O -parse-as-library \
    -module-name FormTimeSaver \
    -target "$arch-apple-macos11.0" -sdk "$sdk" \
    -emit-library -o "$objects/FormTimeSaver-$arch" \
    -Xlinker -install_name -Xlinker @rpath/FormTimeSaver \
    -framework ScreenSaver -framework AppKit -framework CoreImage \
    "$here"/Sources/*.swift
done
lipo -create -output "$saver/Contents/MacOS/FormTimeSaver" "$objects"/FormTimeSaver-*
rm -rf "$objects"

sed "s/__VERSION__/$version/g" "$here/Info.plist" > "$saver/Contents/Info.plist"
cp "$here"/Resources/thumbnail*.png "$here"/Resources/dial-themes.json "$saver/Contents/Resources/"

# Ad-hoc signature: required on Apple silicon. (A Developer ID would remove
# the first-open warning for copies downloaded from the internet.)
codesign --force --deep --sign - "$saver"
codesign --verify --deep "$saver"

rm -f "$build/FORM-TIME-Screensaver-mac.zip"
(cd "$build" && ditto -c -k --keepParent "FORM TIME.saver" FORM-TIME-Screensaver-mac.zip)
cp "$here/install.sh" "$build/install-mac.sh"
echo "Built: $saver"
echo "Zip:   $build/FORM-TIME-Screensaver-mac.zip"
echo "Install it with: bash screensaver/macos/install.sh"
