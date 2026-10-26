import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLOSED_TENDER_STATUSES,
  OPEN_TENDER_STATUSES,
  expiredOpenTendersWhere,
  pickUnambiguous,
  summarizeStatusCounts,
} from '../modules/tenders/status-groups';

/**
 * Tender tab counts (GET /tenders/stats) and the detail-lookup rule.
 *
 * Regression: the stats counted Active as status=ACTIVE only and Closed as
 * CLOSED+AWARDED+CANCELLED, so CORRIGENDUM tenders — still open for bidding —
 * were in neither tab and Active + Closed did not add up to All. The expiry
 * rule likewise closed only ACTIVE tenders, so an expired CORRIGENDUM tender
 * stayed open forever. And GET /tenders/:id answered an unknown id with an
 * unrelated tender.
 */

console.log('--- Starting Tender Status Group Tests ---');

const REPO = join(__dirname, '..', '..', '..', '..');
const schema = readFileSync(join(REPO, 'prisma', 'schema.prisma'), 'utf8');
const enumBody = /enum TenderStatus \{([^}]*)\}/.exec(schema)?.[1] ?? '';
const allStatuses = enumBody.split('\n').map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l));
assert.ok(allStatuses.length > 0, 'TenderStatus enum found');

// 1. Every status is in exactly one group, so open + closed === total.
const open = OPEN_TENDER_STATUSES as readonly string[];
const closed = CLOSED_TENDER_STATUSES as readonly string[];
for (const status of allStatuses) {
  const groups = Number(open.includes(status)) + Number(closed.includes(status));
  assert.equal(groups, 1, `${status} must belong to exactly one tab group`);
}
for (const status of [...open, ...closed]) assert.ok(allStatuses.includes(status), `${status} exists in the schema`);
assert.ok(open.includes('CORRIGENDUM'), 'a corrigendum tender is still open for bidding');
console.log(`  ✓ all ${allStatuses.length} TenderStatus values classified exactly once (open: ${open.join('+')})`);

// 2. Counts derive from the rows, whatever they are.
function rows(counts: Record<string, number>) {
  return Object.entries(counts).map(([status, _count]) => ({ status, _count }));
}
const sample = rows({ ACTIVE: 7, CORRIGENDUM: 3, CLOSED: 2, AWARDED: 4, CANCELLED: 1 });
const s = summarizeStatusCounts(sample);
assert.deepEqual(s, { total: 17, active: 10, closed: 7, unclassified: 0 });
assert.equal(s.active + s.closed, s.total, 'tabs add up to All');
// A status unknown to these groups is reported, never silently folded into a tab.
assert.deepEqual(summarizeStatusCounts(rows({ ACTIVE: 1, FUTURE_STATUS: 2 })), {
  total: 3,
  active: 1,
  closed: 0,
  unclassified: 2,
});
assert.deepEqual(summarizeStatusCounts([]), { total: 0, active: 0, closed: 0, unclassified: 0 });
// Random distributions over the real enum always add up.
for (let i = 0; i < 50; i++) {
  const counts = Object.fromEntries(allStatuses.map((st) => [st, Math.floor(Math.random() * 40)]));
  const r = summarizeStatusCounts(rows(counts));
  assert.equal(r.active + r.closed, r.total);
  assert.equal(r.unclassified, 0);
}
console.log('  ✓ counts derive from status rows; Active + Closed === All; unknown statuses surfaced');

// 3. Expiry closes every open status with a past deadline — not only ACTIVE.
const now = new Date('2026-10-22T10:00:00Z');
const where = expiredOpenTendersWhere(now);
assert.deepEqual(where.status.in.slice().sort(), [...open].sort());
assert.equal(where.bidSubmissionDeadline.lt.getTime(), now.getTime());
function matches(t: { status: string; bidSubmissionDeadline: Date }) {
  return where.status.in.includes(t.status as never) && t.bidSubmissionDeadline < where.bidSubmissionDeadline.lt;
}
const past = new Date(now.getTime() - 60_000);
const future = new Date(now.getTime() + 60_000);
assert.equal(matches({ status: 'ACTIVE', bidSubmissionDeadline: past }), true);
assert.equal(matches({ status: 'CORRIGENDUM', bidSubmissionDeadline: past }), true, 'expired corrigendum closes');
assert.equal(matches({ status: 'ACTIVE', bidSubmissionDeadline: future }), false);
assert.equal(matches({ status: 'CORRIGENDUM', bidSubmissionDeadline: future }), false);
for (const st of closed) assert.equal(matches({ status: st, bidSubmissionDeadline: past }), false, `${st} untouched`);
console.log('  ✓ expired ACTIVE and CORRIGENDUM tenders close; future deadlines and closed statuses untouched');

// 4. The web tabs request exactly these groups.
const webPage = readFileSync(join(REPO, 'apps', 'web', 'src', 'app', '(dashboard)', 'tenders', 'page.tsx'), 'utf8');
const fn = /function statusFilterForTab[\s\S]*?\n\}/.exec(webPage)?.[0] ?? '';
const lists = [...fn.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].replace(/['\s]/g, '').split(',').filter(Boolean).sort());
assert.deepEqual(lists, [[...closed].sort(), [...open].sort()], 'web tab filters mirror the API groups');
assert.ok(!/status:\s*\[statusTab\]/.test(webPage), 'no tab path filters by the raw tab name');
console.log('  ✓ web Active/Closed tabs filter by the same status groups as the counts');

// 5. Detail lookup: a partial id resolves only when unambiguous.
assert.equal(pickUnambiguous([]), null);
assert.equal(pickUnambiguous(['only']), 'only');
assert.equal(pickUnambiguous(['a', 'b']), null, 'ambiguous partial id must not pick a tender');
const service = readFileSync(join(__dirname, '..', 'modules', 'tenders', 'service.ts'), 'utf8');
const lookup = /async getTenderById[\s\S]*?Increment view count/.exec(service)?.[0] ?? '';
assert.ok(lookup.includes("throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND')"));
assert.ok(!/where:\s*\{\s*status:\s*'ACTIVE'\s*\}/.test(lookup), 'no fallback to an arbitrary ACTIVE tender');
console.log('  ✓ unknown ids 404; partial ids resolve only when they match exactly one tender');

console.log('--- Tender Status Group Tests passed ---');
