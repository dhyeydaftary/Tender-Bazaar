import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';

import { DEMO_PORTALS } from '../demo/demo-portals';
import { DemoRunner } from '../demo/demo-runner';
import { DemoRunStore, type DemoDb, DEMO_TRIGGERED_BY } from '../demo/demo-store';

/**
 * Demo scraper isolation.
 *
 * Proves three things the demo must never do:
 *   1. load scraping code (Playwright, HTTP clients, scraper classes) at all;
 *   2. open a network connection while simulating a run;
 *   3. touch any table other than ScrapingRun / ScraperHealth, or any portal
 *      that is not a `-Demo` portal.
 */

console.log('--- Starting Demo Scraper Isolation Tests ---');

const SRC = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Static runtime import graph of the demo entry point
// ---------------------------------------------------------------------------

/** Runtime imports only: `import type` and `export type` are erased by tsc. */
function runtimeSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const importRe = /^\s*import\s+(?!type\s)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  const bareImportRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [importRe, bareImportRe, requireRe, dynamicRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) specs.push(m[m.length - 1]);
  }
  return specs;
}

function resolveLocal(fromFile: string, spec: string): string {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${spec} from ${fromFile}`);
}

const visited = new Set<string>();
const packages = new Set<string>();
const queue = [join(SRC, 'demo', 'main.ts')];
while (queue.length > 0) {
  const file = queue.pop()!;
  if (visited.has(file)) continue;
  visited.add(file);
  for (const spec of runtimeSpecifiers(readFileSync(file, 'utf8'))) {
    if (spec.startsWith('.')) queue.push(resolveLocal(file, spec));
    else packages.add(spec);
  }
}

const localModules = [...visited].map((f) => relative(SRC, f).replace(/\\/g, '/')).sort();

const FORBIDDEN_LOCAL = [/^scrapers\//, /^scheduler\//, /^pipeline\//, /^index\.ts$/, /^main\.ts$/, /tender-index-publisher/];
for (const mod of localModules) {
  assert.ok(!FORBIDDEN_LOCAL.some((re) => re.test(mod)), `demo entry point must not load ${mod}`);
}

const FORBIDDEN_PACKAGES = [
  'playwright',
  'playwright-core',
  'axios',
  'cheerio',
  'bullmq',
  'ioredis',
  'p-queue',
  'http',
  'https',
  'node:http',
  'node:https',
  'undici',
];
for (const pkg of packages) {
  assert.ok(!FORBIDDEN_PACKAGES.includes(pkg), `demo entry point must not load package "${pkg}"`);
}
assert.ok(localModules.includes('demo/main.ts'));
console.log(`  ✓ runtime import graph (${localModules.length} modules) loads no scraper, browser or HTTP client code`);
console.log(`    packages: ${[...packages].sort().join(', ')}`);

// ---------------------------------------------------------------------------
// 2 & 3. Full simulated runs with the network trapped and a strict fake DB
// ---------------------------------------------------------------------------

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeStrictDb() {
  const runs = new Map<string, Row>();
  const health = new Map<string, Row>();
  const touched = new Set<string>();
  let nextId = 0;

  const db = {
    scrapingRun: {
      create: async ({ data }: Row) => {
        const id = `run-${++nextId}`;
        runs.set(id, { id, totalFound: 0, duplicates: 0, pagesScraped: 0, ...data });
        return { id };
      },
      update: async ({ where, data }: Row) => {
        const row = runs.get(where.id);
        assert.ok(row, `update of unknown run ${where.id}`);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        let count = 0;
        for (const row of runs.values()) {
          if (where.portalName.in.includes(row.portalName) && where.status.in.includes(row.status)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
      findUnique: async ({ where }: Row) => runs.get(where.id) ?? null,
    },
    scraperHealth: {
      upsert: async ({ where, create, update }: Row) => {
        const existing = health.get(where.portalName);
        if (existing) Object.assign(existing, update);
        else
          health.set(where.portalName, {
            totalRuns: 0,
            totalSuccessRuns: 0,
            totalFailedRuns: 0,
            totalTendersFound: 0,
            totalTendersNew: 0,
            avgDurationMs: 0,
            ...create,
          });
        return health.get(where.portalName);
      },
      findUnique: async ({ where }: Row) => health.get(where.portalName) ?? null,
      update: async ({ where, data }: Row) => {
        const row = health.get(where.portalName);
        assert.ok(row, `update of unknown health row ${where.portalName}`);
        Object.assign(row, data);
        return row;
      },
    },
    $queryRaw: async () => [{ '?column?': 1 }],
  };

  // Any model other than the two scraper tables is a test failure.
  const proxy = new Proxy(db, {
    get(target, prop: string) {
      touched.add(prop);
      if (!(prop in target)) throw new Error(`demo scraper accessed forbidden model "${prop}"`);
      return (target as Row)[prop];
    },
  });
  return { db: proxy as unknown as DemoDb, runs, health, touched };
}

async function main() {
  const attempts: string[] = [];
  const trap = (name: string) => () => {
    attempts.push(name);
    throw new Error(`network access attempted via ${name}`);
  };
  const originals = {
    fetch: globalThis.fetch,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
    connect: net.connect,
    createConnection: net.createConnection,
  };
  globalThis.fetch = trap('fetch') as typeof fetch;
  (http as Row).request = trap('http.request');
  (http as Row).get = trap('http.get');
  (https as Row).request = trap('https.request');
  (https as Row).get = trap('https.get');
  (net as Row).connect = trap('net.connect');
  (net as Row).createConnection = trap('net.createConnection');

  try {
    const { db, runs, health, touched } = makeStrictDb();
    const store = new DemoRunStore(db);
    for (const p of DEMO_PORTALS) await store.ensurePortal(p.name, null);

    const runner = new DemoRunner({
      store,
      portals: DEMO_PORTALS,
      concurrency: 2,
      startDelayMs: [0, 0],
      pageDelayMs: [0, 0],
      sleep: async () => undefined,
    });
    for (const p of DEMO_PORTALS) {
      assert.equal((await runner.trigger(p.key, 'manual')).status, 'queued');
    }
    await runner.whenIdle();

    assert.deepEqual(attempts, [], 'no network access during simulated runs');
    console.log(`  ✓ ${DEMO_PORTALS.length} simulated runs completed with fetch/http/https/net trapped`);

    assert.deepEqual([...touched].sort(), ['scraperHealth', 'scrapingRun']);
    console.log('  ✓ only ScrapingRun and ScraperHealth were accessed (no Tender, no other model)');

    for (const run of runs.values()) {
      assert.match(run.portalName, /-Demo$/);
      assert.equal(run.triggeredBy, DEMO_TRIGGERED_BY);
      assert.equal(run.metadata.simulated, true);
      assert.equal(run.metadata.generator, 'demo-scraper');
      assert.equal(run.status, 'COMPLETED');
      assert.equal(run.newTenders, 0);
      assert.ok(run.totalFound > 0 && run.pagesScraped > 0 && run.duration >= 0);
    }
    for (const [name, row] of health) {
      assert.match(name, /-Demo$/);
      assert.equal(row.totalRuns, 1);
      assert.equal(row.totalSuccessRuns, 1);
      assert.equal(row.totalTendersNew, 0);
      assert.equal(row.status, 'HEALTHY');
    }
    console.log('  ✓ every run is marked simulated (triggeredBy "demo", metadata.simulated) on -Demo portals');

    // Restart recovery only closes demo runs.
    runs.set('real-1', { id: 'real-1', portalName: 'GeM', triggeredBy: 'schedule', status: 'RUNNING' });
    runs.set('demo-open', { id: 'demo-open', portalName: 'GeM-Demo', triggeredBy: 'demo', status: 'RUNNING' });
    const recovered = await store.recoverInterruptedRuns(DEMO_PORTALS.map((p) => p.name));
    assert.equal(recovered, 1);
    assert.equal(runs.get('real-1')!.status, 'RUNNING', 'a real run is never touched');
    assert.equal(runs.get('demo-open')!.status, 'CANCELLED');
    console.log('  ✓ restart recovery closes only interrupted demo runs');

    // The store refuses real portal names outright.
    for (const realName of ['GeM', 'CPPP', 'Maharashtra', 'Demo', '-Demo']) {
      await assert.rejects(store.createRun(realName, 'manual', 1), /demo portals must end in "-Demo"/);
      await assert.rejects(store.ensurePortal(realName, null), /demo portals must end in "-Demo"/);
      await assert.rejects(store.completeRun('run-1', realName, {} as never), /demo portals must end in "-Demo"/);
      await assert.rejects(store.failRun('run-1', realName, 'x', {} as never), /demo portals must end in "-Demo"/);
    }
    await assert.rejects(store.recoverInterruptedRuns(['GeM-Demo', 'GeM']), /must end in "-Demo"/);
    console.log('  ✓ the store refuses to write for any non-demo portal name');

    // Simulated failures and page errors stay inside the same two tables, offline.
    {
      const iso = makeStrictDb();
      const isoStore = new DemoRunStore(iso.db);
      for (const p of DEMO_PORTALS) await isoStore.ensurePortal(p.name, null);
      const failing = new DemoRunner({
        store: isoStore,
        portals: DEMO_PORTALS,
        concurrency: 2,
        startDelayMs: [0, 0],
        pageDelayMs: [0, 0],
        sleep: async () => undefined,
        failureEvery: 2,
        pageErrorsEvery: 1,
      });
      // Two rounds per portal: run 1 has page errors, run 2 fails.
      for (let round = 0; round < 2; round++) {
        for (const p of DEMO_PORTALS) await failing.trigger(p.key, 'manual');
        await failing.whenIdle();
      }
      assert.deepEqual(attempts, [], 'no network access during simulated failures');
      assert.deepEqual([...iso.touched].sort(), ['scraperHealth', 'scrapingRun']);
      const runs = [...iso.runs.values()];
      assert.equal(runs.filter((r) => r.status === 'FAILED').length, DEMO_PORTALS.length);
      assert.equal(runs.filter((r) => r.status === 'COMPLETED' && r.errors > 0).length, DEMO_PORTALS.length);
      for (const r of runs) {
        assert.match(r.portalName, /-Demo$/);
        assert.equal(r.metadata.simulated, true);
        assert.match(r.errorMessage, /^\[Simulated\] /, 'every failure and page-error note is labelled');
        assert.equal(r.newTenders, 0);
      }
      for (const [, h] of iso.health) {
        assert.equal(h.totalRuns, 2);
        assert.equal(h.totalSuccessRuns, 1);
        assert.equal(h.totalFailedRuns, 1);
        assert.equal(h.consecutiveFailures, 1);
        assert.equal(h.status, 'DEGRADED');
        assert.match(h.lastError, /^\[Simulated\] /);
      }
      console.log('  ✓ simulated failures/page errors: only -Demo scraper rows, [Simulated] labels, health DEGRADED, no network');
    }
  } finally {
    globalThis.fetch = originals.fetch;
    (http as Row).request = originals.httpRequest;
    (http as Row).get = originals.httpGet;
    (https as Row).request = originals.httpsRequest;
    (https as Row).get = originals.httpsGet;
    (net as Row).connect = originals.connect;
    (net as Row).createConnection = originals.createConnection;
  }

  console.log('--- Demo Scraper Isolation Tests passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
