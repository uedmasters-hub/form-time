#!/usr/bin/env node
/**
 * Builds the website into dist/ (static HTML for every route, plus the
 * bundles), for Vercel or any static host: `npm run build:web`.
 *
 * The build is labelled with the commit it came from (Vercel's or GitHub's,
 * else the local checkout), shown in Settings as "FORM / TIME 1.0.0 (abc1234)".
 * --clear: Metro's cache would otherwise keep the label of an earlier build.
 */
import { spawnSync } from 'node:child_process';

function commit() {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : '';
}

const result = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--clear', '--output-dir', 'dist'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, EXPO_PUBLIC_BUILD_ID: process.env.EXPO_PUBLIC_BUILD_ID || commit() },
  },
);
process.exit(result.status ?? 1);
