import assert from 'node:assert/strict';

import { StorageWriter } from '../storage/writer';

/**
 * ScraperHealth counters stay consistent with the run history.
 *
 * Regressions:
 *   1. recoverStaleRuns() marked interrupted runs FAILED with updateMany but
 *      never recorded the failure in ScraperHealth, so a portal with a failed
 *      run still reported HEALTHY with a 100% success tally (seen live:
 *      WestBengal had 34 runs incl. 1 FAILED, counters said 33/33/0).
 *   2. updateHealthOnSuccess/updateHealthOnFailure created a missing health
 *      row and returned without counting the run.
 *
 * Uses an in-memory Prisma stand-in; no database.
 */

console.log('--- Starting Health Counter Tests ---');

type Run = { id: string; portalName: string; status: string; startedAt: Date | null; createdAt: Date; errorMessage?: string | null };
type Health = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function fakePrisma(runs: Run[], health: Map<string, Health>) {
  const matchesRun = (r: Run, where: any): boolean => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (where.id?.in && !where.id.in.includes(r.id)) return false;
    if (where.status && r.status !== where.status) return false;
    if (where.errorMessage && r.errorMessage !== where.errorMessage) return false;
    if (where.OR) {
      return where.OR.some((c: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        c.startedAt?.lt
          ? r.startedAt !== null && r.startedAt < c.startedAt.lt
          : r.startedAt === null && r.createdAt < c.createdAt.lt,
      );
    }
    return true;
  };
  const blank = (portalName: string) => ({
    portalName, status: 'HEALTHY', totalRuns: 0, totalSuccessRuns: 0, totalFailedRuns: 0,
    consecutiveFailures: 0, totalTendersFound: 0, totalTendersNew: 0, avgDurationMs: 0, errorRate: 0,
  });
  return {
    scrapingRun: {
      findMany: async ({ where }: any) => runs.filter((r) => matchesRun(r, where)).map((r) => ({ ...r })), // eslint-disable-line @typescript-eslint/no-explicit-any
      updateMany: async ({ where, data }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const hit = runs.filter((r) => matchesRun(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      findUnique: async ({ where }: any) => runs.find((r) => r.id === where.id) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      update: async ({ where, data }: any) => Object.assign(runs.find((r) => r.id === where.id)!, data), // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    scraperHealth: {
      findUnique: async ({ where }: any) => health.get(where.portalName) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      findUniqueOrThrow: async ({ where }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const h = health.get(where.portalName);
        if (!h) throw new Error('not found');
        return h;
      },
      upsert: async ({ where, create }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!health.has(where.portalName)) health.set(where.portalName, { ...blank(where.portalName), ...create });
        return health.get(where.portalName);
      },
      update: async ({ where, data }: any) => Object.assign(health.get(where.portalName)!, data), // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  };
}

async function main() {
  const old = new Date(Date.now() - 60 * 60 * 1000);
  const recent = new Date();

  // 1. Stale recovery counts failures in health, only for the runs it recovered.
  {
    const runs: Run[] = [
      { id: 'stale-1', portalName: 'WestBengal', status: 'RUNNING', startedAt: old, createdAt: old },
      { id: 'stale-2', portalName: 'WestBengal', status: 'RUNNING', startedAt: null, createdAt: old },
      { id: 'live', portalName: 'WestBengal', status: 'RUNNING', startedAt: recent, createdAt: recent },
      { id: 'done', portalName: 'Delhi', status: 'COMPLETED', startedAt: old, createdAt: old },
    ];
    const health = new Map<string, Health>([
      ['WestBengal', { portalName: 'WestBengal', status: 'HEALTHY', totalRuns: 33, totalSuccessRuns: 33, totalFailedRuns: 0, consecutiveFailures: 0, errorRate: 0 }],
      ['Delhi', { portalName: 'Delhi', status: 'HEALTHY', totalRuns: 5, totalSuccessRuns: 5, totalFailedRuns: 0, consecutiveFailures: 0, errorRate: 0 }],
    ]);
    const writer = new StorageWriter(fakePrisma(runs, health) as never);

    const recovered = await writer.recoverStaleRuns(15);
    assert.equal(recovered, 2);
    assert.deepEqual(runs.map((r) => r.status), ['FAILED', 'FAILED', 'RUNNING', 'COMPLETED']);
    const wb = health.get('WestBengal')!;
    assert.equal(wb.totalRuns, 35, 'both recovered runs counted');
    assert.equal(wb.totalFailedRuns, 2);
    assert.equal(wb.totalSuccessRuns, 33);
    assert.equal(wb.consecutiveFailures, 2);
    assert.equal(wb.status, 'DEGRADED', 'a portal with failed runs is no longer HEALTHY');
    assert.match(wb.lastError, /Run interrupted/);
    assert.equal(health.get('Delhi')!.totalRuns, 5, 'other portals untouched');

    assert.equal(await writer.recoverStaleRuns(15), 0, 'nothing to recover the second time');
    assert.equal(health.get('WestBengal')!.totalRuns, 35, 'no double counting on a repeat sweep');
    console.log('  ✓ recovered runs are counted as failures in ScraperHealth (exactly once)');
  }

  // 2. A run on a portal without a health row is counted, not dropped.
  {
    const runs: Run[] = [
      { id: 'r1', portalName: 'NewPortal', status: 'RUNNING', startedAt: recent, createdAt: recent },
      { id: 'r2', portalName: 'OtherNew', status: 'RUNNING', startedAt: recent, createdAt: recent },
    ];
    const health = new Map<string, Health>();
    const writer = new StorageWriter(fakePrisma(runs, health) as never);
    await writer.completeRun('r1', { totalFound: 12, newTenders: 3, updatedTenders: 0, duplicates: 9, errors: 0, pagesScraped: 2 });
    await writer.failRun('r2', new Error('boom'));
    assert.equal(health.get('NewPortal')!.totalRuns, 1, 'first successful run counted');
    assert.equal(health.get('NewPortal')!.totalSuccessRuns, 1);
    assert.equal(health.get('NewPortal')!.totalTendersFound, 12);
    assert.equal(health.get('OtherNew')!.totalRuns, 1, 'first failed run counted');
    assert.equal(health.get('OtherNew')!.totalFailedRuns, 1);
    console.log('  ✓ the first run on a portal without a health row is counted');
  }

  console.log('--- Health Counter Tests passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
