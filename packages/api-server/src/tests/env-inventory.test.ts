import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Keeps `.env.example` honest.
 *
 * Phase 8's `.env` fix exposed that production had to supply every variable
 * api-server needs — and Phase 9 then found that `.env.example` documented
 * **ten names that no code reads**, while the names actually read were
 * undocumented. An operator filling it in faithfully got S3 uploads, the SES
 * sender address and WhatsApp silently non-functional, with no error anywhere.
 *
 * That class of bug is invisible to every other test, because nothing fails —
 * the feature is just inert. So this suite asserts the documentation against
 * the source tree: every name in `.env.example` must either be read somewhere,
 * or be explicitly listed below as known-inert.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * Names documented in `.env.example` that nothing reads, each annotated
 * `# UNUSED` in that file. Listed here deliberately: adding a name to this set
 * is a decision to ship a documented-but-inert variable, and should be argued
 * for in review rather than slipping in unnoticed.
 */
const KNOWN_INERT = new Set([
  // notification-service reads AWS_REGION instead.
  'AWS_SES_REGION',
  // providers/push.ts initializes firebase-admin with projectId only, so these
  // two are never consulted; push cannot authenticate as documented.
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  // No frontend code reads these.
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_RAZORPAY_KEY_ID',
]);

/** Directories and files that may legitimately reference a variable name. */
const SEARCH_ROOTS = [
  'packages/api-server/src',
  'packages/notification-service/src',
  'packages/scraper-engine/src',
  'packages/shared/src',
  'packages/ai-service',
  'apps/web',
  'apps/admin',
  'prisma',
  'docker',
  'scripts',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'docker-compose.override.yml',
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', '__pycache__']);
const TEXT_EXT = /\.(ts|tsx|js|cjs|mjs|py|yml|yaml|sh|json)$/;

function collectFiles(relative: string, into: string[]): void {
  const absolute = join(REPO_ROOT, relative);
  let info;
  try {
    info = statSync(absolute);
  } catch {
    return;
  }

  if (info.isFile()) {
    into.push(absolute);
    return;
  }

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(join(relative, entry.name), into);
    } else if (TEXT_EXT.test(entry.name)) {
      into.push(join(absolute, entry.name));
    }
  }
}

console.log('--- Starting Environment Inventory Tests ---');

const files: string[] = [];
for (const root of SEARCH_ROOTS) collectFiles(root, files);
assert.ok(files.length > 50, `expected a populated source tree, found ${files.length} files`);

const haystack = files.map((f) => readFileSync(f, 'utf8')).join('\n');

const documented = [
  ...readFileSync(join(REPO_ROOT, '.env.example'), 'utf8').matchAll(
    /^([A-Z][A-Z0-9_]*)=/gm,
  ),
].map((m) => m[1]);

// 1. Every documented name is either read somewhere or explicitly known-inert.
{
  assert.ok(documented.length > 30, `expected a substantial inventory, got ${documented.length}`);

  const orphans = documented.filter(
    (name) => !KNOWN_INERT.has(name) && !haystack.includes(name),
  );

  assert.deepEqual(
    orphans,
    [],
    `.env.example documents name(s) that nothing reads: ${orphans.join(', ')}. ` +
      'Either fix the name to match what the code reads, or add it to KNOWN_INERT ' +
      'with a comment explaining why a documented-but-inert variable is acceptable.',
  );

  console.log(
    `✓ All ${documented.length} documented names are read somewhere ` +
      `(${KNOWN_INERT.size} explicitly known-inert)`,
  );
}

// 2. The names the code actually reads for the previously-mismatched
//    integrations are the ones documented.
{
  for (const [name, reader] of [
    ['AWS_SES_FROM_EMAIL', 'notification-service'],
    ['WATI_API_KEY', 'notification-service'],
    ['AWS_ACCESS_KEY_ID', 'api-server upload path'],
    ['AWS_SECRET_ACCESS_KEY', 'api-server upload path'],
    ['S3_BUCKET', 'api-server upload path'],
  ] as const) {
    assert.ok(
      documented.includes(name),
      `${name} is read by ${reader} but is not documented in .env.example`,
    );
  }

  // And the dead names must not come back.
  for (const dead of ['EMAIL_FROM', 'WATI_API_TOKEN', 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY']) {
    assert.ok(
      !documented.includes(dead),
      `${dead} is read by nothing and must not be documented as if it were`,
    );
  }

  console.log('✓ Previously mismatched names are documented correctly and the dead names are gone');
}

// 3. Every name annotated `# UNUSED` is in KNOWN_INERT, and vice versa — the
//    file and this test cannot drift apart.
{
  const exampleSrc = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
  const annotated = new Set<string>();
  const lines = exampleSrc.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(lines[i]!);
    if (!match) continue;
    // Walk back over the contiguous comment block above this assignment.
    for (let j = i - 1; j >= 0 && lines[j]!.startsWith('#'); j--) {
      if (/UNUSED/.test(lines[j]!)) {
        annotated.add(match[1]!);
        break;
      }
    }
  }

  for (const name of annotated) {
    assert.ok(
      KNOWN_INERT.has(name),
      `${name} is annotated # UNUSED in .env.example but is not in KNOWN_INERT`,
    );
  }

  console.log(`✓ ${annotated.size} '# UNUSED' annotations all accounted for in KNOWN_INERT`);
}

// 4. The optional-integration startup report lists features, never values.
{
  delete require.cache[require.resolve('../config/env')];
  process.env.NODE_ENV = 'development';
  process.env.RAZORPAY_KEY_ID = '';
  process.env.RAZORPAY_KEY_SECRET = '';
  process.env.SENTRY_DSN = '';

  const { reportOptionalIntegrationStatus } = require('../config/env') as
    typeof import('../config/env');

  const lines: string[] = [];
  const unconfigured = reportOptionalIntegrationStatus((m) => lines.push(m));

  assert.ok(
    unconfigured.includes('Payments (Razorpay)'),
    'unset Razorpay credentials must be reported',
  );
  assert.ok(unconfigured.includes('Error reporting (Sentry)'));
  assert.ok(lines.some((l) => l.includes('RAZORPAY_KEY_ID')), 'the report names the variable');
  assert.ok(
    lines.some((l) => /503 PAYMENTS_NOT_CONFIGURED|inert/.test(l)),
    'the report states the impact',
  );

  // A secret that IS set must never be echoed.
  process.env.RAZORPAY_KEY_ID = 'rzp_live_should_never_be_logged';
  process.env.RAZORPAY_KEY_SECRET = 'secret_should_never_be_logged';
  delete require.cache[require.resolve('../config/env')];
  const reloaded = require('../config/env') as typeof import('../config/env');
  const lines2: string[] = [];
  reloaded.reportOptionalIntegrationStatus((m) => lines2.push(m));

  const joined = lines2.join('\n');
  assert.ok(
    !joined.includes('should_never_be_logged'),
    'the startup report must never echo a configured value',
  );

  console.log('✓ Startup report names unconfigured features and never echoes a value');
}

console.log('--- All Environment Inventory Tests Passed ---');
