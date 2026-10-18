import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import {
  createAdminApi,
  tokensMatch,
  extractToken,
  evaluateReadiness,
  type TriggerRunOutcome,
} from '../api/server';
import { validateApiSecurity, MIN_API_TOKEN_LENGTH } from '../config';
import type { StorageWriter } from '../storage/writer';

/**
 * Authorization and readiness tests for the scraper control API.
 *
 * Before this, every endpoint was reachable with no credentials and every
 * response carried `Access-Control-Allow-Origin: *`, while the port was
 * published to the host — so `POST /api/scheduler/stop` from anywhere silently
 * stopped all scraping.
 */

console.log('--- Starting Scraper Control API Authorization Tests ---');

const TOKEN = 'test-scraper-token-0123456789';

/** Minimal StorageWriter stand-in: the auth layer runs before any of it. */
const storageWriter = {
  getAllHealth: async () => [
    {
      portalName: 'GeM',
      status: 'HEALTHY',
      lastRunAt: null,
      lastSuccessAt: null,
      consecutiveFailures: 0,
      errorRate: 0,
      totalRuns: 0,
      enabled: true,
    },
  ],
  getRecentRuns: async () => [],
  togglePortal: async () => undefined,
} as unknown as StorageWriter;

type SchedulerStub = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: boolean;
  registeredCronCount: number;
  getQueueStatus: () => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
  stopCalls: number;
};

function makeScheduler(running: boolean): SchedulerStub {
  const stub: SchedulerStub = {
    start: async () => {
      stub.isRunning = true;
    },
    stop: async () => {
      stub.stopCalls += 1;
      stub.isRunning = false;
    },
    isRunning: running,
    registeredCronCount: running ? 16 : 0,
    getQueueStatus: async () => ({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    stopCalls: 0,
  };
  return stub;
}

async function withServer(
  opts: {
    authToken?: string;
    allowedOrigins?: string[];
    scheduler?: SchedulerStub;
    onTriggerRun?: (key: string) => Promise<TriggerRunOutcome>;
    enableTestHooks?: boolean;
  },
  run: (base: string, scheduler?: SchedulerStub) => Promise<void>,
) {
  const { app } = createAdminApi({
    storageWriter,
    scheduler: opts.scheduler as never,
    onTriggerRun: opts.onTriggerRun,
    enableTestHooks: opts.enableTestHooks,
    authToken: opts.authToken ?? TOKEN,
    allowedOrigins: opts.allowedOrigins ?? [],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${port}`, opts.scheduler);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Wrapped in a function: this package compiles to CommonJS, which has no
 *  top-level await. */
async function main() {
  // 1. Public endpoints need no credentials (the container healthcheck has none).
  await withServer({ scheduler: makeScheduler(true) }, async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200, 'GET /api/health must be public');

    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 200, 'GET /api/ready must be public');

    console.log('✓ /api/health and /api/ready are reachable without a token');
  });

  // 2. Unauthenticated state-changing calls are rejected, and have no effect.
  await withServer({ scheduler: makeScheduler(true) }, async (base, scheduler) => {
    const stop = await fetch(`${base}/api/scheduler/stop`, { method: 'POST' });
    assert.equal(stop.status, 401, 'POST /api/scheduler/stop must require a token');
    assert.equal(scheduler!.stopCalls, 0, 'The scheduler must NOT have been stopped');
    assert.equal(scheduler!.isRunning, true, 'The scheduler must still be running');

    const body = (await stop.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, 'UNAUTHORIZED');

    const portals = await fetch(`${base}/api/portals`);
    assert.equal(portals.status, 401, 'Read endpoints are protected too');

    console.log('✓ Unauthenticated scheduler/stop is rejected 401 and does not stop the scheduler');
  });

  // 3. A wrong or malformed token is rejected.
  await withServer({ scheduler: makeScheduler(true) }, async (base) => {
    const badHeaderSets: Array<Record<string, string>> = [
      { Authorization: 'Bearer wrong-token-value-0123456789' },
      { Authorization: 'Bearer ' },
      { Authorization: TOKEN }, // missing "Bearer " prefix
      { 'X-Scraper-Api-Token': 'nope' },
    ];
    for (const header of badHeaderSets) {
      const res = await fetch(`${base}/api/portals`, { headers: header });
      assert.equal(res.status, 401, `Must reject ${JSON.stringify(header)}`);
    }

    console.log('✓ Wrong, empty and malformed credentials are all rejected');
  });

  // 4. The correct token is accepted on both supported headers.
  await withServer({ scheduler: makeScheduler(true) }, async (base) => {
    const bearer = await fetch(`${base}/api/portals`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(bearer.status, 200, 'Authorization: Bearer <token> must be accepted');

    const custom = await fetch(`${base}/api/portals`, {
      headers: { 'X-Scraper-Api-Token': TOKEN },
    });
    assert.equal(custom.status, 200, 'X-Scraper-Api-Token must be accepted');

    console.log('✓ The configured token is accepted via Bearer and X-Scraper-Api-Token');
  });

  // 5. An authorized caller can actually trigger a run (the api-server path).
  await withServer(
    {
      scheduler: makeScheduler(true),
      onTriggerRun: async (): Promise<TriggerRunOutcome> => ({
        status: 'queued',
        jobId: 'scrape-gem-1',
      }),
    },
    async (base) => {
      const res = await fetch(`${base}/api/portals/gem/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      // 202 Accepted, deliberately changed from 200: the work is queued for
      // asynchronous processing, and the endpoint now reports which outcome
      // occurred instead of always claiming a successful enqueue.
      assert.equal(res.status, 202, 'Authorized portal run must be accepted');
      const body = (await res.json()) as { success: boolean; data?: { status?: string } };
      assert.equal(body.success, true);
      assert.equal(body.data?.status, 'queued');

      console.log('✓ Authorized POST /api/portals/gem/run succeeds (api-server path preserved)');
    },
  );

  // 6. CORS: nothing by default, echoed only for a configured origin.
  await withServer({ scheduler: makeScheduler(true) }, async (base) => {
    const res = await fetch(`${base}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      null,
      'No origin may be allowed by default (previously this was "*")',
    );

    const preflight = await fetch(`${base}/api/portals`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(preflight.status, 403, 'Preflight from a disallowed origin must be refused');

    console.log('✓ No wildcard CORS; disallowed origins get no allow headers and a 403 preflight');
  });

  await withServer(
    { scheduler: makeScheduler(true), allowedOrigins: ['https://admin.example.test'] },
    async (base) => {
      const res = await fetch(`${base}/api/health`, {
        headers: { Origin: 'https://admin.example.test' },
      });
      assert.equal(
        res.headers.get('access-control-allow-origin'),
        'https://admin.example.test',
        'A configured origin must be echoed back',
      );
      assert.equal(res.headers.get('vary'), 'Origin');

      console.log('✓ An explicitly configured origin is echoed (and Vary: Origin is set)');
    },
  );

  // 7. Readiness reflects scheduler state rather than process liveness.
  await withServer({ scheduler: makeScheduler(false) }, async (base) => {
    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 503, 'A stopped scheduler must report NOT ready');

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200, 'Liveness stays 200 — the process is up');

    const body = (await ready.json()) as { data?: { reason?: string } };
    assert.match(String(body.data?.reason), /not running/);

    console.log('✓ Stopped scheduler: /api/ready is 503 while /api/health stays 200');
  });

  // 8. No scheduler at all (Redis unavailable at boot) must not look ready.
  await withServer({ scheduler: undefined }, async (base) => {
    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 503, 'No scheduler configured must report NOT ready');

    const body = (await ready.json()) as { data?: { reason?: string } };
    assert.match(String(body.data?.reason), /not configured|Redis/i);

    console.log('✓ Redis-unavailable boot (no scheduler) reports 503, not healthy');
  });

  // 9. evaluateReadiness decision table.
  {
    assert.equal(
      evaluateReadiness({
        schedulerConfigured: true,
        schedulerRunning: true,
        queueReachable: true,
        registeredCronCount: 16,
      }).ready,
      true,
    );
    assert.equal(
      evaluateReadiness({
        schedulerConfigured: true,
        schedulerRunning: true,
        queueReachable: false,
        registeredCronCount: 16,
      }).ready,
      false,
      'An unreachable queue is not ready',
    );
    assert.equal(
      evaluateReadiness({
        schedulerConfigured: true,
        schedulerRunning: true,
        queueReachable: true,
        registeredCronCount: 0,
      }).ready,
      false,
      'Running with zero registered crons is not ready',
    );

    console.log('✓ evaluateReadiness covers queue failure and zero-cron cases');
  }

  // 10. Startup validation fails closed in production.
  {
    assert.deepEqual(
      validateApiSecurity({ nodeEnv: 'development', apiEnabled: true, token: '' }),
      [],
      'Development tolerates a missing token',
    );
    assert.equal(
      validateApiSecurity({ nodeEnv: 'production', apiEnabled: true, token: '' }).length,
      1,
      'Production must reject a missing token',
    );
    assert.equal(
      validateApiSecurity({
        nodeEnv: 'production',
        apiEnabled: true,
        token: 'dev-scraper-api-token',
      }).length,
      1,
      'Production must reject the development placeholder token',
    );
    assert.equal(
      validateApiSecurity({ nodeEnv: 'production', apiEnabled: true, token: 'short' }).length,
      1,
      'Production must reject a token below the length floor',
    );
    assert.equal(
      validateApiSecurity({
        nodeEnv: 'production',
        apiEnabled: true,
        token: 'x'.repeat(MIN_API_TOKEN_LENGTH) + '-ok',
      }).length,
      0,
      'A long token is accepted',
    );
    assert.deepEqual(
      validateApiSecurity({ nodeEnv: 'production', apiEnabled: false, token: '' }),
      [],
      'A disabled API needs no token',
    );

    console.log('✓ validateApiSecurity fails closed in production, stays permissive in development');
  }

  // 11. Token comparison and header parsing helpers.
  {
    assert.equal(tokensMatch('abc', 'abc'), true);
    assert.equal(tokensMatch('abc', 'abd'), false);
    assert.equal(tokensMatch('abc', 'abcd'), false, 'Different lengths must not match');
    assert.equal(tokensMatch('', ''), false, 'Empty must never match');
    assert.equal(tokensMatch('abc', ''), false);

    assert.equal(extractToken({ authorization: 'Bearer xyz' }), 'xyz');
    assert.equal(extractToken({ authorization: 'bearer xyz' }), 'xyz', 'Scheme is case-insensitive');
    assert.equal(extractToken({ 'x-scraper-api-token': 'xyz' }), 'xyz');
    assert.equal(extractToken({}), '');

    console.log('✓ tokensMatch is length-safe and extractToken handles both headers');
  }


    // 12. The test-only retry hook is absent unless explicitly enabled, and is
  //     still behind authentication when it is.
  //
  //     It exists because the failed-job retry sweep's only production trigger
  //     is an hourly cron. The route must not exist in a normal deployment —
  //     not merely be guarded — so the default is asserted first.
  await withServer({ scheduler: makeScheduler(true) }, async (base) => {
    const res = await fetch(`${base}/api/test/retry-failed-jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(res.status, 404, 'the hook must NOT be registered by default');
  });

  await withServer(
    {
      scheduler: makeScheduler(true),
      enableTestHooks: true,
    },
    async (base) => {
      const noAuth = await fetch(`${base}/api/test/retry-failed-jobs`, { method: 'POST' });
      assert.equal(noAuth.status, 401, 'the hook is still behind the shared secret');

      const authed = await fetch(`${base}/api/test/retry-failed-jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      // The stub scheduler exposes no retryFailedJobs, so a 501 proves the
      // route is registered and reachable without inventing a sweep result.
      assert.equal(authed.status, 501, 'registered, reachable, and honest when unsupported');
    },
  );

  console.log('✓ Test-only retry hook: absent by default, authenticated when enabled');

console.log('--- All Scraper Control API Authorization Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
