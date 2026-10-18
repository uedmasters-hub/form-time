#!/usr/bin/env bash
# Installs "FORM TIME.saver" for this Mac user and opens Screen Saver settings.
#
#   bash screensaver/macos/install.sh [path/to/FORM TIME.saver]
#
# Without a path it uses the build in screensaver/build, or a "FORM TIME.saver"
# beside this script.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
saver="${1:-}"
if [ -z "$saver" ]; then
  for candidate in "$here/FORM TIME.saver" "$here/../build/FORM TIME.saver" "$PWD/FORM TIME.saver"; do
    if [ -d "$candidate" ]; then saver="$candidate"; break; fi
  done
fi
[ -n "$saver" ] && [ -d "$saver" ] || { echo "Can't find FORM TIME.saver. Build it first: bash screensaver/macos/build.sh" >&2; exit 1; }

dest="$HOME/Library/Screen Savers"
mkdir -p "$dest"
# The old copy may still be loaded by macOS's screen-saver process.
killall legacyScreenSaver 2>/dev/null || true
killall "legacyScreenSaver (System Settings)" 2>/dev/null || true
rm -rf "$dest/FORM TIME.saver"
ditto "$saver" "$dest/FORM TIME.saver"
# Downloaded copies are marked "from the internet"; this one is yours now.
xattr -dr com.apple.quarantine "$dest/FORM TIME.saver" 2>/dev/null || true

echo "Installed: $dest/FORM TIME.saver"
echo "In Screen Saver settings, choose FORM / TIME (under Other), then Options… for its look."
open "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension" 2>/dev/null \
  || open -b com.apple.systempreferences 2>/dev/null || true
