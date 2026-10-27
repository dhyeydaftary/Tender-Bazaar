import assert from 'node:assert/strict';

import { DEMO_PORTALS } from '../demo/demo-portals';
import {
  DemoRunner,
  MAX_DEMO_CONCURRENCY,
  planRun,
  type DemoRunStoreLike,
} from '../demo/demo-runner';
import type { RunProgress, RunTotals } from '../demo/demo-store';

/**
 * Demo scraper run lifecycle.
 *
 * The admin dashboard polls PostgreSQL every 3 s after "Run now" and stops on
 * COMPLETED/FAILED/CANCELLED, so the simulation must persist PENDING, then
 * RUNNING, then monotonically increasing counters, then COMPLETED — and it must
 * never claim tenders it did not write.
 */

console.log('--- Starting Demo Scraper Runner Tests ---');

type Event =
  | { type: 'create'; portal: string; runId: string; maxPages: number; trigger: string }
  | { type: 'start'; runId: string }
  | { type: 'progress'; runId: string; progress: RunProgress }
  | { type: 'complete'; runId: string; portal: string; totals: RunTotals; note?: string | null }
  | { type: 'fail'; runId: string; portal: string; message: string; progress: RunProgress }
  | { type: 'cancel'; runId: string; reason: string };

function makeStore(disabled: string[] = []) {
  const events: Event[] = [];
  let next = 0;
  const store: DemoRunStoreLike = {
    isPortalEnabled: async (portalName) => !disabled.includes(portalName),
    createRun: async (portal, trigger, maxPages) => {
      const runId = `run-${++next}`;
      events.push({ type: 'create', portal, runId, maxPages, trigger });
      return runId;
    },
    startRun: async (runId) => void events.push({ type: 'start', runId }),
    recordProgress: async (runId, progress) => void events.push({ type: 'progress', runId, progress }),
    completeRun: async (runId, portal, totals, note) => void events.push({ type: 'complete', runId, portal, totals, note }),
    failRun: async (runId, portal, message, progress) => void events.push({ type: 'fail', runId, portal, message, progress }),
    cancelRun: async (runId, reason) => void events.push({ type: 'cancel', runId, reason }),
  };
  return { store, events };
}

function makeRunner(store: DemoRunStoreLike, opts: { concurrency?: number; sleep?: (ms: number) => Promise<void> } = {}) {
  const sleeps: number[] = [];
  const runner = new DemoRunner({
    store,
    portals: DEMO_PORTALS,
    concurrency: opts.concurrency ?? 2,
    startDelayMs: [1500, 4000],
    pageDelayMs: [1800, 4200],
    random: () => 0.5,
    sleep:
      opts.sleep ??
      (async (ms) => {
        sleeps.push(ms);
      }),
  });
  return { runner, sleeps };
}

const gem = DEMO_PORTALS.find((p) => p.name === 'GeM-Demo')!;

async function main() {
  // 1. Lifecycle: PENDING (create) → RUNNING (start) → progress per page → COMPLETED.
  {
    const { store, events } = makeStore();
    const { runner, sleeps } = makeRunner(store);
    const result = await runner.trigger(gem.key, 'manual');
    assert.equal(result.status, 'queued');
    await runner.whenIdle();

    const types = events.map((e) => e.type);
    assert.equal(types[0], 'create');
    assert.equal(types[1], 'start');
    assert.equal(types[types.length - 1], 'complete');
    const create = events[0] as Extract<Event, { type: 'create' }>;
    assert.equal(create.portal, 'GeM-Demo');
    assert.equal(create.trigger, 'manual');
    assert.ok(create.maxPages >= gem.pages[0] && create.maxPages <= gem.pages[1]);

    const progress = events.filter((e): e is Extract<Event, { type: 'progress' }> => e.type === 'progress');
    assert.equal(progress.length, create.maxPages, 'one progress write per simulated page');
    for (let i = 1; i < progress.length; i++) {
      assert.equal(progress[i].progress.pagesScraped, i + 1);
      assert.ok(progress[i].progress.totalFound > progress[i - 1].progress.totalFound, 'counters only grow');
    }

    const complete = events[events.length - 1] as Extract<Event, { type: 'complete' }>;
    const last = progress[progress.length - 1].progress;
    assert.equal(complete.totals.totalFound, last.totalFound);
    assert.equal(complete.totals.pagesScraped, create.maxPages);
    assert.equal(complete.totals.newTenders, 0, 'a simulation must not claim new tenders');
    assert.equal(complete.totals.updatedTenders, 0, 'a simulation must not claim updated tenders');
    assert.equal(complete.totals.duplicates, complete.totals.totalFound);
    assert.equal(complete.totals.errors, 0);

    // Human-paced: one start delay plus one delay per page, all inside the configured ranges.
    assert.equal(sleeps.length, create.maxPages + 1);
    assert.ok(sleeps[0] >= 1500 && sleeps[0] <= 4000);
    assert.ok(sleeps.slice(1).every((ms) => ms >= 1800 && ms <= 4200));
    assert.equal(runner.activeRunCount, 0);
    assert.equal(runner.completedRunCount, 1);
    console.log('  ✓ lifecycle PENDING → RUNNING → progress → COMPLETED, no tenders claimed');
  }

  // 2. Per-portal lock mirrors the real engine's 409.
  {
    const { store } = makeStore();
    const { runner } = makeRunner(store);
    const first = await runner.trigger(gem.key, 'manual');
    const second = await runner.trigger(gem.key, 'manual');
    assert.equal(first.status, 'queued');
    assert.equal(second.status, 'already-running');
    if (first.status === 'queued' && second.status === 'already-running') {
      assert.equal(second.runId, first.runId);
    }
    await runner.whenIdle();
    const third = await runner.trigger(gem.key, 'manual');
    assert.equal(third.status, 'queued', 'the lock is released once the run ends');
    await runner.whenIdle();
    console.log('  ✓ a second run for the same portal is refused while one is active');
  }

  // 3. Real portal keys are unknown to the demo scraper.
  {
    const { store, events } = makeStore();
    const { runner } = makeRunner(store);
    for (const key of ['gem', 'cppp', 'maharashtra', 'testportal', '']) {
      assert.equal((await runner.trigger(key, 'manual')).status, 'unknown-portal');
    }
    assert.equal(events.length, 0, 'nothing is written for an unknown portal');
    console.log('  ✓ real portal keys are rejected without any write');
  }

  // 4. Concurrency: extra runs wait as PENDING until a slot frees.
  {
    const { store, events } = makeStore();
    const gates: Array<() => void> = [];
    const { runner } = makeRunner(store, {
      concurrency: 1,
      sleep: () => new Promise<void>((resolve) => gates.push(resolve)),
    });
    await runner.trigger(DEMO_PORTALS[0].key, 'manual');
    await runner.trigger(DEMO_PORTALS[1].key, 'manual');
    await new Promise((r) => setImmediate(r));
    assert.equal(events.filter((e) => e.type === 'create').length, 2, 'both runs exist as PENDING');
    assert.equal(gates.length, 1, 'only one simulation holds a slot');
    // Drain: release every sleep until both complete.
    while (events.filter((e) => e.type === 'complete').length < 2) {
      gates.shift()?.();
      await new Promise((r) => setImmediate(r));
    }
    const firstComplete = events.findIndex((e) => e.type === 'complete');
    const secondStart = events.findIndex((e, i) => e.type === 'start' && i > 1 && (e as { runId: string }).runId === 'run-2');
    assert.ok(secondStart > firstComplete, 'second run starts only after the first completes');
    await runner.whenIdle();
    console.log('  ✓ concurrency limit queues extra runs as PENDING');
  }

  // 5. Scheduled runs skip a portal an administrator disabled; manual runs do not.
  {
    const { store, events } = makeStore(['GeM-Demo']);
    const { runner } = makeRunner(store);
    assert.equal((await runner.trigger(gem.key, 'schedule')).status, 'disabled');
    assert.equal(events.length, 0);
    assert.equal(runner.activeRunCount, 0, 'the lock is released after a skip');
    assert.equal((await runner.trigger(gem.key, 'manual')).status, 'queued');
    await runner.whenIdle();
    console.log('  ✓ scheduled runs respect the enabled flag');
  }

  // 6. stop() cancels in-flight runs with an honest reason and refuses new ones.
  {
    const { store, events } = makeStore();
    const gates: Array<() => void> = [];
    const { runner } = makeRunner(store, {
      sleep: () => new Promise<void>((resolve) => gates.push(resolve)),
    });
    await runner.trigger(gem.key, 'manual');
    await new Promise((r) => setImmediate(r));
    const stopping = runner.stop();
    gates.splice(0).forEach((release) => release());
    await stopping;
    const cancel = events.find((e) => e.type === 'cancel') as Extract<Event, { type: 'cancel' }> | undefined;
    assert.ok(cancel, 'the active run is cancelled');
    assert.match(cancel!.reason, /Simulated run cancelled/);
    assert.equal(events.some((e) => e.type === 'complete'), false);
    assert.equal((await runner.trigger(gem.key, 'manual')).status, 'stopping');
    console.log('  ✓ shutdown cancels simulated runs instead of leaving them RUNNING');
  }

  // 7. A store failure mid-run ends the run as CANCELLED and releases the lock.
  {
    const { store, events } = makeStore();
    let calls = 0;
    store.recordProgress = async () => {
      if (++calls === 2) throw new Error('db blip');
    };
    const errors: string[] = [];
    const runner = new DemoRunner({
      store,
      portals: DEMO_PORTALS,
      concurrency: 1,
      startDelayMs: [0, 0],
      pageDelayMs: [0, 0],
      sleep: async () => undefined,
      onError: (portal) => errors.push(portal),
    });
    await runner.trigger(gem.key, 'manual');
    await runner.whenIdle();
    assert.deepEqual(errors, ['GeM-Demo']);
    assert.ok(events.some((e) => e.type === 'cancel'));
    assert.equal(runner.activeRunCount, 0);
    console.log('  ✓ internal errors cancel the run and release the portal lock');
  }

  // 8. Deterministic simulation plan: every 6th run fails, every 3rd (non-failing) has page errors.
  {
    const plans = Array.from({ length: 12 }, (_, i) => planRun(i + 1, 10, 6, 3));
    const failing = plans.map((p, i) => (p.failAtPage ? i + 1 : 0)).filter(Boolean);
    const withErrors = plans.map((p, i) => (p.errorPages.length ? i + 1 : 0)).filter(Boolean);
    assert.deepEqual(failing, [6, 12]);
    assert.deepEqual(withErrors, [3, 9], 'runs 6 and 12 fail instead of erroring');
    assert.equal(plans[5].failAtPage, 5, 'fails halfway through a 10-page run');
    assert.deepEqual(plans[2].errorPages, [2, 9], 'run 3 → 2 error pages');
    assert.deepEqual(plans[8].errorPages, [2, 9].slice(0, 1 + (9 % 2)));
    assert.deepEqual(planRun(6, 10, 0, 0), { failAtPage: null, errorPages: [] }, '0 disables both');
    assert.deepEqual(planRun(3, 10, 0, 3).errorPages.length > 0, true);
    assert.deepEqual(planRun(6, 10, 6, 0).failAtPage, 5);
    assert.deepEqual(planRun(3, 1, 6, 3), { failAtPage: null, errorPages: [] }, 'a 1-page run has no page to skip');
    console.log('  ✓ simulation plan is deterministic; 0 disables failures/page errors');
  }

  // 9. A simulated failure ends FAILED with a [Simulated] message, partial progress, released lock.
  {
    const { store, events } = makeStore();
    const runner = new DemoRunner({
      store, portals: DEMO_PORTALS, concurrency: 2, startDelayMs: [0, 0], pageDelayMs: [0, 0],
      random: () => 0.5, sleep: async () => undefined, failureEvery: 1,
    });
    await runner.trigger(gem.key, 'manual');
    await runner.whenIdle();
    const fail = events.find((e) => e.type === 'fail') as Extract<Event, { type: 'fail' }>;
    assert.ok(fail, 'run failed');
    assert.match(fail.message, /^\[Simulated\] Portal responded with HTTP 503/);
    assert.match(fail.message, /no external portal was contacted/);
    assert.ok(fail.progress.pagesScraped > 0 && fail.progress.pagesScraped < 11, 'partial progress recorded');
    assert.equal(events.some((e) => e.type === 'complete'), false);
    assert.equal(runner.activeRunCount, 0, 'lock released after a failure');
    assert.equal(runner.failedRunCount, 1);
    assert.equal((await runner.trigger(gem.key, 'manual')).status, 'queued', 'portal can run again');
    await runner.whenIdle();
    console.log('  ✓ simulated failure → FAILED with [Simulated] message, partial counts, lock released');
  }

  // 10. Page errors: run completes, errors counted, skipped pages add nothing, note is [Simulated].
  {
    const { store, events } = makeStore();
    const runner = new DemoRunner({
      store, portals: DEMO_PORTALS, concurrency: 2, startDelayMs: [0, 0], pageDelayMs: [0, 0],
      random: () => 0.5, sleep: async () => undefined, pageErrorsEvery: 1,
    });
    await runner.trigger(gem.key, 'manual'); // run 1 → 1 + (1 % 2) = 2 error pages
    await runner.whenIdle();
    const create = events.find((e) => e.type === 'create') as Extract<Event, { type: 'create' }>;
    const done = events.find((e) => e.type === 'complete') as Extract<Event, { type: 'complete' }>;
    assert.ok(done, 'run completed despite page errors');
    assert.equal(done.totals.errors, 2);
    assert.equal(done.totals.pagesScraped, create.maxPages - 2, 'skipped pages are not counted as scraped');
    assert.equal(done.totals.duplicates, done.totals.totalFound);
    assert.equal(done.totals.newTenders, 0);
    assert.match(done.note ?? '', /^\[Simulated\] 2 listing pages timed out/);
    const progress = events.filter((e): e is Extract<Event, { type: 'progress' }> => e.type === 'progress');
    assert.equal(progress.length, create.maxPages, 'progress persisted for every page, including errors');
    assert.equal(progress[progress.length - 1].progress.errors, 2);
    console.log('  ✓ page errors → COMPLETED with errors counted, [Simulated] note, accurate page counts');
  }

  // 11. Concurrency is capped at MAX_DEMO_CONCURRENCY even if configured higher.
  {
    const { store } = makeStore();
    const gates: Array<() => void> = [];
    const runner = new DemoRunner({
      store, portals: DEMO_PORTALS, concurrency: 10, startDelayMs: [0, 0], pageDelayMs: [0, 0],
      random: () => 0.5, sleep: () => new Promise<void>((resolve) => gates.push(resolve)),
    });
    for (const p of DEMO_PORTALS) await runner.trigger(p.key, 'manual');
    await new Promise((r) => setImmediate(r));
    assert.equal(MAX_DEMO_CONCURRENCY, 2);
    assert.equal(gates.length, MAX_DEMO_CONCURRENCY, 'only 2 simulations hold a slot');
    const stopping = runner.stop();
    while (gates.length) {
      gates.splice(0).forEach((g) => g());
      await new Promise((r) => setImmediate(r));
    }
    await stopping;
    console.log('  ✓ at most 2 simulated runs execute at once, even with DEMO_CONCURRENCY=10');
  }

  // 12. A store error during a simulated failure cancels the run instead of leaving it stuck.
  {
    const { store, events } = makeStore();
    store.failRun = async () => {
      throw new Error('db blip');
    };
    const runner = new DemoRunner({
      store, portals: DEMO_PORTALS, concurrency: 1, startDelayMs: [0, 0], pageDelayMs: [0, 0],
      random: () => 0.5, sleep: async () => undefined, failureEvery: 1, onError: () => undefined,
    });
    await runner.trigger(gem.key, 'manual');
    await runner.whenIdle();
    assert.ok(events.some((e) => e.type === 'cancel'), 'run ends CANCELLED, never stuck RUNNING');
    assert.equal(runner.activeRunCount, 0);
    console.log('  ✓ an error while recording a simulated failure still ends the run');
  }

  console.log('--- Demo Scraper Runner Tests passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
