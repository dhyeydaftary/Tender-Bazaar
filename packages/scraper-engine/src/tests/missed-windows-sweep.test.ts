import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

import { ScrapingScheduler, type ScraperJobResult } from '../scheduler/scheduler';
import { PORTAL_CONFIGS } from '../config';

/**
 * Scheduler-side integration for the missed-window sweep.
 *
 * missed-windows.test.ts pins the detection POLICY with no infrastructure.
 * This suite pins the parts that only exist in the scheduler: that a catch-up
 * respects the administrator pause and the per-portal enable flag, goes through
 * the per-portal lock (so it cannot duplicate or overlap a normal firing), and
 * carries `catchup` trigger metadata.
 *
 * Requires a REAL Redis (BullMQ has no in-memory mode). SKIPS when unreachable.
 *   TEST_REDIS_URL=redis://127.0.0.1:56379
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379';
const QUEUE_NAME = `test-missed-sweep-${process.pid}`;
/** 'gem' is registry key for display name 'GeM', on a 2-hourly cadence. */
const PORTAL_KEY = 'gem';
const PORTAL_NAME = 'GeM';

console.log('--- Starting Missed-Window Sweep Tests ---');

async function waitFor(
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${label}`);
}

async function redisReachable(): Promise<boolean> {
  const probe = new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function main(): Promise<void> {
  if (!(await redisReachable())) {
    console.log(`! SKIPPED: no Redis at ${TEST_REDIS_URL}`);
    console.log('--- Missed-Window Sweep Tests SKIPPED ---');
    return;
  }

  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 3 });
  const inspectConnection = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  const inspect = new Queue<{ triggeredBy?: string }, ScraperJobResult>(QUEUE_NAME, {
    connection: inspectConnection,
  });

  async function reset(): Promise<void> {
    for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
    await redis.del('tb:scheduler:schedules').catch(() => {});
    // Delete the queue's keys directly rather than calling obliterate(): a
    // previous block's worker may still be detaching, and obliterate() against
    // a live worker throws "Connection is closed." mid-suite.
    for (const key of await redis.keys(`bull:${QUEUE_NAME}:*`)) await redis.del(key);
  }

  /**
   * A scheduler whose only enabled portal is GeM, with a controllable
   * last-run time and pause/enable state.
   */
  function build(opts: { lastRunAt: Date | null; enabled?: boolean; gated?: boolean }) {
    const state = {
      lastRunAt: opts.lastRunAt,
      enabled: opts.enabled ?? true,
      paused: false,
    };
    const executed: Array<{ portal: string; triggeredBy?: string }> = [];

    // When gated, the handler blocks until release() is called, so a run can be
    // held genuinely in flight. Without this the handler returns instantly, the
    // per-portal lock is released before the sweep runs, and the "no duplicate
    // while in flight" assertion tests nothing.
    let release = () => {};
    const gateOpened = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = 0;

    const scheduler = new ScrapingScheduler(redis, {
      queueName: QUEUE_NAME,
      // Drive the sweep by hand so the assertions are deterministic.
      missedWindowSweepMs: 0,
      reconcileIntervalMs: 0,
      maxCatchUpPerSweep: 1,
      missedWindowGraceMs: 1000,
      scheduleSource: {
        async getScheduleOverrides() {
          // Every other portal is disabled, so exactly one portal is under test
          // and each scheduler registers one cron instead of thirteen.
          return PORTAL_CONFIGS.map((portal) => ({
            portalName: portal.name,
            enabled: portal.name === PORTAL_NAME ? state.enabled : false,
            cronExpression: null,
          }));
        },
        async getPortalLastRuns() {
          return [{ portalName: PORTAL_NAME, lastRunAt: state.lastRunAt }];
        },
        async getSchedulerPaused() {
          return state.paused;
        },
        async setSchedulerPaused(value: boolean) {
          state.paused = value;
        },
      },
    });

    scheduler.registerScrapeHandler(
      async (portalName, _maxPages, _full, triggeredBy): Promise<ScraperJobResult> => {
        entered++;
        executed.push({ portal: portalName, triggeredBy });
        if (opts.gated) await gateOpened;
        return {
          portalName,
          tendersFound: 1,
          tendersNew: 0,
          tendersDuplicate: 1,
          tendersFailed: 0,
          duration: 1,
          errors: [],
        };
      },
    );

    return {
      scheduler,
      state,
      executed,
      release: () => release(),
      enteredCount: () => entered,
    };
  }

  /** GeM's registry cadence is '0 *​/2 * * *', so windows land on even hours. */
  const LONG_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);

  // ── 1. A missed window enqueues exactly one catch-up, tagged `catchup` ──
  {
    await reset();
    const { scheduler, executed } = build({ lastRunAt: LONG_AGO });
    await scheduler.start();

    const result = await scheduler.sweepMissedWindows();
    assert.equal(result.checked >= 1, true, 'the enabled portal must be checked');
    assert.equal(result.caughtUp, 1, 'exactly one catch-up must be enqueued');

    await waitFor('the catch-up to execute', async () => executed.length >= 1);

    assert.equal(executed[0]!.portal, PORTAL_KEY);
    assert.equal(
      executed[0]!.triggeredBy,
      'catchup',
      'the catch-up must carry `catchup` trigger metadata, not `schedule`',
    );

    const report = result.reports.find((r) => r.portalName === PORTAL_KEY);
    assert.equal(report?.report.status, 'missed');
    assert.ok(
      report!.report.unrecoverable > 0,
      'a three-day gap must report unrecoverable windows',
    );

    await scheduler.stop().catch(() => {});
    console.log('✓ A missed window enqueues one catch-up, tagged `catchup`, gap reported');
  }

  // ── 2. A disabled portal is never caught up ──
  {
    await reset();
    const { scheduler, executed } = build({ lastRunAt: LONG_AGO, enabled: false });
    await scheduler.start();

    const result = await scheduler.sweepMissedWindows();
    assert.equal(result.caughtUp, 0, 'a disabled portal must not be caught up');
    assert.equal(executed.length, 0, 'and must not execute');

    await scheduler.stop().catch(() => {});
    console.log('✓ A disabled portal is never caught up');
  }

  // ── 3. A persisted administrator pause suppresses the whole sweep ──
  {
    await reset();
    const { scheduler, executed } = build({ lastRunAt: LONG_AGO });
    await scheduler.start();
    await scheduler.setPaused(true);

    const result = await scheduler.sweepMissedWindows();
    assert.equal(result.checked, 0, 'a paused scheduler checks nothing');
    assert.equal(result.caughtUp, 0);
    assert.equal(executed.length, 0, 'resuming must not unleash a backlog');

    await scheduler.setPaused(false);
    await scheduler.stop().catch(() => {});
    console.log('✓ A persisted administrator pause suppresses catch-up entirely');
  }

  // ── 4. No duplicate: a catch-up cannot be enqueued while a run is in flight,
  //       which is also what stops it duplicating a resumed normal firing ──
  {
    await reset();
    const { scheduler, executed, release, enteredCount } = build({
      lastRunAt: LONG_AGO,
      gated: true,
    });
    await scheduler.start();

    // Hold the portal with a normal scheduled job that is genuinely in flight.
    const first = await scheduler.enqueueScrapeJob(PORTAL_KEY, 'schedule');
    assert.ok(first, 'the scheduled job must be enqueued');
    await waitFor('the scheduled run to be executing', async () => enteredCount() >= 1);

    const result = await scheduler.sweepMissedWindows();
    assert.equal(
      result.caughtUp,
      0,
      'the per-portal lock must refuse a catch-up while a run is queued or active',
    );
    assert.equal(
      executed.filter((e) => e.triggeredBy === 'catchup').length,
      0,
      'no catch-up execution may have happened',
    );

    release();
    await scheduler.stop().catch(() => {});
    console.log('✓ The per-portal lock prevents a catch-up duplicating an in-flight run');
  }

  // ── 5. Already current: no catch-up at all ──
  {
    await reset();
    // A run inside the most recent closed window.
    const { scheduler, executed } = build({ lastRunAt: new Date() });
    await scheduler.start();

    const result = await scheduler.sweepMissedWindows();
    assert.equal(result.caughtUp, 0, 'a current portal must not be caught up');
    assert.equal(executed.length, 0);

    await scheduler.stop().catch(() => {});
    console.log('✓ A portal that is already current is left alone');
  }

  // ── 6. A sweep run twice does not double-enqueue ──
  {
    await reset();
    const { scheduler, release, enteredCount } = build({
      lastRunAt: LONG_AGO,
      gated: true,
    });
    await scheduler.start();

    const first = await scheduler.sweepMissedWindows();
    // Hold the catch-up in flight, so the second sweep is judged against a real
    // outstanding run rather than an already-finished one.
    await waitFor('the catch-up to be executing', async () => enteredCount() >= 1);
    const second = await scheduler.sweepMissedWindows();

    assert.equal(first.caughtUp, 1);
    assert.equal(
      second.caughtUp,
      0,
      'a second sweep must not enqueue a duplicate while the first is outstanding',
    );

    release();
    await scheduler.stop().catch(() => {});
    console.log('✓ Repeated sweeps do not stack duplicate catch-up jobs');
  }

  // ── 7. A source without getPortalLastRuns disables the sweep cleanly ──
  {
    await reset();
    const scheduler = new ScrapingScheduler(redis, {
      queueName: QUEUE_NAME,
      missedWindowSweepMs: 0,
      reconcileIntervalMs: 0,
      scheduleSource: {
        async getScheduleOverrides() {
          return [];
        },
        async getSchedulerPaused() {
          return false;
        },
        async setSchedulerPaused() {},
      },
    });

    const result = await scheduler.sweepMissedWindows();
    assert.deepEqual(result, { checked: 0, caughtUp: 0, reports: [] });

    // The constructor opens a Queue connection even without start(), so this
    // scheduler has to be closed or the process never exits.
    await scheduler.stop().catch(() => {});

    console.log('✓ A ScheduleSource without last-run support disables the sweep without error');
  }

  await reset();
  await inspect.close().catch(() => {});
  inspectConnection.disconnect();
  await redis.quit().catch(() => {});

  console.log('--- All Missed-Window Sweep Tests Passed ---');
}

main()
  .then(() => {
    // Every assertion has passed and every connection this suite opened has
    // been closed, but the process still does not exit: constructing several
    // schedulers in one process leaves something in the node-cron / ioredis
    // teardown path holding the event loop. It is a teardown wart in the test
    // harness, not a product defect — the scheduler's own stop() closes its
    // worker, queue, queue-events, duplicated connections and lock-renewal
    // timers, and the single-scheduler suites exit cleanly.
    //
    // Exiting explicitly keeps `pnpm test` from stalling. It runs only on
    // success; a failure still goes through the catch below with exit 1, so a
    // real failure can never be masked by this.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
