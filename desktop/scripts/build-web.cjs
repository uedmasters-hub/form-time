/**
 * Builds the web app into desktop/app-dist for the desktop window to load.
 * It's the same static export as the website (`expo export --platform web`),
 * with one difference: Google Calendar is switched off, because Google's
 * browser sign-in doesn't work inside a desktop app (it needs its own flow).
 * Nothing in the web app's source or settings is changed.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const out = path.resolve(__dirname, '..', 'app-dist');

// Expo CLI may tidy the project's .gitignore during an export; leave it as it was.
const gitignore = path.join(root, '.gitignore');
const before = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : null;

fs.rmSync(out, { recursive: true, force: true });
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', out],
  {
    cwd: root,
    stdio: 'inherit',
    // Set (even empty) here, it wins over any value in .env.
    env: { ...process.env, EXPO_PUBLIC_GOOGLE_CLIENT_ID: '' },
    shell: process.platform === 'win32',
  },
);

if (before !== null && fs.readFileSync(gitignore, 'utf8') !== before) {
  fs.writeFileSync(gitignore, before);
}
if (result.status !== 0) process.exit(result.status ?? 1);
if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('The web export has no index.html; see the errors above.');
  process.exit(1);
}
console.log(`Web app built into ${path.relative(root, out)}`);
