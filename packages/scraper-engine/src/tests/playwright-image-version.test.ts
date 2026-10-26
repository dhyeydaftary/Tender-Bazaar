import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The scraper image's Playwright base must match the Playwright the lockfile
 * installs.
 *
 * Regression: the Dockerfile used mcr.microsoft.com/playwright:v1.44.0-jammy
 * while pnpm-lock.yaml resolved playwright@1.64.1. Each Playwright release
 * looks for its own browser revision under /ms-playwright, which only the
 * same-version image ships, so chromium.launch() failed in the container with
 * "Executable doesn't exist" — every real scrape would fail. Nothing in the
 * build caught it because `npm install playwright` does not download browsers.
 */

console.log('--- Starting Playwright Image Version Tests ---');

const PKG = join(__dirname, '..', '..');
const REPO = join(PKG, '..', '..');

const dockerfile = readFileSync(join(PKG, 'Dockerfile'), 'utf8');
const from = /^FROM\s+mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)(-[a-z]+)?\s*$/m.exec(dockerfile);
assert.ok(from, 'Dockerfile must be based on a version-pinned mcr.microsoft.com/playwright image');
const imageVersion = from![1];

const lock = readFileSync(join(REPO, 'pnpm-lock.yaml'), 'utf8');
const locked = [...lock.matchAll(/^ {2}playwright@(\d+\.\d+\.\d+):/gm)].map((m) => m[1]);
assert.ok(locked.length > 0, 'pnpm-lock.yaml resolves playwright');
const lockedVersions = [...new Set(locked)];
assert.equal(lockedVersions.length, 1, `exactly one playwright version locked (got ${lockedVersions.join(', ')})`);
const coreVersions = [...new Set([...lock.matchAll(/^ {2}playwright-core@(\d+\.\d+\.\d+):/gm)].map((m) => m[1]))];
assert.deepEqual(coreVersions, lockedVersions, 'playwright-core matches playwright');

assert.equal(
  imageVersion,
  lockedVersions[0],
  `Dockerfile Playwright image v${imageVersion} must equal locked playwright ${lockedVersions[0]}`,
);
console.log(`  ✓ Dockerfile image v${imageVersion} matches locked playwright ${lockedVersions[0]}`);

const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
const range: string = pkg.dependencies.playwright;
const [maj, min] = range.replace(/^[\^~]/, '').split('.').map(Number);
const [lmaj, lmin] = lockedVersions[0].split('.').map(Number);
assert.ok(lmaj === maj && lmin >= min, `package.json range ${range} admits ${lockedVersions[0]}`);
console.log(`  ✓ package.json range ${range} admits the locked version`);

console.log('--- Playwright Image Version Tests passed ---');
