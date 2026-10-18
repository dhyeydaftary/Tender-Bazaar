import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import { createAdminApi, type TriggerRunOutcome } from '../api/server';
import type { StorageWriter } from '../storage/writer';

/**
 * POST /api/portals/:key/run must report what actually happened.
 *
 * Phase 8, live on the staging stack: a manual trigger arrived while the
 * per-portal lock was held by a pending retry. The scheduler did the right
 * thing —
 *
 *   [Scheduler] Skipping testportal (manual) - a run is already queued or in progress
 *
 * — and no duplicate run record, queue entry or HTTP request to the portal was
 * produced. But the API answered:
 *
 *   HTTP 200 {"success":true,"data":{"message":"Scraping job queued for LocalTestPortal"}}
 *
 * because the handler discarded `onTriggerRun`'s return value (which was typed
 * `Promise<void>`, so there was nothing to discard). An operator pressing "run
 * now" in the admin UI was told the job was queued when nothing had been.
 *
 * The invariant pinned here: the API never claims a successful enqueue unless a
 * job was genuinely queued.
 */

const TOKEN = 'phase9-manual-run-token-0123456789';

console.log('--- Starting Manual-Run Response Tests ---');

/** Minimal StorageWriter surface the admin API touches. */
const storageWriter = {
  async getAllHealth() {
    return [];
  },
  async getRecentRuns() {
    return [];
  },
} as unknown as StorageWriter;

const scheduler = {
  isRunning: true,
  registeredCronCount: 3,
  isPaused: false,
  async getQueueStatus() {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  },
};

async function withServer(
  onTriggerRun: (portalKey: string) => Promise<TriggerRunOutcome>,
  body: (base: string) => Promise<void>,
): Promise<void> {
  const { app } = createAdminApi({
    storageWriter,
    scheduler: scheduler as never,
    onTriggerRun,
    authToken: TOKEN,
    allowedOrigins: [],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await body(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function post(base: string, key = 'gem'): Promise<Response> {
  return fetch(`${base}/api/portals/${key}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

async function main(): Promise<void> {
  // 1. A genuine enqueue: 202, success, status 'queued', job id passed through.
  await withServer(
    async () => ({ status: 'queued', jobId: 'scrape-gem-123' }),
    async (base) => {
      const res = await post(base);
      const body = (await res.json()) as {
        success: boolean;
        data?: { status?: string; jobId?: string; message?: string };
      };

      assert.equal(res.status, 202, 'a queued run is 202 Accepted');
      assert.equal(body.success, true);
      assert.equal(body.data?.status, 'queued');
      assert.equal(body.data?.jobId, 'scrape-gem-123');
      assert.match(String(body.data?.message), /queued/i);

      console.log('✓ A genuine enqueue returns 202 with status `queued` and the job id');
    },
  );

  // 2. THE REGRESSION: a refusal must never look like a success.
  await withServer(
    async () => ({ status: 'already-running', jobId: 'scrape-gem-earlier' }),
    async (base) => {
      const res = await post(base);
      const body = (await res.json()) as {
        success: boolean;
        error?: { code?: string; message?: string };
        data?: { status?: string; jobId?: string };
      };

      assert.equal(res.status, 409, 'a refused run must be 409 Conflict, not 200');
      assert.equal(body.success, false, 'success must be false when nothing was queued');
      assert.equal(body.error?.code, 'RUN_ALREADY_IN_PROGRESS');
      assert.match(
        String(body.error?.message),
        /already queued or in progress/i,
        'the message must say why',
      );
      assert.match(
        String(body.error?.message),
        /no new job was queued/i,
        'and must state plainly that nothing was queued',
      );
      assert.equal(body.data?.status, 'already-running');
      assert.equal(body.data?.jobId, 'scrape-gem-earlier');

      // The exact phrasing that misled an operator must not appear anywhere.
      const raw = JSON.stringify(body);
      assert.ok(
        !/"message":"Scraping job queued/.test(raw),
        'the response must not claim the job was queued',
      );

      console.log('✓ A refused run returns 409 and never claims the job was queued');
    },
  );

  // 3. Scheduler down: the scrape runs in-process, reported distinctly rather
  //    than as a queue enqueue.
  await withServer(
    async () => ({ status: 'started-inline' }),
    async (base) => {
      const res = await post(base);
      const body = (await res.json()) as {
        success: boolean;
        data?: { status?: string; jobId?: string; message?: string };
      };

      assert.equal(res.status, 202);
      assert.equal(body.success, true);
      assert.equal(body.data?.status, 'started-inline');
      assert.equal(body.data?.jobId, undefined, 'there is no queue job to report');
      assert.match(String(body.data?.message), /in-process/i);

      console.log('✓ An in-process run is reported as `started-inline`, not as a queue enqueue');
    },
  );

  // 4. Authentication and the unknown-portal guard are unchanged.
  await withServer(
    async () => ({ status: 'queued' }),
    async (base) => {
      const noAuth = await fetch(`${base}/api/portals/gem/run`, { method: 'POST' });
      assert.equal(noAuth.status, 401, 'an unauthenticated trigger is still rejected');

      const unknown = await post(base, 'does-not-exist');
      assert.equal(unknown.status, 404, 'an unknown portal is still 404');

      console.log('✓ Authentication and the unknown-portal guard are preserved');
    },
  );

  // 5. Every outcome is covered: the mapping has no silent default that could
  //    reintroduce "report success regardless".
  {
    const statuses: Array<TriggerRunOutcome['status']> = [
      'queued',
      'already-running',
      'started-inline',
    ];
    const seen: Record<string, number> = {};

    for (const status of statuses) {
      await withServer(
        async () => ({ status } as TriggerRunOutcome),
        async (base) => {
          const res = await post(base);
          seen[status] = res.status;
        },
      );
    }

    assert.deepEqual(seen, {
      queued: 202,
      'already-running': 409,
      'started-inline': 202,
    });

    console.log('✓ All three outcomes map to distinct, correct HTTP statuses');
  }

  console.log('--- All Manual-Run Response Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
