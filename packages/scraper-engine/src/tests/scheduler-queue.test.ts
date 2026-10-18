import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

import { ScrapingScheduler, isPermanentScrapeFailure } from '../scheduler/scheduler';

/**
 * Integration tests for queue failure propagation and per-portal concurrency.
 *
 * Requires a REAL Redis (BullMQ has no in-memory mode). Point TEST_REDIS_URL at
 * a disposable instance — never at a production or shared one: the test writes
 * to its own queue name and to tb:scheduler:* keys, and flushes that queue.
 *
 *   docker run -d --name tbtest-redis-queue -p 56379:6379 redis:7-alpine
 *   TEST_REDIS_URL=redis://127.0.0.1:56379 pnpm --filter @tenderbazaar/scraper-engine test
 *
 * When Redis is unreachable the suite SKIPS (and says so) rather than failing,
 * so it does not break a checkout with no Docker.
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379';
const QUEUE_NAME = `test-scraper-jobs-${process.pid}`;

console.log('--- Starting Scheduler Queue & Concurrency Tests ---');

/** Poll a condition instead of sleeping a fixed amount. */
async function waitFor(
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 15_000,
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

async function main() {
  if (!(await redisReachable())) {
    console.log(`! SKIPPED: no Redis at ${TEST_REDIS_URL}`);
    console.log('--- Scheduler Queue & Concurrency Tests SKIPPED ---');
    return;
  }

  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 3 });

  // Job.queue is protected in BullMQ 5, so inspect through our own handle on
  // the same queue.
  // Kept as a variable: BullMQ does not close a connection it was handed, so
  // the test has to, or the process never exits.
  const inspectConnection = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  const inspect = new Queue(QUEUE_NAME, { connection: inspectConnection });
  const scheduler = new ScrapingScheduler(redis, {
    concurrency: 3,
    queueName: QUEUE_NAME,
  });

  /** Controls what the stub scraper does, per portal. */
  const behaviour = new Map<string, 'succeed' | 'throw' | 'hang'>();
  const calls: string[] = [];
  // Held in an object: a plain `let` assigned only inside the async handler
  // gets narrowed to `null` by control-flow analysis at the call sites.
  const hangControl: { release: (() => void) | null } = { release: null };

  scheduler.registerScrapeHandler(async (portalName) => {
    calls.push(portalName);
    const mode = behaviour.get(portalName) ?? 'succeed';

    if (mode === 'throw') {
      throw new Error(`Simulated portal failure for ${portalName}`);
    }
    if (mode === 'hang') {
      await new Promise<void>((resolve) => {
        hangControl.release = resolve;
      });
    }

    return {
      portalName,
      tendersFound: 1,
      tendersNew: 1,
      tendersDuplicate: 0,
      tendersFailed: 0,
      duration: 1,
      errors: [],
    };
  });

  // Clear any state left by a previous run of this suite.
  await scheduler.drainQueue().catch(() => {});
  for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
  await redis.del('tb:scheduler:schedules');

  await scheduler.start();

  try {
    // ── 1. A retryable failure must reach BullMQ ────────────────────────────
    // Previously processJob() swallowed the error and returned a
    // success-shaped result, so the job was recorded COMPLETED and neither the
    // attempt counter nor the backoff ever engaged.
    {
      behaviour.set('gem', 'throw');
      const job = await scheduler.enqueueScrapeJob('gem', 'schedule');
      assert.ok(job, 'The first enqueue must create a job');

      await waitFor('gem job to record a failed attempt', async () => {
        const probe = await inspect.getJob(job!.id!);
        return (probe?.attemptsMade ?? 0) >= 1;
      });

      const fresh = await inspect.getJob(job!.id!);
      assert.ok(fresh, 'Job must still exist');
      assert.ok(
        (fresh!.attemptsMade ?? 0) >= 1,
        'BullMQ must have recorded a failed attempt',
      );
      assert.ok(
        fresh!.failedReason && /Simulated portal failure/.test(fresh!.failedReason),
        `The failure reason must be preserved (got: ${fresh!.failedReason})`,
      );

      const completed = await scheduler.getQueueStatus();
      assert.equal(
        completed.completed,
        0,
        'A failed scrape must NOT be recorded as completed',
      );

      // With attempts: 3 the job is now waiting on exponential backoff.
      const state = await fresh!.getState();
      assert.ok(
        ['delayed', 'waiting', 'active', 'failed'].includes(state),
        `Unexpected state after failure: ${state}`,
      );
      assert.notEqual(state, 'completed', 'Must not be completed');

      console.log(
        `✓ A thrown scrape failure reaches BullMQ (attemptsMade=${fresh!.attemptsMade}, state=${state}, completed=0)`,
      );
    }

    // ── 2. Permanent failures are discarded, not retried forever ───────────
    {
      assert.equal(isPermanentScrapeFailure('Unknown portal: nope'), true);
      assert.equal(isPermanentScrapeFailure('No scraper class for: nope'), true);
      assert.equal(
        isPermanentScrapeFailure('Simulated portal failure for gem'),
        false,
        'An ordinary scrape error must stay retryable',
      );

      console.log('✓ Permanent configuration failures are classified separately from transient ones');
    }

    // ── 3. A second enqueue for a busy portal must not create a duplicate ──
    {
      behaviour.set('cppp', 'hang');
      const first = await scheduler.enqueueScrapeJob('cppp', 'schedule');
      assert.ok(first, 'First cppp enqueue must create a job');

      await waitFor('cppp handler to start', async () => calls.includes('cppp'));

      // The portal is now mid-run (the handler is blocked).
      const second = await scheduler.enqueueScrapeJob('cppp', 'schedule');
      const third = await scheduler.enqueueScrapeJob('cppp', 'manual');

      assert.ok(
        second === null || second!.id === first!.id,
        'A scheduled duplicate must be refused (null or the existing job)',
      );
      assert.ok(
        third === null || third!.id === first!.id,
        'A MANUAL trigger must not bypass the per-portal lock either',
      );

      const cpppJobs = [
        ...(await scheduler.getActiveJobs()),
        ...(await inspect.getWaiting()),
        ...(await inspect.getDelayed()),
      ].filter((j) => j.data.portalName === 'cppp');

      assert.equal(
        cpppJobs.length,
        1,
        `Exactly one cppp job may exist, found ${cpppJobs.length}`,
      );

      console.log('✓ While a portal run is in progress, further scheduled AND manual enqueues are refused (no duplicate)');
    }

    // ── 4. The lock is held for the whole run, and renewed ─────────────────
    {
      const ttl = await redis.ttl('tb:scheduler:lock:cppp');
      assert.ok(ttl > 0, `The lock must be alive while the job runs (ttl=${ttl})`);
      assert.ok(
        ttl <= 120,
        `The lock TTL must be short and renewed, not a flat long hold (ttl=${ttl})`,
      );

      const holder = await redis.get('tb:scheduler:lock:cppp');
      assert.match(
        String(holder),
        /^worker:/,
        'The worker must own the lock while processing (handed over from enqueue)',
      );

      console.log(`✓ The per-portal lock is owned by the worker and short-lived with renewal (ttl=${ttl}s)`);
    }

    // ── 5. Completing the run releases the portal ──────────────────────────
    {
      assert.ok(hangControl.release, 'The hanging handler should be releasable');
      hangControl.release?.();

      await waitFor('cppp lock to be released', async () => {
        const exists = await redis.exists('tb:scheduler:lock:cppp');
        return exists === 0;
      });

      behaviour.set('cppp', 'succeed');
      const next = await scheduler.enqueueScrapeJob('cppp', 'schedule');
      assert.ok(next, 'After the run finishes, the portal can be scheduled again');
      assert.notEqual(next!.id, undefined);

      console.log('✓ Finishing a run releases the lock so the next schedule can enqueue');
    }

    // ── 6. A stale lock from a crashed worker expires on its own ───────────
    {
      // Simulate a worker that died mid-run without releasing.
      await redis.set('tb:scheduler:lock:rajasthan', 'worker:dead:999', 'EX', 2);
      const blocked = await scheduler.enqueueScrapeJob('rajasthan', 'schedule');
      assert.equal(blocked, null, 'A held lock must block enqueueing');

      await waitFor(
        'stale rajasthan lock to expire',
        async () => (await redis.exists('tb:scheduler:lock:rajasthan')) === 0,
        8000,
      );

      const recovered = await scheduler.enqueueScrapeJob('rajasthan', 'schedule');
      assert.ok(recovered, 'Once the stale lock expires the portal recovers');

      console.log('✓ A stale lock left by a crashed worker expires, and the portal recovers');
    }
  } finally {
    // Release any still-blocked handler FIRST: worker.close() waits for active
    // jobs to drain, so leaving one parked would hang teardown forever if an
    // assertion above failed mid-run.
    behaviour.clear();
    hangControl.release?.();
    await scheduler.stop().catch(() => {});
    await scheduler.drainQueue().catch(() => {});
    for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
    await redis.del('tb:scheduler:schedules');
    // Remove this run's queue keys so the disposable Redis is left tidy.
    for (const key of await redis.keys(`bull:${QUEUE_NAME}:*`)) await redis.del(key);
    await inspect.close().catch(() => {});
    await inspectConnection.quit().catch(() => inspectConnection.disconnect());
    await redis.quit().catch(() => {});
  }

  console.log('--- All Scheduler Queue & Concurrency Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
