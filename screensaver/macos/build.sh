#!/usr/bin/env bash
# Builds the FORM / TIME screen saver for macOS: "FORM TIME.saver", one
# universal bundle for Apple silicon and Intel, macOS 11 or later.
#
#   bash screensaver/macos/build.sh            # export the web app, then build
#   bash screensaver/macos/build.sh --skip-web # reuse screensaver/build/web
#
# Needs a Mac with Xcode or just its Command Line Tools (xcode-select --install),
# and Node.js 20+ with the repo's packages installed (npm ci). Produces, in
# screensaver/build:
#   FORM TIME.saver                  install with install.sh, or double-click it
#   FORM-TIME-Screensaver-mac.zip    the same, zipped, to share
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
build="$here/../build"
mkdir -p "$build"
build="$(cd "$build" && pwd)"
web="$build/web"
saver="$build/FORM TIME.saver"
objects="$build/macos-obj"

command -v xcrun >/dev/null || { echo "Xcode Command Line Tools are needed: xcode-select --install" >&2; exit 1; }
version="$(node -p "require('$root/package.json').version")"
echo "FORM / TIME screen saver $version for macOS"

if [ "${1:-}" != "--skip-web" ]; then
  node "$here/../scripts/build-web.mjs" "$web"
fi
[ -f "$web/screensaver.html" ] || { echo "No web export in $web." >&2; exit 1; }

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
    -framework ScreenSaver -framework WebKit -framework AppKit \
    "$here"/Sources/*.swift
done
lipo -create -output "$saver/Contents/MacOS/FormTimeSaver" "$objects"/FormTimeSaver-*
rm -rf "$objects"

sed "s/__VERSION__/$version/g" "$here/Info.plist" > "$saver/Contents/Info.plist"
cp "$here"/Resources/thumbnail*.png "$saver/Contents/Resources/"
cp -R "$web" "$saver/Contents/Resources/web"

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
