/**
 * FORM / TIME desktop: the full-screen exit control, drawn by the desktop
 * app over the page (the web app knows nothing about it).
 *
 * In full screen there is no title bar, so a small ✕ sits in the top-left
 * corner: barely there at rest, a little stronger while the pointer moves,
 * full strength on hover or keyboard focus, with a short hint beside it.
 * It quits the app. Escape leaves full screen (unless a panel is open —
 * then Escape closes the panel, as it always has).
 *
 * Runs sandboxed in its own world: it can reach the page's DOM and send two
 * messages to the app, nothing else.
 */
const { ipcRenderer } = require('electron');

const isMac = process.platform === 'darwin';
const NAME = 'FORM / TIME';
const LABEL = isMac ? `Quit ${NAME}` : `Close ${NAME}`;
const HINT = `${isMac ? 'Quit' : 'Close'} · Esc leaves full screen`;
/** How long the control stays a little stronger after the pointer moves. */
const AWAKE_MS = 2400;

let fullScreen = false;
let wrap = null;
let button = null;
let awakeTimer = null;
let themeTimer = null;

const css = `
:host { all: initial; }
.wrap {
  position: fixed; top: 12px; left: 12px; z-index: 2147483000;
  display: none; align-items: center; gap: 6px; pointer-events: none;
  font-family: var(--font, system-ui, sans-serif);
}
.wrap.on { display: flex; }
button {
  pointer-events: auto; box-sizing: border-box;
  width: 44px; height: 44px; padding: 0; margin: 0;
  border-radius: 22px; border: 1.5px solid transparent; outline: none;
  background: transparent; color: var(--ink, #1d3b3a); cursor: pointer;
  display: grid; place-items: center;
  opacity: 0.14;
  transition: opacity 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 120ms ease-out,
    background-color 160ms ease-out, border-color 160ms ease-out;
}
.wrap.awake button { opacity: 0.42; transition-duration: 220ms, 120ms, 160ms, 160ms; }
button:hover, button:focus-visible { opacity: 1; transition-duration: 180ms, 120ms, 160ms, 160ms; }
button:focus-visible { border-color: var(--ink, #1d3b3a); }
button:active {
  opacity: 1; transform: scale(0.92);
  background: color-mix(in srgb, var(--ink, #1d3b3a) 10%, transparent);
}
svg { width: 20px; height: 20px; display: block; }
.hint {
  font-size: 12px; letter-spacing: 0.2px; white-space: nowrap;
  color: color-mix(in srgb, var(--ink, #1d3b3a) 62%, transparent);
  opacity: 0; transform: translateX(-4px);
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}
button:hover + .hint, button:focus-visible + .hint { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  button, .hint { transition: none !important; }
  .hint { transform: none; }
}
`;

/** The page's ink colour and type, read from its own Settings icon and text, so it matches every dial. */
function readTheme() {
  if (!wrap) return;
  const icon = document.querySelector('[aria-label="Settings"] svg');
  const ink = icon && (icon.getAttribute('stroke') || getComputedStyle(icon).color);
  if (ink && ink !== 'currentColor') wrap.style.setProperty('--ink', ink);
  // The app's text face (React Native Web sets it on its text, not the body).
  const text = document.querySelector('[dir="auto"]');
  if (text) wrap.style.setProperty('--font', getComputedStyle(text).fontFamily);
}

function build() {
  const host = document.createElement('div');
  host.setAttribute('data-formtime-desktop', '');
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  wrap = document.createElement('div');
  wrap.className = 'wrap';
  button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', LABEL);
  button.setAttribute('aria-describedby', 'hint');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  button.addEventListener('click', () => ipcRenderer.send('formtime:quit'));
  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.id = 'hint';
  hint.textContent = HINT;
  wrap.append(button, hint);
  root.append(style, wrap);
  // First in the page, so it's also first in the Tab order.
  document.body.prepend(host);
}

function wake(ms = AWAKE_MS) {
  if (!wrap || !fullScreen) return;
  wrap.classList.add('awake');
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => wrap && wrap.classList.remove('awake'), ms);
}

function setFullScreen(on) {
  fullScreen = on;
  if (!wrap) return;
  wrap.classList.toggle('on', on);
  clearInterval(themeTimer);
  if (on) {
    readTheme();
    // The dial (and so the ink) can change from Settings at any time.
    themeTimer = setInterval(readTheme, 1500);
    wake(3200); // a moment of presence on entering full screen, so it's found
  } else {
    wrap.classList.remove('awake');
    if (button && button.matches(':focus')) button.blur();
  }
}

ipcRenderer.on('formtime:full-screen', (_event, on) => setFullScreen(Boolean(on)));

window.addEventListener('DOMContentLoaded', () => {
  build();
  setFullScreen(fullScreen);
  ipcRenderer.send('formtime:ready');
});

window.addEventListener('pointermove', () => wake(), { passive: true });

// Escape leaves full screen, unless a panel (settings, the composer…) is
// open: Escape closes that, as in the browser. Capture phase, so the panel
// is still there to be seen.
window.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape' || event.repeat || !fullScreen) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    ipcRenderer.send('formtime:leave-full-screen');
  },
  true,
);
