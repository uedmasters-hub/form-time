# FORM / TIME — desktop (macOS, Windows)

The web app in its own window, built with Electron. It loads the same static
export as the website (`expo export --platform web`), served from inside the
app at `app://form-time/`, so the clock, calendar, events, settings, account
and sync work, and look, exactly as in a browser. Nothing outside this folder
is changed: the web app has no desktop code, and this folder has its own
dependencies.

## Run it

```bash
cd desktop
npm install          # once: Electron and electron-builder, only in desktop/
npm start            # builds the web app into desktop/app-dist, then opens it
npm run open         # opens again without rebuilding
```

## Package it

Build each platform on that platform:

```bash
npm run dist:mac     # on a Mac → release/FORM TIME-1.0.0-universal.dmg and .zip
npm run dist:win     # on Windows → release/FORM TIME Setup 1.0.0.exe (x64 + arm64)
```

`npm run dist:linux` makes an AppImage, used for testing.

## How it behaves

- Opens in full screen, the clock on its own. A faint ✕ in the top-left
  corner (only in full screen) quits: barely there at rest, a little
  stronger while the pointer moves, clear on hover or keyboard focus (it's
  first in the Tab order), with a short hint beside it. It's drawn by the
  desktop app (`preload.cjs`); the web app has no part in it.
- Leave full screen with Escape (when no panel is open; with one open,
  Escape closes the panel), F11 on Windows, ⌃⌘F or the green button on
  macOS, or View → Toggle Full Screen. Quit with the ✕, ⌘Q / Ctrl+Q,
  Alt+F4, or File → Exit.
- Leave full screen and quit, and it opens in a window next time (size and
  place remembered); quit in full screen, and it opens in full screen.
  Opening the app again brings the window forward.
- Sounds (Settings → Sound) can start without a click first, unlike in a
  browser tab.
- Items, settings and the account session persist between launches
  (localStorage on the `app://form-time` origin) and sync with Supabase as on
  the web.
- Links (a meeting link, a place) open in the default browser.
- Reminders use system notifications.
- Only the app's own scripts can run (a Content-Security-Policy on its pages);
  the page has no access to Node or the file system.

## Icons

`build-resources/` holds the app icon, made from the FORM / TIME mark
(`public/icon.svg`): `icon-mac.png`, the mark on a rounded ivory tile sized to
Apple's icon grid, and `icon.png` (Windows, Linux), the mark on an ivory disc
so it reads on dark and light taskbars. electron-builder turns them into
`.icns` and `.ico`.

## Not yet

- **Google Calendar** is switched off in the desktop build (`scripts/build-web.cjs`
  sets `EXPO_PUBLIC_GOOGLE_CLIENT_ID` empty): Google's browser sign-in doesn't
  run inside a desktop app. It needs a desktop sign-in flow (system browser +
  loopback redirect), planned with the server-side Google sync.
- **Signing**: the builds are unsigned. macOS shows "unidentified developer"
  (right-click → Open the first time) until signed with a Developer ID and
  notarized; Windows SmartScreen warns until signed with a code-signing
  certificate. Add the certificates to electron-builder when available.
- Account email links (confirm, reset password) open in the browser; sign in
  with your password in the app afterwards.
