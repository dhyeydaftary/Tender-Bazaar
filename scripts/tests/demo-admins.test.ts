/**
 * prisma/demo-seed.ts administrator handling.
 *
 *   npx tsx scripts/tests/demo-admins.test.ts
 *
 * Regression: demo-seed always created two built-in admin accounts with
 * passwords hard-coded in the repository, reset every existing admin's
 * password hash and role on each run, and replaced missing or short DEMO_*
 * passwords with hard-coded weak ones.
 *
 * No database: the end-to-end checks point demo-seed at an unreachable
 * tenderbazaar_demo URL, so a validation failure proves it happened before
 * any database access.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MIN_DEMO_ADMIN_PASSWORD_LENGTH, resolveDemoAdmins } from '../../prisma/demo/demo-admins';

console.log('--- Starting Demo Admin Tests ---');

const ROOT = join(__dirname, '..', '..');
const STRONG = 'y'.repeat(MIN_DEMO_ADMIN_PASSWORD_LENGTH);
const SHORT = 'y'.repeat(MIN_DEMO_ADMIN_PASSWORD_LENGTH - 1);

// 1. Only configured accounts; nothing built in.
assert.deepEqual(resolveDemoAdmins({}), [], 'no configuration → no accounts');
assert.deepEqual(resolveDemoAdmins({ NODE_ENV: 'development' }), []);
const both = resolveDemoAdmins({
  DEMO_ADMIN_EMAIL: ' boss@demo.test ',
  DEMO_ADMIN_PASSWORD: STRONG,
  DEMO_ADMIN_NAME: 'Boss',
  DEMO_STAFF_ADMIN_EMAIL: 'staff@demo.test',
  DEMO_STAFF_ADMIN_PASSWORD: STRONG,
});
assert.deepEqual(both, [
  { name: 'Boss', email: 'boss@demo.test', password: STRONG, role: 'SUPER_ADMIN' },
  { name: 'Demo Admin', email: 'staff@demo.test', password: STRONG, role: 'ADMIN' },
]);
assert.deepEqual(
  resolveDemoAdmins({ DEMO_STAFF_ADMIN_EMAIL: 'staff@demo.test', DEMO_STAFF_ADMIN_PASSWORD: STRONG }).map((a) => a.role),
  ['ADMIN'],
  'each pair is independent',
);
console.log('  ✓ only explicitly configured DEMO_ADMIN_* (SUPER_ADMIN) / DEMO_STAFF_ADMIN_* (ADMIN) accounts');

// 2. Incomplete, short or duplicate configuration throws — no fallback password.
for (const p of ['DEMO_ADMIN', 'DEMO_STAFF_ADMIN']) {
  assert.throws(() => resolveDemoAdmins({ [`${p}_EMAIL`]: 'x@demo.test' }), /must be set together/);
  assert.throws(() => resolveDemoAdmins({ [`${p}_PASSWORD`]: STRONG }), /must be set together/);
  assert.throws(() => resolveDemoAdmins({ [`${p}_EMAIL`]: '  ', [`${p}_PASSWORD`]: STRONG }), /must be set together/);
  assert.throws(() => resolveDemoAdmins({ [`${p}_EMAIL`]: 'x@demo.test', [`${p}_PASSWORD`]: SHORT }), /at least 12 characters/);
}
assert.throws(
  () => resolveDemoAdmins({ DEMO_ADMIN_EMAIL: 'same@demo.test', DEMO_ADMIN_PASSWORD: STRONG, DEMO_STAFF_ADMIN_EMAIL: 'SAME@demo.test', DEMO_STAFF_ADMIN_PASSWORD: STRONG }),
  /duplicates another demo admin email/,
);
try {
  resolveDemoAdmins({ DEMO_STAFF_ADMIN_EMAIL: 'x@demo.test', DEMO_STAFF_ADMIN_PASSWORD: 'tooShortPw' });
  assert.fail('should throw');
} catch (err) {
  assert.ok(!(err as Error).message.includes('tooShortPw'), 'error never includes the password');
}
console.log('  ✓ partial, short (< 12) or duplicate settings throw; messages never include the password');

// 3. Source: no built-in accounts, no fallback passwords, never updates users.
const src = readFileSync(join(ROOT, 'prisma', 'demo-seed.ts'), 'utf8');
const admSrc = readFileSync(join(ROOT, 'prisma', 'demo', 'demo-admins.ts'), 'utf8');
for (const [name, text] of [['demo-seed.ts', src], ['demo-admins.ts', admSrc]] as const) {
  assert.ok(!/@tenderbazaar\.com/.test(text), `${name}: no built-in tenderbazaar.com accounts`);
  assert.ok(!/password\s*:\s*'[^']+'/i.test(text), `${name}: no literal passwords`);
  assert.ok(!/_PASSWORD\?\.trim\(\)\s*\|\|\s*'/.test(text), `${name}: no fallback passwords`);
}
assert.ok(!/prisma\.user\.(update|upsert|updateMany)\(/.test(src), 'demo-seed never updates or upserts users');
assert.match(src, /bcrypt\.hash\(admin\.password, 12\)/, 'bcrypt cost 12, as in seed.ts');
const main = src.slice(src.indexOf('async function main'));
assert.ok(main.indexOf('resolveDemoAdmins(process.env)') < main.indexOf('new PrismaClient()'), 'validated before the database client exists');
console.log('  ✓ demo-seed.ts: no built-in accounts or fallback passwords, create-only, bcrypt 12, validates first');

// 4. End to end: bad config exits 1 before any database access; valid config proceeds.
const tsxCli = require.resolve('tsx/cli', { paths: [join(ROOT, 'packages', 'scraper-engine'), ROOT] });
function runDemoSeed(env: Record<string, string>) {
  return spawnSync(process.execPath, [tsxCli, join(ROOT, 'prisma', 'demo-seed.ts')], {
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      DEMO_SEED_TARGET: 'tenderbazaar-demo',
      // Right database name, unreachable on purpose.
      DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/tenderbazaar_demo',
      // bcryptjs is a root dependency; a stale local root install may only have it under api-server.
      NODE_PATH: join(ROOT, 'packages', 'api-server', 'node_modules'),
      ...env,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
}
const short = runDemoSeed({ DEMO_STAFF_ADMIN_EMAIL: 'staff@demo.test', DEMO_STAFF_ADMIN_PASSWORD: SHORT });
assert.equal(short.status, 1);
assert.match(short.stderr, /DEMO_STAFF_ADMIN_PASSWORD must be at least 12 characters/);
assert.ok(!/Can't reach database|P1001|ECONNREFUSED/.test(short.stderr + short.stdout), 'no database access attempted');
const partial = runDemoSeed({ DEMO_ADMIN_EMAIL: 'boss@demo.test' });
assert.equal(partial.status, 1);
assert.match(partial.stderr, /DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD must be set together/);
const valid = runDemoSeed({ DEMO_STAFF_ADMIN_EMAIL: 'staff@demo.test', DEMO_STAFF_ADMIN_PASSWORD: STRONG });
assert.equal(valid.status, 1, 'fails only because the database is unreachable');
assert.ok(!/must be (set together|at least)/.test(valid.stderr), 'valid configuration passed validation');
console.log('  ✓ demo-seed exits 1 on bad admin config before touching the database; valid config proceeds');

console.log('--- Demo Admin Tests passed ---');
