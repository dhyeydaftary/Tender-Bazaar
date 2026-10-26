/**
 * Scraper dashboard KPIs — synthetic fixtures only.
 *
 *   npx tsx scripts/tests/scraper-kpis.test.ts
 *
 * Covers the defects found in the dashboard:
 *   - Success rate came from ScraperHealth counters that drift from the run
 *     history (a FAILED WestBengal run never counted → 100%).
 *   - "Tenders Found" fell back to the database tender count when a portal's
 *     latest run found 0, mixing latest-run and all-time figures.
 *   - "Active Scrapers" counted enabled portals, not running jobs.
 *   - Runs that completed with page errors were indistinguishable from clean ones.
 */

import assert from 'node:assert/strict';

import { buildRunStats, emptyRunStats } from '../../packages/api-server/src/modules/admin/services/scraper-run-stats';
import { computeScraperKpis, floorPercent, portalSuccessShares } from '../../apps/admin/src/lib/scraper-kpis';
import type { ScraperHealthEntry } from '../../apps/admin/src/lib/types';

console.log('--- Starting Scraper KPI Tests ---');

type Row = { portalName: string; status: string; _count: number };

// API side: run outcomes from ScrapingRun rows.
const byStatus: Row[] = [
  { portalName: 'A', status: 'COMPLETED', _count: 8 },
  { portalName: 'A', status: 'FAILED', _count: 2 },
  { portalName: 'A', status: 'CANCELLED', _count: 1 },
  { portalName: 'A', status: 'RUNNING', _count: 1 },
  { portalName: 'B', status: 'COMPLETED', _count: 5 },
  { portalName: 'B', status: 'PENDING', _count: 2 },
];
const stats = buildRunStats(byStatus, [{ portalName: 'A', _count: 3 }]);
assert.deepEqual(stats.get('A'), { total: 12, completed: 8, completedWithErrors: 3, failed: 2, cancelled: 1, inProgress: 1 });
assert.deepEqual(stats.get('B'), { total: 7, completed: 5, completedWithErrors: 0, failed: 0, cancelled: 0, inProgress: 2 });
assert.equal(stats.get('C'), undefined);
assert.deepEqual(emptyRunStats(), { total: 0, completed: 0, completedWithErrors: 0, failed: 0, cancelled: 0, inProgress: 0 });
console.log('  ✓ run stats per status: COMPLETED / FAILED / CANCELLED / PENDING+RUNNING; page-error runs are a subset of completed');

// Admin side: KPI formulas.
function entry(
  name: string,
  opts: {
    enabled?: boolean;
    latestFound?: number | null;
    dbCount?: number;
    run?: Partial<ReturnType<typeof emptyRunStats>>;
    health?: { totalRuns: number; ok: number; failed: number };
  } = {},
): ScraperHealthEntry {
  return {
    id: name,
    portalName: name,
    status: 'HEALTHY',
    enabled: opts.enabled ?? true,
    cronExpression: null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    totalRuns: opts.health?.totalRuns ?? 0,
    totalSuccessRuns: opts.health?.ok ?? 0,
    totalFailedRuns: opts.health?.failed ?? 0,
    consecutiveFailures: 0,
    // The API fills this with the number of tenders in the database.
    totalTendersFound: opts.dbCount ?? 0,
    totalTendersNew: 0,
    avgDurationMs: 0,
    errorRate: 0,
    lastError: null,
    latestRun:
      opts.latestFound === null || opts.latestFound === undefined
        ? null
        : ({ totalFound: opts.latestFound, status: 'COMPLETED' } as ScraperHealthEntry['latestRun']),
    runStats: { ...emptyRunStats(), ...(opts.run ?? {}) },
    createdAt: '',
    updatedAt: '',
  };
}

// The WestBengal case: counters say 33/33 OK, the run history has 1 FAILED.
const westBengal = entry('WestBengal', {
  latestFound: 0,
  health: { totalRuns: 33, ok: 33, failed: 0 },
  run: { total: 34, completed: 33, failed: 1, completedWithErrors: 4 },
});
// A portal whose latest run found 0 but which has 39 tenders in the database.
const cppp = entry('CPPP', { latestFound: 0, dbCount: 39, run: { total: 39, completed: 39, completedWithErrors: 2 } });
const gem = entry('GeM', { latestFound: 100, dbCount: 2180, run: { total: 53, completed: 53 } });
const disabled = entry('Kerala', { enabled: false, latestFound: null, run: { total: 3, cancelled: 2, inProgress: 1 } });

const k = computeScraperKpis([westBengal, cppp, gem, disabled]);
assert.equal(k.tendersFoundLatest, 100, 'latest-run sum only: 0 + 0 + 100, no database-count fallback');
assert.notEqual(k.tendersFoundLatest, 100 + 39, 'the old fallback would have added CPPP database count');
assert.equal(k.enabled, 3, 'enabled portals');
assert.equal(k.portals, 4);
assert.equal(k.completedRuns, 125);
assert.equal(k.failedRuns, 1);
assert.equal(k.finishedRuns, 126, 'cancelled and in-progress runs are not finished outcomes');
assert.equal(k.cancelledRuns, 2);
assert.equal(k.inProgressRuns, 1);
assert.equal(k.completedWithErrors, 6, 'partial page errors reported separately');
assert.equal(k.successRate, 99.2, '125/126 rounded down to one decimal');
assert.ok(k.successRate! < 100, 'a FAILED run must lower the rate even when health counters say 100%');
// The live normal-environment case: 480 of 481 finished runs completed.
assert.equal(floorPercent(480, 481), 99.7, 'Math.round would have shown 100%');
assert.equal(floorPercent(481, 481), 100);
assert.equal(k.totalRuns, 34 + 39 + 53 + 3);
console.log(`  ✓ success rate ${k.successRate}% from run records (counters alone would claim 100%); latest-run tenders ${k.tendersFoundLatest}`);

// Nothing finished yet → no fake percentage.
const fresh = computeScraperKpis([entry('X', { run: { total: 2, inProgress: 2 } })]);
assert.equal(fresh.successRate, null);
assert.equal(computeScraperKpis([]).successRate, null);
// All failed → 0%, not hidden.
assert.equal(computeScraperKpis([entry('Y', { run: { total: 3, failed: 3 } })]).successRate, 0);
// Partial errors alone do not make a run a failure.
assert.equal(computeScraperKpis([entry('Z', { run: { total: 4, completed: 4, completedWithErrors: 4 } })]).successRate, 100);
console.log('  ✓ no finished runs → null (shown as —); all failed → 0%; page errors alone → still completed');

// Per-portal shares for the bar chart.
assert.deepEqual(portalSuccessShares(westBengal), { finished: 34, success: 97, failure: 3 });
assert.deepEqual(portalSuccessShares(entry('P', { run: { completed: 299, failed: 1 } })), { finished: 300, success: 99.6, failure: 0.4 });
assert.deepEqual(portalSuccessShares(disabled), { finished: 0, success: 0, failure: 0 });
console.log('  ✓ per-portal shares use finished runs from the run records');

console.log('--- Scraper KPI Tests passed ---');
