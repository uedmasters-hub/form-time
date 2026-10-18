#!/usr/bin/env node
/**
 * Exports the web app into screensaver/build/web for the Windows and macOS
 * screensavers to load (they show its /screensaver page). It's the same
 * static export as the website and the desktop app, with Google Calendar
 * switched off (no sign-in in a screensaver) and labelled with the app's
 * version and commit. Nothing in the web app's source or settings changes.
 *
 *   node screensaver/scripts/build-web.mjs [output-dir]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const out = path.resolve(process.argv[2] ?? path.join(here, '..', 'build', 'web'));

// Expo CLI may tidy the project's .gitignore during an export; leave it as it was.
const gitignore = path.join(root, '.gitignore');
const before = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : null;

function commit() {
  if (process.env.FORMTIME_BUILD_ID) return process.env.FORMTIME_BUILD_ID;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : '';
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(out, { recursive: true, force: true });
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  // --clear: Metro's cache would otherwise keep the values of an earlier build.
  ['expo', 'export', '--platform', 'web', '--clear', '--output-dir', out],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Set (even empty) here, it wins over any value in .env.
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: '',
      EXPO_PUBLIC_APP_VERSION: version,
      EXPO_PUBLIC_BUILD_ID: commit(),
    },
    shell: process.platform === 'win32',
  },
);

if (before !== null && fs.readFileSync(gitignore, 'utf8') !== before) {
  fs.writeFileSync(gitignore, before);
}
if (result.status !== 0) process.exit(result.status ?? 1);
if (!fs.existsSync(path.join(out, 'screensaver.html'))) {
  console.error('The web export has no screensaver.html; see the errors above.');
  process.exit(1);
}
console.log(`Web app (version ${version}) exported into ${path.relative(root, out)}`);
