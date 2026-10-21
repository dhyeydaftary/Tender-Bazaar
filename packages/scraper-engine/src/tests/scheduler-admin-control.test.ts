import assert from 'node:assert/strict';
import Redis from 'ioredis';

import { ScrapingScheduler, type ScheduleSource } from '../scheduler/scheduler';
import { PORTAL_CONFIGS } from '../config';

/**
 * Admin control effectiveness (audit finding B16).
 *
 * The admin dashboard wrote `enabled` and `cronExpression` to PostgreSQL
 * (ScraperHealth) while the scheduler read both exclusively from the Redis key
 * tb:scheduler:schedules, seeded from the portal registry. Disabling a portal
 * or editing its cron therefore reported success in the UI and changed nothing
 * — the original cadence kept firing. POST /api/scheduler/stop was equally
 * cosmetic across restarts: it flipped an in-memory boolean only.
 *
 * Needs a disposable Redis (BullMQ); PostgreSQL is replaced by a fake source.
 *   docker run -d --name tbtest-redis-queue -p 56379:6379 redis:7-alpine
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379';
const QUEUE_NAME = `test-admin-control-${process.pid}`;

console.log('--- Starting Scheduler Admin Control Tests ---');

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

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${label}`);
}

/** Stands in for PostgreSQL: ScraperHealth rows + the AdminSetting pause flag. */
function makeSource(): ScheduleSource & {
  rows: Map<string, { enabled: boolean; cronExpression: string | null }>;
  paused: boolean;
} {
  const rows = new Map<string, { enabled: boolean; cronExpression: string | null }>(
    PORTAL_CONFIGS.map((p) => [p.name, { enabled: true, cronExpression: p.cronExpression }]),
  );

  const source = {
    rows,
    paused: false,
    async getScheduleOverrides() {
      return [...rows.entries()].map(([portalName, row]) => ({
        portalName,
        enabled: row.enabled,
        cronExpression: row.cronExpression,
      }));
    },
    async getSchedulerPaused() {
      return source.paused;
    },
    async setSchedulerPaused(paused: boolean) {
      source.paused = paused;
    },
  };
  return source;
}

async function main() {
  if (!(await redisReachable())) {
    console.log(`! SKIPPED: no Redis at ${TEST_REDIS_URL}`);
    console.log('--- Scheduler Admin Control Tests SKIPPED ---');
    return;
  }

  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 3 });
  const source = makeSource();

  // Operator state BEFORE the scheduler starts: GeM disabled.
  source.rows.get('GeM')!.enabled = false;

  const scheduler = new ScrapingScheduler(redis, {
    concurrency: 1,
    queueName: QUEUE_NAME,
    scheduleSource: source,
    reconcileIntervalMs: 250,
  });
  scheduler.registerScrapeHandler(async (portalName) => ({
    portalName,
    tendersFound: 0,
    tendersNew: 0,
    tendersDuplicate: 0,
    tendersFailed: 0,
    duration: 1,
    errors: [],
  }));

  await redis.del('tb:scheduler:schedules');

  try {
    await scheduler.start();

    // ── 1. A portal disabled in PostgreSQL gets no cron at startup ──────────
    {
      assert.equal(
        scheduler.registeredCronFor('gem'),
        undefined,
        'A portal disabled by the operator must not be registered',
      );
      assert.ok(
        scheduler.registeredCronFor('cppp'),
        'Enabled portals must still be registered',
      );
      assert.equal(
        await scheduler.isSchedulingAllowed('gem'),
        false,
        'A disabled portal must not be allowed to enqueue',
      );
      assert.equal(await scheduler.isSchedulingAllowed('cppp'), true);

      console.log('✓ An operator-disabled portal is not scheduled at startup, and is refused at fire time');
    }

    // ── 2. Enabling in PostgreSQL takes effect without a restart ────────────
    {
      source.rows.get('GeM')!.enabled = true;

      await waitFor(
        'gem cron to be registered after reconciliation',
        () => scheduler.registeredCronFor('gem') !== undefined,
      );

      assert.equal(scheduler.registeredCronFor('gem'), '0 */2 * * *');
      assert.equal(await scheduler.isSchedulingAllowed('gem'), true);

      console.log('✓ Re-enabling a portal registers its cron live (no container restart)');
    }

    // ── 3. A cron edit takes effect without a restart ───────────────────────
    {
      source.rows.get('GeM')!.cronExpression = '15 */3 * * *';

      await waitFor(
        'gem cron expression to change',
        () => scheduler.registeredCronFor('gem') === '15 */3 * * *',
      );

      console.log('✓ An edited cron expression is re-registered live (0 */2 -> 15 */3)');
    }

    // ── 4. An invalid stored cron is ignored, keeping the registry value ────
    {
      source.rows.get('CPPP')!.cronExpression = 'not a cron expression';

      // Give reconciliation a couple of cycles, then assert it did NOT apply.
      await new Promise((resolve) => setTimeout(resolve, 800));

      assert.equal(
        scheduler.registeredCronFor('cppp'),
        '0 */4 * * *',
        'An invalid operator cron must fall back to the registry default',
      );

      console.log('✓ An invalid stored cron expression is rejected, registry default retained');
    }

    // ── 5. Disabling removes the cron live ──────────────────────────────────
    {
      source.rows.get('GeM')!.enabled = false;

      await waitFor(
        'gem cron to be removed',
        () => scheduler.registeredCronFor('gem') === undefined,
      );

      console.log('✓ Disabling a portal removes its cron live');
    }

    // ── 6. Pause is persisted and survives a restart ────────────────────────
    {
      await scheduler.setPaused(true);
      assert.equal(source.paused, true, 'The pause must be written to the store');

      await waitFor(
        'all portal crons to be removed while paused',
        () =>
          PORTAL_CONFIGS.every((p) => scheduler.registeredCronFor(p.key) === undefined),
      );

      // Simulate a container restart.
      await scheduler.stop();
      await scheduler.start();

      assert.equal(scheduler.isPaused, true, 'The pause must be restored on startup');
      assert.equal(
        scheduler.registeredCronCount,
        2,
        'Only the internal full-rescrape and retry crons may be registered while paused',
      );
      assert.equal(
        PORTAL_CONFIGS.every((p) => scheduler.registeredCronFor(p.key) === undefined),
        true,
        'No portal cron may be registered while paused',
      );
      assert.equal(
        await scheduler.isSchedulingAllowed('cppp'),
        false,
        'Nothing may be enqueued while paused',
      );

      console.log('✓ An administrator pause is persisted and still in force after a restart');
    }

    // ── 7. Resuming restores schedules ──────────────────────────────────────
    {
      await scheduler.setPaused(false);
      source.rows.get('GeM')!.enabled = true;

      await waitFor(
        'crons to come back after resume',
        () => scheduler.registeredCronFor('cppp') !== undefined,
      );

      assert.equal(await scheduler.isSchedulingAllowed('cppp'), true);

      console.log('✓ Resuming re-registers the enabled portals');
    }
  } finally {
    await scheduler.stop().catch(() => {});
    await redis.del('tb:scheduler:schedules').catch(() => {});
    for (const key of await redis.keys(`bull:${QUEUE_NAME}:*`)) await redis.del(key);
    for (const key of await redis.keys('tb:scheduler:lock:*')) await redis.del(key);
    await redis.quit().catch(() => {});
  }

  console.log('--- All Scheduler Admin Control Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
