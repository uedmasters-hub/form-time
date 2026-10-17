/**
 * FORM / TIME desktop: the web app (the same static export as the website)
 * in its own window, for macOS and Windows.
 *
 * The export is served from the app itself under app://form-time/, a
 * secure, standard origin: its absolute paths (/_expo/…, /assets/…) resolve,
 * localStorage (items, settings, the account session) persists between
 * launches, and Supabase sync works as it does in a browser. Nothing in the
 * web app knows it's in a desktop window.
 */
const { app, BrowserWindow, Menu, net, protocol, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'form-time';
const START_URL = `${SCHEME}://${HOST}/`;
const WEB_ROOT = path.join(__dirname, 'app-dist');
/** The day dial's page colour, so the window doesn't flash white while loading. */
const PAGE_COLOUR = '#f2f5f4';
/**
 * Only the app's own scripts run. Styles may be inline (React Native Web
 * writes them so, and the page has one small inline script, for sign-in
 * links); network calls go out over https (Supabase), or to this computer.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/** The file for a path in the export: "/" → index.html, "/explore" → explore.html. */
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(WEB_ROOT, rel));
  if (full !== WEB_ROOT && !full.startsWith(WEB_ROOT + path.sep)) return null; // outside the export
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  if (fs.existsSync(`${full}.html`)) return `${full}.html`;
  return path.join(WEB_ROOT, 'index.html'); // client-side route
}

// ── Window size and place, remembered between launches ──────────────────

const stateFile = () => path.join(app.getPath('userData'), 'window.json');

function savedBounds() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // Only if it's still on a connected display.
    const visible = screen.getAllDisplays().some(({ workArea: a }) => {
      return (
        saved.x < a.x + a.width - 80 &&
        saved.x + saved.width > a.x + 80 &&
        saved.y >= a.y - 20 &&
        saved.y < a.y + a.height - 80
      );
    });
    return visible ? saved : null;
  } catch {
    return null;
  }
}

function remember(win) {
  const save = () => {
    if (win.isDestroyed() || win.isMinimized()) return;
    const bounds = win.isFullScreen() || win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    try {
      fs.writeFileSync(
        stateFile(),
        JSON.stringify({ ...bounds, maximized: win.isMaximized(), fullScreen: win.isFullScreen() }),
      );
    } catch {
      // not important enough to fail over
    }
  };
  win.on('close', save);
}

// ── The window ───────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  const saved = savedBounds();
  const win = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 820,
    x: saved?.x,
    y: saved?.y,
    minWidth: 360,
    minHeight: 560,
    title: 'FORM / TIME',
    backgroundColor: PAGE_COLOUR,
    autoHideMenuBar: true, // Windows: Alt shows the menu
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (saved?.maximized) win.maximize();
  if (saved?.fullScreen) win.setFullScreen(true);
  win.once('ready-to-show', () => win.show());
  remember(win);

  // Links (a meeting link, a place) open in the default browser, never in here.
  const isOwn = (url) => url.startsWith(START_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isOwn(url)) return;
    event.preventDefault();
    if (/^https?:|^mailto:/i.test(url)) void shell.openExternal(url);
  });
  // The page sets its own title; keep the app's.
  win.on('page-title-updated', (event) => event.preventDefault());

  void win.loadURL(START_URL);
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    // Copy and paste in the composer need these on macOS.
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// One window: opening the app again brings it forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return createWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // Windows: reminders show as notifications from this app.
  if (process.platform === 'win32') app.setAppUserModelId('com.formtime.desktop');

  app.whenReady().then(() => {
    if (!fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
      console.error('No web build in desktop/app-dist — run `npm run web` first.');
      app.quit();
      return;
    }
    protocol.handle(SCHEME, async (request) => {
      const url = new URL(request.url);
      const file = url.host === HOST ? fileFor(url.pathname) : null;
      if (!file) return new Response('Not found', { status: 404 });
      const response = await net.fetch(pathToFileURL(file).toString());
      if (!file.endsWith('.html')) return response;
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Content-Security-Policy', CSP);
      return new Response(response.body, { status: response.status, headers });
    });
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
