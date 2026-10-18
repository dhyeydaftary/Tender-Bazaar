import assert from 'node:assert/strict';
import Redis from 'ioredis';

import { Queue } from 'bullmq';

import { ScrapingScheduler, type ScraperJobResult } from '../scheduler/scheduler';

/**
 * Regression tests for the hourly `__retry_failed__` sweep.
 *
 * Phase 8 observed this live, on the production-configured staging stack:
 *
 *   10:00:01  [Scheduler] Retried 1 failed jobs
 *   10:00:01  [Worker] Processing SCRAPE_PORTAL for testportal
 *   10:00:01  [Worker] Completed testportal: 0 new, 0 dup, 0 failed (263ms)
 *
 * The queue went `failed: 1 -> 0, completed: 3 -> 4`, the mock portal's request
 * counter never moved, and no ScrapingRun row was written. An exhausted failure
 * was silently converted into a success.
 *
 * Cause: `job.retry()` preserved `triggeredBy: 'schedule'`, so the scrape
 * handler's "portal disabled" guard dropped the job — and that guard returned a
 * success-shaped all-zero result. The portal happened to be disabled at the
 * moment the sweep ran.
 *
 * Requires a REAL Redis (BullMQ has no in-memory mode). SKIPS when unreachable.
 *   TEST_REDIS_URL=redis://127.0.0.1:56379
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379';
const QUEUE_NAME = `test-retry-sweep-${process.pid}`;
const PORTAL = 'gem';

console.log('--- Starting Failed-Job Retry Sweep Tests ---');

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

/** A stand-in for the real StorageWriter-backed source used by main.ts. */
function makeSource(enabled: boolean, paused = false) {
  const state = { enabled, paused };
  return {
    state,
    source: {
      async getScheduleOverrides() {
        return [{ portalName: 'GeM', enabled: state.enabled, cronExpression: null }];
      },
      async getSchedulerPaused() {
        return state.paused;
      },
      async setSchedulerPaused(value: boolean) {
        state.paused = value;
      },
    },
  };
}

async function main(): Promise<void> {
  if (!(await redisReachable())) {
    console.log(`! SKIPPED: no Redis at ${TEST_REDIS_URL}`);
    console.log('--- Failed-Job Retry Sweep Tests SKIPPED ---');
    return;
  }

  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 3 });

  // Own handle on the same queue, so the test can read job state without the
  // scheduler needing to expose test-only accessors. BullMQ does not close a
  // connection it was handed, so this one is closed explicitly at the end.
  const inspectConnection = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  const inspect = new Queue<unknown, ScraperJobResult>(QUEUE_NAME, {
    connection: inspectConnection,
  });

  /**
   * Start from a clean slate.
   *
   * enqueueScrapeJob() returns null when the per-portal lock is already held,
   * so a lock left behind by an interrupted earlier run makes every block in
   * this suite fail with a confusing "the job must be enqueued". The lock has a
   * TTL in production, but a test should not wait it out.
   */
  async function resetSchedulerState(): Promise<void> {
    for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
    await redis.del('tb:scheduler:schedules').catch(() => {});
    await inspect.obliterate({ force: true }).catch(() => {});
  }

  await resetSchedulerState();

  /** Build a scheduler whose handler records every invocation. */
  function build(enabled: boolean, opts?: { failing?: boolean }) {
    const { state, source } = makeSource(enabled);
    const executions: Array<{ portal: string; triggeredBy?: string }> = [];
    // Mutable so a test can let the chain exhaust and THEN allow the retry to
    // succeed. `failFirst` only failed attempt 1, so attempts 2 and 3 passed and
    // the job never reached the failed set at all.
    const control = { failing: opts?.failing ?? false };

    const scheduler = new ScrapingScheduler(redis, {
      queueName: QUEUE_NAME,
      scheduleSource: source,
      // Keep reconciliation out of the way; these tests drive state directly.
      reconcileIntervalMs: 0,
      // Production uses 3 attempts with a 60s exponential base, so exhausting a
      // chain there takes ~3 minutes. The attempt COUNT is what these tests care
      // about, so the count is kept at the production value and only the backoff
      // base is shortened. (This knob existing at all is part of the Priority 3
      // fix: QUEUE_RETRY_ATTEMPTS / QUEUE_RETRY_BACKOFF_MS were previously
      // documented but unread.)
      attempts: 3,
      backoffMs: 20,
    });

    scheduler.registerScrapeHandler(
      async (portalName, _maxPages, _full, triggeredBy): Promise<ScraperJobResult> => {
        executions.push({ portal: portalName, triggeredBy });

        // Mirror main.ts: a machine-triggered job for a portal that may not run
        // is skipped, and says so.
        if ((triggeredBy ?? 'schedule') !== 'manual') {
          if (!(await scheduler.isSchedulingAllowed(portalName))) {
            return {
              portalName,
              tendersFound: 0,
              tendersNew: 0,
              tendersDuplicate: 0,
              tendersFailed: 0,
              duration: 1,
              errors: [],
              skipped: true,
              skippedReason: 'portal disabled or scheduling paused',
            };
          }
        }

        if (control.failing) {
          throw new Error('Request failed with status code 500');
        }

        return {
          portalName,
          tendersFound: 3,
          tendersNew: 3,
          tendersDuplicate: 0,
          tendersFailed: 0,
          duration: 5,
          errors: [],
        };
      },
    );

    return { scheduler, executions, state, control };
  }

  // ── 1. A disabled portal's failed job is HELD BACK, not falsely completed ──
  {
    await resetSchedulerState();
    const { scheduler, executions, state } = build(true, { failing: true });
    await scheduler.start();

    const job = await scheduler.enqueueScrapeJob(PORTAL, 'schedule');
    assert.ok(job, 'the job must be enqueued');

    // Let the attempt chain exhaust so the job lands in the failed set.
    await waitFor('the job to fail', async () => {
      const status = await scheduler.getQueueStatus();
      return status.failed >= 1;
    });

    const before = await scheduler.getQueueStatus();
    assert.equal(before.failed, 1, 'exactly one failed job expected');
    const executionsBefore = executions.length;

    // The operator disables the portal, then the hourly sweep runs.
    state.enabled = false;
    const retried = await scheduler.retryFailedJobs();

    assert.equal(retried, 0, 'a disabled portal must not be retried');

    const after = await scheduler.getQueueStatus();
    assert.equal(
      after.failed,
      1,
      'the failure must REMAIN in the failed set, not be converted to completed',
    );
    assert.equal(
      executions.length,
      executionsBefore,
      'no further execution may be attempted for a disabled portal',
    );

    await scheduler.stop().catch(() => {});
    console.log('✓ A disabled portal’s failed job stays failed — never silently marked completed');
  }

  // ── 2. An enabled portal IS retried, through the real execution path, and
  //      the attempt is tagged `retry` rather than masquerading as `schedule` ──
  {
    await resetSchedulerState();
    const { scheduler, executions, state, control } = build(true, { failing: true });
    await scheduler.start();

    await scheduler.enqueueScrapeJob(PORTAL, 'schedule');
    await waitFor('the job to fail', async () => {
      const s = await scheduler.getQueueStatus();
      return s.failed >= 1;
    });

    const firstAttempts = executions.length;
    assert.ok(firstAttempts >= 1, 'the original attempt must have executed');
    assert.equal(
      executions[0]!.triggeredBy,
      'schedule',
      'the original attempt is a scheduled one',
    );

    // Let the retry succeed, so this block proves the retry REACHES execution
    // rather than merely being re-queued.
    control.failing = false;
    state.enabled = true;
    const retried = await scheduler.retryFailedJobs();
    assert.equal(retried, 1, 'an enabled portal must be retried');

    await waitFor('the retry to complete', async () => {
      const s = await scheduler.getQueueStatus();
      return s.completed >= 1;
    });

    assert.ok(
      executions.length > firstAttempts,
      'the retry must reach the real execution path, not short-circuit',
    );

    const retryExecution = executions[executions.length - 1]!;
    assert.equal(
      retryExecution.triggeredBy,
      'retry',
      'the retried attempt must be tagged `retry`, not `schedule`',
    );
    assert.equal(retryExecution.portal, PORTAL);

    const status = await scheduler.getQueueStatus();
    assert.equal(status.failed, 0, 'a genuinely re-executed job leaves the failed set');
    assert.ok(status.completed >= 1, 'and is counted as completed');

    await scheduler.stop().catch(() => {});
    console.log('✓ An enabled portal is retried through the real path and tagged `retry`');
  }

  // ── 3. A skipped result is distinguishable from a successful scrape ──
  {
    await resetSchedulerState();
    const { scheduler, executions, state } = build(true);
    await scheduler.start();

    state.enabled = false;
    // A machine-triggered job already in flight for a now-disabled portal.
    const job = await scheduler.enqueueScrapeJob(PORTAL, 'schedule');
    assert.ok(job);

    await waitFor('the skip to be processed', async () => executions.length >= 1);
    await waitFor('the job to settle', async () => {
      const s = await scheduler.getQueueStatus();
      return s.completed + s.failed >= 1;
    });

    const settledJob = await inspect.getJob(job!.id!);
    const settled = settledJob?.returnvalue;
    assert.equal(settled?.skipped, true, 'the result must be flagged skipped');
    assert.match(
      String(settled?.skippedReason),
      /disabled|paused/i,
      'the reason must say why',
    );
    assert.equal(settled?.tendersFound, 0);

    await scheduler.stop().catch(() => {});
    console.log('✓ A skipped run carries an explicit `skipped` flag and reason, not a bare zero result');
  }

  // ── 4. A paused scheduler is treated the same as a disabled portal ──
  {
    await resetSchedulerState();
    const { scheduler, state } = build(true, { failing: true });
    await scheduler.start();

    await scheduler.enqueueScrapeJob(PORTAL, 'schedule');
    await waitFor('the job to fail', async () => {
      const s = await scheduler.getQueueStatus();
      return s.failed >= 1;
    });

    await scheduler.setPaused(true);
    const retried = await scheduler.retryFailedJobs();

    assert.equal(retried, 0, 'a paused scheduler must not retry');
    const after = await scheduler.getQueueStatus();
    assert.equal(after.failed, 1, 'the failure must remain visible while paused');

    await scheduler.setPaused(false);
    await scheduler.stop().catch(() => {});
    console.log('✓ A persisted administrator pause holds failed jobs back too');
  }

  // ── 5. Retry limits and the 24h window are preserved ──
  {
    await resetSchedulerState();
    const { scheduler } = build(true, { failing: true });
    await scheduler.start();

    await scheduler.enqueueScrapeJob(PORTAL, 'schedule');
    await waitFor('the job to fail', async () => {
      const s = await scheduler.getQueueStatus();
      return s.failed >= 1;
    });

    const failed = await inspect.getFailed(0, 10);
    assert.equal(failed.length, 1);
    assert.equal(
      failed[0]!.attemptsMade,
      3,
      'the configured attempts: 3 must still be exhausted before a job is considered failed',
    );
    assert.equal(failed[0]!.opts.attempts, 3, 'the attempts option itself must be unchanged');

    await scheduler.stop().catch(() => {});
    console.log('✓ Configured attempt limit (3) is unchanged by the sweep fix');
  }

  // Cleanup: this suite owns QUEUE_NAME and its own tb:scheduler keys.
  for (const key of await redis.keys(`bull:${QUEUE_NAME}:*`)) await redis.del(key);
  await redis.del('tb:scheduler:schedules').catch(() => {});
  for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
  await inspect.close().catch(() => {});
  inspectConnection.disconnect();
  await redis.quit().catch(() => {});

  console.log('--- All Failed-Job Retry Sweep Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
