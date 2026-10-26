import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { DEMO_PORTALS } from '../demo/demo-portals';
import { DemoRunner, type DemoRunStoreLike } from '../demo/demo-runner';
import { createDemoApi } from '../demo/demo-server';

/**
 * Demo scraper control API: authentication, health/readiness, and the response
 * shapes api-server's triggerScraper() depends on (2xx = triggered, 409 =
 * refused without queue fallback, 401 = token mismatch).
 */

console.log('--- Starting Demo Scraper API Tests ---');

const TOKEN = 'demo-scraper-test-token-0123456789';

/** Response bodies are asserted field by field below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bodyOf = async (res: Response): Promise<any> => res.json();

function makeRunner(): DemoRunner {
  let next = 0;
  const store: DemoRunStoreLike = {
    isPortalEnabled: async () => true,
    createRun: async () => `run-${++next}`,
    startRun: async () => undefined,
    recordProgress: async () => undefined,
    completeRun: async () => undefined,
    failRun: async () => undefined,
    cancelRun: async () => undefined,
  };
  // Runs stay active until released, so a second trigger meets the lock.
  return new DemoRunner({
    store,
    portals: DEMO_PORTALS,
    concurrency: 2,
    startDelayMs: [0, 0],
    pageDelayMs: [0, 0],
    sleep: () => new Promise<void>(() => undefined),
  });
}

async function listen(app: ReturnType<typeof createDemoApi>): Promise<{ server: Server; base: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function main() {
  let dbUp = true;
  const app = createDemoApi({
    runner: makeRunner(),
    ping: async () => {
      if (!dbUp) throw new Error('db down');
    },
    authToken: TOKEN,
    scheduleEnabled: false,
  });
  const { server, base } = await listen(app);
  const auth = { Authorization: `Bearer ${TOKEN}` };

  try {
    // Health and readiness are public and identify the engine as a demo.
    {
      const res = await fetch(`${base}/api/health`);
      assert.equal(res.status, 200);
      const body = await bodyOf(res);
      assert.equal(body.data.mode, 'demo');
      assert.equal(body.data.simulated, true);
      assert.equal(body.data.totalPortals, DEMO_PORTALS.length);
      assert.match(body.data.notice, /No external tender portal is contacted/);

      const ready = await fetch(`${base}/api/ready`);
      assert.equal(ready.status, 200);
      assert.equal((await bodyOf(ready)).data.ready, true);

      dbUp = false;
      const notReady = await fetch(`${base}/api/ready`);
      assert.equal(notReady.status, 503);
      assert.equal((await bodyOf(notReady)).data.reason, 'database is unreachable');
      dbUp = true;
      console.log('  ✓ /api/health and /api/ready are public, accurate and report demo mode');
    }

    // Everything else requires the shared token.
    {
      const noToken = await fetch(`${base}/api/portals/gem-demo/run`, { method: 'POST' });
      assert.equal(noToken.status, 401);
      const wrong = await fetch(`${base}/api/portals/gem-demo/run`, {
        method: 'POST',
        headers: { Authorization: 'Bearer not-the-token' },
      });
      assert.equal(wrong.status, 401);
      const portals = await fetch(`${base}/api/portals`);
      assert.equal(portals.status, 401);
      const viaHeader = await fetch(`${base}/api/portals`, { headers: { 'X-Scraper-Api-Token': TOKEN } });
      assert.equal(viaHeader.status, 200);
      const preflight = await fetch(`${base}/api/portals`, { method: 'OPTIONS' });
      assert.equal(preflight.status, 403);
      console.log('  ✓ control endpoints require the bearer token; CORS preflights are refused');
    }

    // Run trigger: 202 with the real engine's fields plus simulated markers.
    {
      const res = await fetch(`${base}/api/portals/gem-demo/run`, { method: 'POST', headers: auth });
      assert.equal(res.status, 202);
      const body = await bodyOf(res);
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'queued');
      assert.equal(body.data.portal, 'GeM-Demo');
      assert.equal(typeof body.data.jobId, 'string');
      assert.equal(body.data.simulated, true);
      assert.equal(body.data.mode, 'demo');
      assert.match(body.data.message, /^Simulated scraping run queued for GeM-Demo$/);
      assert.ok(!Number.isNaN(Date.parse(body.data.triggeredAt)));

      const again = await fetch(`${base}/api/portals/gem-demo/run`, { method: 'POST', headers: auth });
      assert.equal(again.status, 409);
      const refused = await bodyOf(again);
      assert.equal(refused.error.code, 'RUN_ALREADY_IN_PROGRESS');
      assert.equal(refused.data.jobId, body.data.jobId);
      console.log('  ✓ run trigger answers 202 (queued, simulated) then 409 RUN_ALREADY_IN_PROGRESS');
    }

    // Real portal keys are not served.
    {
      for (const key of ['gem', 'cppp', 'GeM-Demo']) {
        const res = await fetch(`${base}/api/portals/${key}/run`, { method: 'POST', headers: auth });
        assert.equal(res.status, 404, `key "${key}" must be unknown`);
        assert.equal((await bodyOf(res)).error.code, 'DEMO_PORTAL_NOT_FOUND');
      }
      console.log('  ✓ real portal keys (and non-lowercase names) answer 404');
    }

    // Controls the demo does not implement say so instead of pretending.
    {
      for (const path of ['/api/scheduler/start', '/api/scheduler/stop', '/api/portals/gem-demo/toggle']) {
        const res = await fetch(`${base}${path}`, { method: 'POST', headers: auth });
        assert.equal(res.status, 501, path);
        assert.equal((await bodyOf(res)).error.code, 'NOT_AVAILABLE_IN_DEMO');
      }
      const portals = await bodyOf(await fetch(`${base}/api/portals`, { headers: auth }));
      assert.ok(portals.data.every((p: { simulated: boolean; name: string }) => p.simulated && p.name.endsWith('-Demo')));
      console.log('  ✓ scheduler/toggle endpoints answer 501; portal list is all -Demo, all simulated');
    }
  } finally {
    server.close();
  }

  console.log('--- Demo Scraper API Tests passed ---');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
