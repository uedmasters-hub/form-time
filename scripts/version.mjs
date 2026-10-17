#!/usr/bin/env node
/**
 * One version for every FORM / TIME build. package.json is the source; the
 * same number goes into app.json (web and mobile), desktop/package.json
 * (the desktop app and its update feed) and both lockfiles.
 *
 *   node scripts/version.mjs            check that they all agree (exit 1 if not)
 *   node scripts/version.mjs 1.2.0      set a new version everywhere
 *
 * A new version must be higher than the current one, so a release can never
 * go backwards by mistake (updaters ignore lower versions anyway).
 * No dependencies: plain Node, so it runs anywhere, CI included.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the version lives in each file; files that don't exist are skipped. */
const PLACES = [
  { file: 'package.json', get: (j) => j.version, set: (j, v) => void (j.version = v) },
  {
    file: 'package-lock.json',
    get: (j) => j.version,
    set: (j, v) => {
      j.version = v;
      if (j.packages?.['']) j.packages[''].version = v;
    },
  },
  { file: 'app.json', get: (j) => j.expo?.version, set: (j, v) => void (j.expo.version = v) },
  { file: 'desktop/package.json', get: (j) => j.version, set: (j, v) => void (j.version = v) },
  {
    file: 'desktop/package-lock.json',
    get: (j) => j.version,
    set: (j, v) => {
      j.version = v;
      if (j.packages?.['']) j.packages[''].version = v;
    },
  },
];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function write(file, json) {
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(json, null, 2)}\n`);
}

/** -1, 0 or 1. A pre-release (1.2.0-beta.1) is lower than its release (1.2.0). */
function compare(a, b) {
  const [, ...pa] = SEMVER.exec(a);
  const [, ...pb] = SEMVER.exec(b);
  for (let i = 0; i < 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return Math.sign(d);
  }
  if (pa[3] === pb[3]) return 0;
  if (!pa[3]) return 1;
  if (!pb[3]) return -1;
  return pa[3] < pb[3] ? -1 : 1;
}

function current() {
  const found = PLACES.map((p) => ({ ...p, json: read(p.file) })).filter((p) => p.json);
  return found.map((p) => ({ ...p, version: p.get(p.json) }));
}

function check() {
  const places = current();
  const source = places[0].version;
  const wrong = places.filter((p) => p.version !== source);
  if (!SEMVER.test(source ?? '')) {
    console.error(`✖ package.json version "${source}" isn't a version like 1.2.3`);
    return 1;
  }
  if (wrong.length) {
    console.error(`✖ Versions disagree (package.json says ${source}):`);
    for (const p of wrong) console.error(`  ${p.file}: ${p.version ?? '(missing)'}`);
    console.error('  Fix with: node scripts/version.mjs ' + source);
    return 1;
  }
  console.log(`✔ ${source} everywhere (${places.map((p) => p.file).join(', ')})`);
  return 0;
}

function set(next) {
  if (!SEMVER.test(next)) {
    console.error(`✖ "${next}" isn't a version like 1.2.3 (or 1.2.3-beta.1)`);
    return 1;
  }
  const places = current();
  const now = places[0].version;
  // Re-running with the current version just brings the other files in line.
  if (SEMVER.test(now ?? '') && compare(next, now) < 0) {
    console.error(`✖ ${next} is lower than the current ${now}; versions only go up.`);
    return 1;
  }
  for (const p of places) {
    p.set(p.json, next);
    write(p.file, p.json);
  }
  console.log(`✔ ${now} → ${next} in ${places.map((p) => p.file).join(', ')}`);
  return 0;
}

const arg = process.argv[2];
process.exit(arg ? set(arg) : check());
