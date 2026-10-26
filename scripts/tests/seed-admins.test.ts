/**
 * prisma/seed.ts administrator provisioning.
 *
 *   npx tsx scripts/tests/seed-admins.test.ts
 *
 * Regression: the seed created the development fixture accounts (whose
 * passwords are public in this repository) in every environment, including
 * production, and silently skipped a too-short SEED_ADMIN_PASSWORD.
 *
 * No database is used. The end-to-end checks run seed.ts against an
 * unreachable address, so a validation failure proves the check happened
 * before any database access.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import {
  DEV_FIXTURE_ADMINS,
  MIN_SEED_ADMIN_PASSWORD_LENGTH,
  resolveSeedAdmins,
} from '../../prisma/seed-admins';

console.log('--- Starting Seed Admin Tests ---');

const FIXTURE_EMAILS = DEV_FIXTURE_ADMINS.map((a) => a.email);
const STRONG = 'x'.repeat(MIN_SEED_ADMIN_PASSWORD_LENGTH);
const SHORT = 'x'.repeat(MIN_SEED_ADMIN_PASSWORD_LENGTH - 1);
const emails = (list: { email: string }[]) => list.map((a) => a.email);

// 1. Development keeps the fixtures (your local workflow).
assert.deepEqual(emails(resolveSeedAdmins({ NODE_ENV: 'development' })), FIXTURE_EMAILS);
assert.deepEqual(emails(resolveSeedAdmins({})), FIXTURE_EMAILS, 'unset NODE_ENV counts as development');
const devWithAdmin = resolveSeedAdmins({ NODE_ENV: 'development', SEED_ADMIN_EMAIL: 'ops@example.test', SEED_ADMIN_PASSWORD: STRONG });
assert.deepEqual(emails(devWithAdmin), ['ops@example.test', ...FIXTURE_EMAILS]);
console.log('  ✓ development: fixture accounts created (plus SEED_ADMIN_* when set)');

// 2. Production never includes the fixtures.
assert.deepEqual(resolveSeedAdmins({ NODE_ENV: 'production' }), [], 'no admin without SEED_ADMIN_* (existing design)');
const prod = resolveSeedAdmins({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: ' ops@example.test ', SEED_ADMIN_PASSWORD: STRONG, SEED_ADMIN_NAME: 'Ops' });
assert.deepEqual(prod, [{ name: 'Ops', email: 'ops@example.test', password: STRONG, role: 'SUPER_ADMIN' }]);
for (const list of [prod, resolveSeedAdmins({ NODE_ENV: 'production' })]) {
  for (const fixture of FIXTURE_EMAILS) assert.ok(!emails(list).includes(fixture), `${fixture} must not be seeded in production`);
}
console.log('  ✓ production: only the configured SEED_ADMIN_* account; never a fixture account');

// 3 & 4. Incomplete or weak configuration fails in every environment.
for (const NODE_ENV of ['production', 'development']) {
  assert.throws(() => resolveSeedAdmins({ NODE_ENV, SEED_ADMIN_EMAIL: 'ops@example.test' }), /must be set together/);
  assert.throws(() => resolveSeedAdmins({ NODE_ENV, SEED_ADMIN_PASSWORD: STRONG }), /must be set together/);
  assert.throws(() => resolveSeedAdmins({ NODE_ENV, SEED_ADMIN_EMAIL: 'ops@example.test', SEED_ADMIN_PASSWORD: SHORT }), /at least 12 characters/);
  assert.throws(() => resolveSeedAdmins({ NODE_ENV, SEED_ADMIN_EMAIL: '   ', SEED_ADMIN_PASSWORD: STRONG }), /must be set together/);
}
console.log('  ✓ missing email/password or a password under 12 characters throws (production and development)');

// Errors never echo the password.
try {
  resolveSeedAdmins({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'ops@example.test', SEED_ADMIN_PASSWORD: 'short-secret' });
} catch (err) {
  assert.ok(!(err as Error).message.includes('short-secret'));
}
console.log('  ✓ error messages never include the password');

// 6. End to end: seed.ts validates before any database access and exits non-zero.
const ROOT = join(__dirname, '..', '..');
const tsxCli = require.resolve('tsx/cli', { paths: [join(ROOT, 'packages', 'scraper-engine'), ROOT] });
function runSeed(env: Record<string, string>) {
  return spawnSync(process.execPath, [tsxCli, join(ROOT, 'prisma', 'seed.ts')], {
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      // Unreachable on purpose: any database access would fail differently.
      DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/none',
      // bcryptjs is a root dependency; a stale local root install may only have
      // it under api-server, so allow resolving it from there too.
      NODE_PATH: join(ROOT, 'packages', 'api-server', 'node_modules'),
      ...env,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
}
const weak = runSeed({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'ops@example.test', SEED_ADMIN_PASSWORD: SHORT });
assert.equal(weak.status, 1, 'non-zero exit');
assert.match(weak.stderr, /SEED_ADMIN_PASSWORD must be at least 12 characters/);
assert.ok(!/Seeding database/.test(weak.stdout), 'failed before seeding started');
assert.ok(!/Can't reach database|P1001|ECONNREFUSED/.test(weak.stderr), 'no database access was attempted');
const half = runSeed({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'ops@example.test' });
assert.equal(half.status, 1);
assert.match(half.stderr, /must be set together/);
// A valid configuration passes validation and only then reaches the (unreachable) database.
const valid = runSeed({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'ops@example.test', SEED_ADMIN_PASSWORD: STRONG });
assert.equal(valid.status, 1);
assert.match(valid.stdout, /Seeding database/, 'validation passed and seeding started');
assert.ok(!/must be (set together|at least)/.test(valid.stderr));
console.log('  ✓ seed.ts exits 1 on bad admin config before touching the database; valid config proceeds');

console.log('--- Seed Admin Tests passed ---');
