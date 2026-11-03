import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EXPIRING_SOON_DAYS,
  OPEN_TENDER_STATUSES,
  expiringSoonWhere,
  openForBiddingWhere,
} from '../modules/tenders/status-groups';
import { tenderListPageSchema } from '../modules/tenders/validation';
import { cappedLimit } from '../shared/middleware/plan-guard';

/**
 * Home-page tender lists (mobile "Recommended for you" / "Expiring soon").
 *
 * Regression: the mobile home page showed hard-coded tenders whose deadlines had
 * passed, both "See all" buttons opened Search, and the API had no
 * /tenders/recommended or /tenders/expiring route. Recommendations also filtered
 * on status: 'ACTIVE' alone, so an ACTIVE tender past its deadline (statuses are
 * only flipped to CLOSED when getTenderStats runs) could still be recommended.
 */

console.log('--- Starting Home Tender List Tests ---');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-03T12:00:00.000Z');

type Row = { status: string; bidSubmissionDeadline: Date };

/** Minimal evaluator for the Prisma where-shapes these helpers return. */
function matches(where: any, row: Row): boolean {
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  const d = where.bidSubmissionDeadline ?? {};
  const t = row.bidSubmissionDeadline.getTime();
  if (d.gt && !(t > d.gt.getTime())) return false;
  if (d.gte && !(t >= d.gte.getTime())) return false;
  if (d.lt && !(t < d.lt.getTime())) return false;
  if (d.lte && !(t <= d.lte.getTime())) return false;
  return true;
}

const at = (ms: number) => new Date(now.getTime() + ms);

// 1. Open for bidding = open status AND a future deadline.
const open = openForBiddingWhere(now);
assert.ok(matches(open, { status: 'ACTIVE', bidSubmissionDeadline: at(DAY) }));
assert.ok(matches(open, { status: 'CORRIGENDUM', bidSubmissionDeadline: at(DAY) }), 'corrigendum is still open');
assert.ok(!matches(open, { status: 'ACTIVE', bidSubmissionDeadline: at(-1000) }), 'ACTIVE but past deadline is expired');
assert.ok(!matches(open, { status: 'ACTIVE', bidSubmissionDeadline: now }), 'deadline exactly now has passed');
for (const status of ['CLOSED', 'AWARDED', 'CANCELLED']) {
  assert.ok(!matches(open, { status, bidSubmissionDeadline: at(DAY) }), `${status} is never open`);
}
assert.deepEqual([...open.status.in].sort(), [...OPEN_TENDER_STATUSES].sort());
console.log('  ✓ open-for-bidding requires an open status and a future deadline');

// 2. Expiring soon = open for bidding AND deadline within the window.
assert.equal(EXPIRING_SOON_DAYS, 7, 'window matches the web app (deadline within 7 days is urgent)');
const expiring = expiringSoonWhere(now);
assert.ok(matches(expiring, { status: 'ACTIVE', bidSubmissionDeadline: at(60 * 1000) }), 'closes in a minute');
assert.ok(matches(expiring, { status: 'CORRIGENDUM', bidSubmissionDeadline: at(3 * DAY) }));
assert.ok(matches(expiring, { status: 'ACTIVE', bidSubmissionDeadline: at(7 * DAY) }), 'window end is inclusive');
assert.ok(!matches(expiring, { status: 'ACTIVE', bidSubmissionDeadline: at(7 * DAY + 1000) }), 'beyond the window');
assert.ok(!matches(expiring, { status: 'ACTIVE', bidSubmissionDeadline: at(-DAY) }), 'already expired');
assert.ok(!matches(expiring, { status: 'CANCELLED', bidSubmissionDeadline: at(DAY) }), 'cancelled');
console.log('  ✓ expiring-soon keeps only open tenders closing within 7 days');

// 3. Pagination input is validated.
assert.deepEqual(tenderListPageSchema.parse({}), { page: 1, limit: 20 });
assert.deepEqual(tenderListPageSchema.parse({ page: '2', limit: '5' }), { page: 2, limit: 5 });
assert.throws(() => tenderListPageSchema.parse({ limit: '500' }), 'limit is capped');
assert.throws(() => tenderListPageSchema.parse({ page: '0' }), 'page starts at 1');
console.log('  ✓ page/limit are validated');

// 4. Plan page size caps the limit instead of inflating a smaller request.
assert.equal(cappedLimit('5', 20), '5', 'a 5-item preview stays 5 on the free plan');
assert.equal(cappedLimit('50', 20), '20', 'never more than the plan allows');
assert.equal(cappedLimit(undefined, 20), '20', 'default is the plan size');
for (const junk of ['0', '-3', 'abc', '2.5', '']) assert.equal(cappedLimit(junk, 20), '20', `junk limit ${junk}`);
console.log('  ✓ free-plan page size caps the limit without inflating smaller requests');

// 5. Wiring: routes exist ahead of /:id, and every recommendation path uses the rule.
const modules = join(__dirname, '..', 'modules');
// Line comments are stripped so explanatory comments can't satisfy or trip a check.
const read = (p: string) => readFileSync(join(modules, p), 'utf8').replace(/^\s*\/\/.*$/gm, '');

const routes = read('tenders/routes.ts');
const idx = (path: string) => routes.indexOf(`router.get('${path}'`);
assert.ok(idx('/recommended') > 0 && idx('/expiring') > 0, 'list routes are registered');
assert.ok(idx('/recommended') < idx('/:id') && idx('/expiring') < idx('/:id'), 'list routes come before /:id');
assert.match(routes, /'\/recommended',\s*authenticate,/, 'recommendations need a signed-in user');

const tenderService = read('tenders/service.ts');
const getExpiring = /async getExpiringTenders[\s\S]*?\n  \},/.exec(tenderService)?.[0] ?? '';
assert.ok(getExpiring.includes('expiringSoonWhere('), 'expiring list uses the shared rule');
assert.ok(/orderBy:\s*\[\{\s*bidSubmissionDeadline:\s*'asc'/.test(getExpiring), 'soonest deadline first');

const eligibility = read('eligibility/service.ts');
const matching = /async getMatchingTenders[\s\S]*?take: 50/.exec(eligibility)?.[0] ?? '';
assert.ok(matching.includes('openForBiddingWhere('), 'personalised matches exclude expired tenders');
assert.ok(!/status:\s*'ACTIVE'/.test(matching), 'no status-only filter for matches');

const dashboard = read('dashboard/service.ts');
const listRecommended = /async listRecommendedTenders[\s\S]*?\n  \},/.exec(dashboard)?.[0] ?? '';
assert.ok(listRecommended.includes('openForBiddingWhere('), 'fallback recommendations exclude expired tenders');
assert.ok(dashboard.includes('expiringSoonWhere('), 'saved-expiring KPI uses the shared window');
assert.ok(!/EXPIRING_SOON_DAYS\s*=/.test(dashboard), 'no second expiry window in the dashboard');
console.log('  ✓ routes and services all use the shared open / expiring rules');

console.log('--- Home Tender List Tests passed ---');
