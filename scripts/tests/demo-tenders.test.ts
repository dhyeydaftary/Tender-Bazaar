/**
 * Demo tender dataset + seed guard.
 *
 *   npx tsx scripts/tests/demo-tenders.test.ts
 *
 * No database: the dataset builder is pure, and the seed's guards fail before
 * it ever connects.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildDemoDataset,
  DEMO_NOTE,
  DEMO_SOURCE_PORTALS,
  DEMO_TENDER_COUNT,
} from '../../prisma/demo/demo-tenders';

console.log('--- Starting Demo Tender Dataset Tests ---');

const ROOT = join(__dirname, '..', '..');
const DAY = 86_400_000;
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

function enumValues(name: string): string[] {
  const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  assert.ok(m, `enum ${name} not found in schema`);
  return m![1].split('\n').map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l));
}

const now = new Date('2026-10-22T09:30:00Z');
const a = buildDemoDataset(now);
const b = buildDemoDataset(now);

// Deterministic.
assert.deepEqual(a, b, 'same input must give an identical dataset');
assert.equal(a.tenders.length, DEMO_TENDER_COUNT);
// Content is stable across days; only dates move.
const later = buildDemoDataset(new Date(now.getTime() + 9 * DAY));
assert.deepEqual(
  later.tenders.map((t) => [t.sourceId, t.title, t.organization, t.estimatedValue, t.status]),
  a.tenders.map((t) => [t.sourceId, t.title, t.organization, t.estimatedValue, t.status]),
);
console.log(`  ✓ ${a.tenders.length} tenders, deterministic; content stable when re-seeded on another day`);

// Unique keys (idempotent upserts rely on them).
const keys = new Set(a.tenders.map((t) => `${t.sourcePortal}|${t.sourceId}`));
assert.equal(keys.size, a.tenders.length);
assert.equal(new Set(a.documents.map((d) => d.id)).size, a.documents.length);
assert.equal(new Set(a.results.map((r) => r.id)).size, a.results.length);
console.log('  ✓ (sourcePortal, sourceId), document ids and result ids are unique');

// Schema validity.
const types = enumValues('TenderType');
const categories = enumValues('TenderCategory');
const statuses = enumValues('TenderStatus');
for (const t of a.tenders) {
  assert.ok(types.includes(t.tenderType), t.tenderType);
  assert.ok(categories.includes(t.category), t.category);
  assert.ok(statuses.includes(t.status), t.status);
  for (const field of ['title', 'referenceNumber', 'organization', 'state', 'sourcePortal', 'sourceUrl', 'sourceId'] as const) {
    assert.ok(t[field].length > 0, `${field} empty`);
  }
}
console.log('  ✓ every enum value exists in prisma/schema.prisma; required strings are non-empty');

// Clearly synthetic, never presented as a real portal record.
const httpish = /https?:\/\//i;
// Real portal domains (the demo portal *names* such as "eProcure-Demo" are fine).
const official = /(\.gov\.in|\.nic\.in|gem\.gov|eprocure\.gov|mahatenders\.|nprocure\.com|ireps\.gov)/i;
for (const t of a.tenders) {
  assert.ok((DEMO_SOURCE_PORTALS as readonly string[]).includes(t.sourcePortal));
  assert.match(t.sourceId, /^DEMO-[A-Z]+-\d{3}$/);
  assert.match(t.referenceNumber, /^DEMO\//);
  assert.match(t.sourceUrl, /^demo:\/\/tenderbazaar\//);
  assert.ok(t.description.endsWith(DEMO_NOTE), 'description carries the synthetic-record note');
  for (const value of Object.values(t)) {
    if (typeof value === 'string') {
      assert.ok(!httpish.test(value), `http(s) URL in ${t.sourceId}`);
      assert.ok(!official.test(value), `official portal reference in ${t.sourceId}: ${value}`);
    }
  }
}
for (const d of a.documents) assert.match(d.fileUrl, /^demo:\/\/tenderbazaar\//);
for (const r of a.results) assert.match(r.winnerName, /\(Demo\)$/);
console.log('  ✓ demo portals, DEMO- ids, demo:// links, synthetic note; no http(s) or official portal references');

// Dates make sense relative to now, and survive GET /tenders/stats' CLOSED rewrite.
for (const t of a.tenders) {
  assert.ok(t.publishedDate.getTime() <= now.getTime(), 'published in the past');
  assert.ok(t.createdAt.getTime() <= now.getTime(), 'created in the past');
  assert.ok(t.bidOpeningDate > t.bidSubmissionDeadline);
  if (t.status === 'ACTIVE' || t.status === 'CORRIGENDUM') {
    assert.ok(t.bidSubmissionDeadline.getTime() > now.getTime() + 3 * DAY, `${t.sourceId} deadline too close`);
  } else {
    assert.ok(t.bidSubmissionDeadline.getTime() < now.getTime(), `${t.sourceId} closed but deadline in future`);
  }
}
const awarded = a.tenders.filter((t) => t.status === 'AWARDED').map((t) => t.sourceId).sort();
assert.deepEqual(a.results.map((r) => r.sourceId).sort(), awarded, 'every AWARDED tender has exactly one result');
for (const r of a.results) assert.ok(r.awardedDate.getTime() <= now.getTime());
console.log('  ✓ ACTIVE deadlines are >3 days out; closed ones are past; every award has a result');

// Variety for filters, facets and charts.
const distinct = <T>(xs: T[]) => new Set(xs).size;
assert.equal(distinct(a.tenders.map((t) => t.category)), 4);
assert.equal(distinct(a.tenders.map((t) => t.status)), 5);
assert.equal(distinct(a.tenders.map((t) => t.sourcePortal)), DEMO_SOURCE_PORTALS.length);
assert.ok(distinct(a.tenders.map((t) => t.state)) >= 10, 'at least 10 states');
assert.ok(distinct(a.tenders.map((t) => t.tenderType)) >= 6, 'at least 6 tender types');
assert.ok(distinct(a.tenders.map((t) => t.createdAt.toISOString().slice(0, 10))) >= 15, 'createdAt spread over 15+ days');
assert.ok(a.tenders.some((t) => t.reservedForMSME) && a.tenders.some((t) => !t.reservedForMSME));
const values = a.tenders.map((t) => t.estimatedValue);
assert.ok(Math.min(...values) < 1e7 && Math.max(...values) > 1e8, 'values span lakhs to hundreds of crores');
const statePortal = a.tenders.filter((t) => ['Maharashtra-Demo', 'Gujarat-Demo', 'Rajasthan-Demo'].includes(t.sourcePortal));
assert.ok(statePortal.every((t) => t.sourcePortal.startsWith(t.state)), 'state portals only list their own state');
console.log('  ✓ variety: 4 categories, 5 statuses, 6 portals, 10+ states, 6+ types, 15+ creation days');

// Seed guards refuse before connecting to any database.
// tsx's CLI run by this same node binary: no shell, so paths with spaces work.
const tsxCli = require.resolve('tsx/cli', { paths: [join(ROOT, 'packages', 'scraper-engine'), ROOT] });
function runSeed(env: Record<string, string>) {
  return spawnSync(process.execPath, [tsxCli, join(ROOT, 'prisma', 'demo-seed.ts')], {
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      // bcryptjs is a root dependency (pnpm-lock importer '.'); a local root
      // install that predates it only has it under api-server, so allow that
      // location too. Docker images install it at the root as declared.
      NODE_PATH: join(ROOT, 'packages', 'api-server', 'node_modules'),
      ...env,
    },
    encoding: 'utf8',
  });
}
const noTarget = runSeed({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/tenderbazaar_demo' });
assert.equal(noTarget.status, 1);
assert.match(noTarget.stderr, /DEMO_SEED_TARGET must be "tenderbazaar-demo"/);
const wrongDb = runSeed({ DEMO_SEED_TARGET: 'tenderbazaar-demo', DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/tenderbazaar' });
assert.equal(wrongDb.status, 1);
assert.match(wrongDb.stderr, /must target the "tenderbazaar_demo" database/);
console.log('  ✓ seed refuses without DEMO_SEED_TARGET and against any database other than tenderbazaar_demo');

console.log('--- Demo Tender Dataset Tests passed ---');
