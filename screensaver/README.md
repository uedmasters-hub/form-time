# FORM / TIME screensavers

The clock on its own, full screen, as a Windows screensaver and a macOS
screen saver. Both show the web app's `/screensaver` page (see
`src/features/screensaver/`) from a copy of the web export inside the
screensaver itself, so they work offline and never connect to the internet.

| | Windows 10 / 11 | macOS 11 or later |
|---|---|---|
| What it is | `FORM TIME.scr`: C# WinForms + WebView2, .NET Framework 4.8 | `FORM TIME.saver`: Swift `ScreenSaverView` + `WKWebView`, universal (Apple silicon + Intel) |
| Options | Screen Saver Settings → Settings… (with a live preview) | System Settings → Screen Saver → Options… |
| Installs to | `%LOCALAPPDATA%\Programs\FORM TIME Screensaver` (this user, no admin) | `~/Library/Screen Savers` (this user) |
| Source | `windows/` | `macos/` |

**Options** (both): face (analog or digital), appearance (day, night, or follow the system), day dial,
night lume, movement, size, seconds, shadows & glow, the date, and the time zone (the computer's by default).
They are the screensaver's own: a screensaver can't read the desktop app's or the website's settings.

**Behaviour:** it fades in from black, shows on every display, and drifts a few pixels each minute so
nothing burns into the screen. Windows closes it on a key, click, scroll or mouse move; macOS's
screen-saver engine does the same on a Mac.

## Getting the screensavers

### Ready-made, from GitHub
Every push to `feat/desktop` that touches the app or the screensavers runs the
**Screensavers** workflow, which builds both on GitHub's Windows and macOS machines, installs and runs
them there, and keeps:
- `FORM-TIME-Screensaver-Windows` — the Windows zip
- `FORM-TIME-Screensaver-mac` — the Mac zip
- `windows-screenshots` / `mac-screenshots` — what the test runs looked like

Open github.com/uedmasters-hub/form-time → **Actions** → **Screensavers** → the latest green run →
**Artifacts**. (Downloads need you to be signed in to GitHub; artifacts are kept 90 days.)

### Building them yourself
From the repo, after `npm ci`:

**Mac** (needs Xcode, or just its Command Line Tools: `xcode-select --install`):
```bash
bash screensaver/macos/build.sh        # → screensaver/build/FORM TIME.saver (+ a zip)
bash screensaver/macos/install.sh      # copies it to ~/Library/Screen Savers, opens the settings
```

**Windows** (needs Node.js 20+ and the .NET SDK 8+):
```powershell
powershell -ExecutionPolicy Bypass -File screensaver\windows\build.ps1
# → screensaver\build\FORM TIME Screensaver\ (+ a zip); then run install.cmd in that folder
```

The web export alone: `node screensaver/scripts/build-web.mjs` (→ `screensaver/build/web`).
`screensaver/build/` is ignored by git.

## Installing

**Windows:** extract the zip (right-click → Extract All…), then double-click `install.cmd`. If Windows
says "Windows protected your PC", choose **More info → Run anyway** (it isn't code-signed yet). Screen
Saver Settings opens with FORM / TIME chosen. To remove it, run `uninstall.cmd`.
WebView2 is part of Windows 11 and up-to-date Windows 10; if it's missing, the screensaver says so.

**Mac:** a copy you built yourself installs with `install.sh` and opens without warnings. A copy
downloaded from GitHub isn't notarized yet, so macOS blocks it the first time:
1. Unzip it and double-click `FORM TIME.saver`; choose to install it for this user.
2. If macOS says it can't verify it, open System Settings → Privacy & Security and click
   **Open Anyway** next to "FORM TIME.saver", or run once in Terminal:
   `xattr -dr com.apple.quarantine ~/Library/Screen\ Savers/FORM\ TIME.saver`
3. System Settings → Screen Saver → choose FORM / TIME (under Other) → Options… for its look.

To remove it: right-click it in Screen Saver settings → Delete, or delete
`~/Library/Screen Savers/FORM TIME.saver`.

## How it works

- **The page** (`/screensaver`) reads its options from the address, e.g.
  `/screensaver?face=analog&appearance=night&lume=aqua&movement=smooth&seconds=1&depth=1&size=classic&date=1&tz=Asia/Kolkata`.
  Anything missing falls back to the settings saved in that browser, and the time zone to the computer's.
  It also works in any browser: open `form-time.vercel.app/screensaver` and go full screen.
- **Serving the export:** both hosts answer the page's requests from the bundled files the way the desktop
  app does (`/screensaver` → `screensaver.html`, `/_expo/…` from the export), under
  `https://form-time.screensaver/` (Windows) and `formtime://app/` (Mac), with a Content-Security-Policy
  that allows nothing outside those files.
- **Windows arguments:** `/s` full screen on every monitor, `/p <hwnd>` inside the settings dialog's
  little monitor, `/c` options. Options live in `HKCU\Software\FORM TIME\Screensaver`; WebView2's cache in
  `%LOCALAPPDATA%\FORM TIME\Screensaver`.
- **macOS 14+ quirk:** the screen-saver engine doesn't always call `stopAnimation` and keeps old views
  running, so the screen saver quits its process when the screen saver ends
  (`com.apple.screensaver.willstop`); macOS starts a fresh one next time.

## Not done yet
- Code signing: Windows needs a code-signing certificate (no SmartScreen warning); the Mac needs a
  Developer ID and notarization (no Gatekeeper warning). Both builds are ready for it.
- Upcoming events in the screensaver: it can't see your items (they live in the app or your account).
- Windows on Arm runs the x64 build under emulation.
