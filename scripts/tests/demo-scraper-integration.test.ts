/**
 * End-to-end: api-server's engine client against the real demo scraper API.
 *
 * Lives outside both packages because it imports source from each (their
 * tsconfig rootDirs would reject a cross-package import). Run with:
 *
 *   npx tsx scripts/tests/demo-scraper-integration.test.ts
 *
 * Uses an in-memory store with the strict two-table surface, so no database or
 * network beyond 127.0.0.1 is involved.
 */

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { DEMO_PORTALS } from '../../packages/scraper-engine/src/demo/demo-portals';
import { DemoRunner } from '../../packages/scraper-engine/src/demo/demo-runner';
import { DemoRunStore, type DemoDb } from '../../packages/scraper-engine/src/demo/demo-store';
import { createDemoApi } from '../../packages/scraper-engine/src/demo/demo-server';
import {
  fetchEngineStatus,
  requestEngineRun,
} from '../../packages/api-server/src/modules/admin/services/scraper-engine-client';

console.log('--- Starting Demo Scraper Integration Test ---');

const TOKEN = 'integration-demo-token-0123456789';

/* eslint-disable @typescript-eslint/no-explicit-any */
function memoryDb() {
  const runs = new Map<string, any>();
  const health = new Map<string, any>();
  let id = 0;
  const db: DemoDb = {
    scrapingRun: {
      create: async ({ data }: any) => {
        const row = { id: `run-${++id}`, createdAt: new Date(), ...data };
        runs.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(runs.get(where.id), data),
      updateMany: async () => ({ count: 0 }),
      findUnique: async ({ where }: any) => runs.get(where.id) ?? null,
    },
    scraperHealth: {
      upsert: async ({ where, create, update }: any) => {
        const row = health.get(where.portalName);
        if (row) return Object.assign(row, update);
        const created = {
          totalRuns: 0, totalSuccessRuns: 0, totalFailedRuns: 0,
          totalTendersFound: 0, totalTendersNew: 0, avgDurationMs: 0, ...create,
        };
        health.set(where.portalName, created);
        return created;
      },
      findUnique: async ({ where }: any) => health.get(where.portalName) ?? null,
      update: async ({ where, data }: any) => Object.assign(health.get(where.portalName), data),
    },
    $queryRaw: async () => [1],
  };
  return { db, runs, health };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function main() {
  const { db, runs, health } = memoryDb();
  const store = new DemoRunStore(db);
  for (const p of DEMO_PORTALS) await store.ensurePortal(p.name, null);

  // Observe every status the dashboard could see while polling.
  const seen: string[] = [];
  const runner = new DemoRunner({
    store,
    portals: DEMO_PORTALS,
    concurrency: 2,
    startDelayMs: [5, 10],
    pageDelayMs: [5, 10],
    sleep: async (ms) => {
      for (const r of runs.values()) seen.push(`${r.status}:${r.pagesScraped ?? 0}`);
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
  });

  const app = createDemoApi({ runner, ping: () => store.ping(), authToken: TOKEN, scheduleEnabled: false });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const status = await fetchEngineStatus({ baseUrl: base });
    assert.equal(status.reachable, true);
    assert.equal(status.mode, 'demo');
    assert.equal(status.simulated, true);
    console.log('  ✓ api-server engine status reports the demo engine as mode=demo, simulated');

    // api-server derives the key with portalName.toLowerCase().
    const portalName = 'GeM-Demo';
    const outcome = await requestEngineRun({ baseUrls: [base], registryKey: portalName.toLowerCase(), token: TOKEN });
    assert.equal(outcome.kind, 'triggered');
    assert.ok(outcome.kind === 'triggered' && outcome.simulated && outcome.jobId);

    const refused = await requestEngineRun({ baseUrls: [base], registryKey: 'gem-demo', token: TOKEN });
    assert.equal(refused.kind, 'refused');

    const badToken = await requestEngineRun({ baseUrls: [base], registryKey: 'cppp-demo', token: 'wrong-token-value-000' });
    assert.equal(badToken.kind, 'unauthorized');

    const realKey = await requestEngineRun({ baseUrls: [base], registryKey: 'gem', token: TOKEN });
    assert.equal(realKey.kind, 'unreachable', 'the demo engine does not serve real portals');
    console.log('  ✓ trigger → triggered(simulated) | 409 refused | 401 unauthorized | real key not served');

    await runner.whenIdle();
    const run = runs.get(outcome.kind === 'triggered' ? outcome.jobId! : '')!;
    assert.equal(run.status, 'COMPLETED');
    assert.equal(run.triggeredBy, 'demo');
    assert.equal(run.metadata.simulated, true);
    assert.equal(run.newTenders, 0);
    assert.ok(run.pagesScraped > 0 && run.totalFound > 0);
    assert.ok(seen.some((s) => s.startsWith('PENDING')), 'PENDING was observable');
    assert.ok(seen.some((s) => s.startsWith('RUNNING:') && s !== 'RUNNING:0'), 'progress was observable while RUNNING');
    assert.equal(health.get('GeM-Demo').totalRuns, 1);
    console.log(`  ✓ persisted lifecycle observed: PENDING → RUNNING (progress) → COMPLETED, ${run.pagesScraped} pages`);
  } finally {
    server.close();
  }
  console.log('--- Demo Scraper Integration Test passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
