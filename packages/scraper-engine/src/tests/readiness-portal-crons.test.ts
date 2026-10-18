import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import { createAdminApi, evaluateReadiness } from '../api/server';
import type { StorageWriter } from '../storage/writer';

/**
 * Readiness must judge PORTAL schedules, not the internal maintenance crons.
 *
 * `start()` always registers `__full_rescrape__` and `__retry_failed__`, so the
 * old probe — which counted `registeredCronCount` — never saw a value below 2
 * and its "no cron schedules are registered" branch was unreachable. Phase 8
 * observed the consequence directly: immediately after resuming a paused
 * scheduler the endpoint answered
 *
 *   ready=true  registeredCronCount=2  paused=false
 *
 * with ZERO portals scheduled, for up to a full reconciliation interval. A
 * scheduler that had lost every portal cron would have passed its own
 * healthcheck indefinitely.
 */

const TOKEN = 'phase9-readiness-token-0123456789';

console.log('--- Starting Readiness Portal-Cron Tests ---');

const storageWriter = {
  async getAllHealth() {
    return [];
  },
  async getRecentRuns() {
    return [];
  },
} as unknown as StorageWriter;

interface SchedulerStub {
  isRunning: boolean;
  isPaused?: boolean;
  registeredCronCount?: number;
  portalCronCount?: number;
  internalCronCount?: number;
  enabledPortalCount?: () => Promise<number>;
  getQueueStatus?: () => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
}

async function readinessOf(scheduler: SchedulerStub): Promise<{
  http: number;
  data: Record<string, unknown>;
}> {
  const { app } = createAdminApi({
    storageWriter,
    scheduler: scheduler as never,
    authToken: TOKEN,
    allowedOrigins: [],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    // /api/ready is deliberately public: the container healthcheck has no token.
    const res = await fetch(`http://127.0.0.1:${port}/api/ready`);
    const body = (await res.json()) as { data: Record<string, unknown> };
    return { http: res.status, data: body.data };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const okQueue = async () => ({
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
});

async function main(): Promise<void> {
  // 1. THE REGRESSION: internal crons only, zero portal crons -> UNHEALTHY.
  {
    const { http, data } = await readinessOf({
      isRunning: true,
      isPaused: false,
      registeredCronCount: 2, // the two internal maintenance tasks
      portalCronCount: 0,
      internalCronCount: 2,
      enabledPortalCount: async () => 13,
      getQueueStatus: okQueue,
    });

    assert.equal(http, 503, 'enabled portals with no portal cron must be 503');
    assert.equal(data.ready, false);
    assert.equal(data.portalCronCount, 0);
    assert.equal(data.internalCronCount, 2);
    assert.match(
      String(data.reason),
      /enabled but none has a registered cron/i,
      'the reason must name the real problem',
    );

    console.log('✓ Internal crons alone no longer make the scheduler look ready');
  }

  // 2. Portal crons registered -> healthy, and the two counts are reported
  //    separately so an operator can see the difference.
  {
    const { http, data } = await readinessOf({
      isRunning: true,
      isPaused: false,
      registeredCronCount: 15,
      portalCronCount: 13,
      internalCronCount: 2,
      enabledPortalCount: async () => 13,
      getQueueStatus: okQueue,
    });

    assert.equal(http, 200);
    assert.equal(data.ready, true);
    assert.equal(data.portalCronCount, 13);
    assert.equal(data.internalCronCount, 2);
    assert.equal(data.enabledPortalCount, 13);
    assert.equal(data.reason, 'scheduler running');

    console.log('✓ Portal and internal cron counts are reported separately when healthy');
  }

  // 3. Every portal disabled by an operator -> healthy, not falsely broken.
  {
    const { http, data } = await readinessOf({
      isRunning: true,
      isPaused: false,
      registeredCronCount: 2,
      portalCronCount: 0,
      internalCronCount: 2,
      enabledPortalCount: async () => 0,
      getQueueStatus: okQueue,
    });

    assert.equal(http, 200, 'disabling every portal is a deliberate state, not a fault');
    assert.equal(data.ready, true);
    assert.match(String(data.reason), /no portals are enabled/i);

    console.log('✓ Zero ENABLED portals reads as healthy, not as a crash');
  }

  // 4. A paused scheduler is reported as paused — neither falsely healthy nor
  //    falsely broken — even with no portal crons registered.
  {
    const { http, data } = await readinessOf({
      isRunning: true,
      isPaused: true,
      registeredCronCount: 0,
      portalCronCount: 0,
      internalCronCount: 0,
      enabledPortalCount: async () => 13,
      getQueueStatus: okQueue,
    });

    assert.equal(http, 200, 'an intentional pause must not look like a crash');
    assert.equal(data.ready, true);
    assert.equal(data.paused, true);
    assert.match(String(data.reason), /paused by an administrator/i);

    console.log('✓ An administrator pause is reported accurately, with crons absent');
  }

  // 4b. THE REAL PAUSE STATE: stopped *because* an administrator paused.
  //
  //     Regression test for a defect that live verification caught and every
  //     unit test missed. Case 4 above pairs isPaused with isRunning: true —
  //     a combination the API never produces, because
  //     POST /api/scheduler/stop sets the pause AND stops the scheduler. The
  //     readiness evaluator checked schedulerRunning first, so a deliberate
  //     pause answered 503 "scheduler is not running" and the container
  //     healthcheck marked a correctly-configured scraper unhealthy.
  //
  //     This asserts the state the running system actually reaches.
  {
    const { http, data } = await readinessOf({
      isRunning: false,
      isPaused: true,
      registeredCronCount: 0,
      portalCronCount: 0,
      internalCronCount: 0,
      enabledPortalCount: async () => 1,
      getQueueStatus: okQueue,
    });

    assert.equal(
      http,
      200,
      'a pause that stopped the scheduler is still a deliberate operator state, not a crash',
    );
    assert.equal(data.ready, true);
    assert.equal(data.paused, true);
    assert.match(
      String(data.reason),
      /paused by an administrator/i,
      'the reason must name the pause, not report "scheduler is not running"',
    );

    console.log('✓ A pause that stopped the scheduler reports 200, not 503 (live-found defect)');
  }

  // 5. Scheduler stopped -> unhealthy, and that outranks the cron counts.
  {
    const { http, data } = await readinessOf({
      isRunning: false,
      isPaused: false,
      registeredCronCount: 15,
      portalCronCount: 13,
      internalCronCount: 2,
      enabledPortalCount: async () => 13,
      getQueueStatus: okQueue,
    });

    assert.equal(http, 503);
    assert.equal(data.ready, false);
    assert.match(String(data.reason), /not running/i);

    console.log('✓ A stopped scheduler is unhealthy regardless of cron counts');
  }

  // 6. Redis/queue failure -> unhealthy, and it outranks the cron counts.
  {
    const { http, data } = await readinessOf({
      isRunning: true,
      isPaused: false,
      registeredCronCount: 15,
      portalCronCount: 13,
      internalCronCount: 2,
      enabledPortalCount: async () => 13,
      getQueueStatus: async () => {
        throw new Error('Connection is closed.');
      },
    });

    assert.equal(http, 503);
    assert.equal(data.ready, false);
    assert.equal(data.queueReachable, false);
    assert.match(String(data.reason), /queue is unreachable/i);

    console.log('✓ An unreachable queue is unhealthy and reported as such');
  }

  // 7. Recovery: the same scheduler, before and after reconciliation registers
  //    the portal crons.
  {
    let portalCrons = 0;
    const scheduler: SchedulerStub = {
      isRunning: true,
      isPaused: false,
      registeredCronCount: 2,
      internalCronCount: 2,
      get portalCronCount() {
        return portalCrons;
      },
      enabledPortalCount: async () => 13,
      getQueueStatus: okQueue,
    };

    const before = await readinessOf(scheduler);
    assert.equal(before.http, 503, 'not ready while enabled portals have no cron');

    // Reconciliation registers them.
    portalCrons = 13;

    const after = await readinessOf(scheduler);
    assert.equal(after.http, 200, 'readiness must recover once crons are registered');
    assert.equal(after.data.ready, true);
    assert.equal(after.data.portalCronCount, 13);

    console.log('✓ Readiness recovers once reconciliation registers the portal crons');
  }

  // 8. The decision table directly, including the legacy fallback path.
  {
    const base = {
      schedulerConfigured: true,
      schedulerRunning: true,
      queueReachable: true as boolean | null,
      registeredCronCount: 2,
    };

    // portalCronCount takes precedence when supplied.
    assert.equal(
      evaluateReadiness({ ...base, portalCronCount: 0, enabledPortalCount: 5 }).ready,
      false,
    );
    assert.equal(
      evaluateReadiness({ ...base, portalCronCount: 1, enabledPortalCount: 5 }).ready,
      true,
    );
    assert.equal(
      evaluateReadiness({ ...base, portalCronCount: 0, enabledPortalCount: 0 }).ready,
      true,
    );

    // Without it, the old total-count behaviour is preserved for any caller
    // that cannot distinguish portal from internal crons.
    assert.equal(evaluateReadiness({ ...base, registeredCronCount: 0 }).ready, false);
    assert.equal(evaluateReadiness({ ...base, registeredCronCount: 16 }).ready, true);

    // Pause and a dead queue keep their precedence.
    assert.equal(
      evaluateReadiness({ ...base, portalCronCount: 0, enabledPortalCount: 5, paused: true })
        .ready,
      true,
    );
    assert.equal(
      evaluateReadiness({
        ...base,
        queueReachable: false,
        portalCronCount: 13,
        enabledPortalCount: 13,
      }).ready,
      false,
    );

    console.log('✓ Decision table holds, and the legacy total-count fallback still works');
  }

  console.log('--- All Readiness Portal-Cron Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
