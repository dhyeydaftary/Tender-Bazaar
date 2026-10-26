import assert from 'node:assert/strict';

import {
  engineBaseUrls,
  fetchEngineStatus,
  requestEngineRun,
} from '../modules/admin/services/scraper-engine-client';

/**
 * api-server → scraper engine control-API client.
 *
 * Pins the decision table triggerScraper() relies on, for both the real engine
 * and the demo engine (which adds `simulated: true` to the same 202 body).
 */

console.log('--- Starting Scraper Engine Client Tests ---');

type Call = { url: string; init?: RequestInit };

type FakeResponse = { ok: boolean; status: number; json(): Promise<unknown> };

function json(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fakeFetch(handler: (url: string, init?: RequestInit) => FakeResponse | Promise<FakeResponse>) {
  const calls: Call[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
}

async function main() {
  // URL list: configured first, then the historical fallbacks, de-duplicated.
  assert.deepEqual(engineBaseUrls('http://demo-scraper:4001'), [
    'http://demo-scraper:4001',
    'http://tenderbazaar-scraper:4001',
    'http://localhost:4001',
  ]);
  assert.deepEqual(engineBaseUrls('http://localhost:4001'), ['http://localhost:4001', 'http://tenderbazaar-scraper:4001']);
  console.log('  ✓ engine URL list keeps the configured URL first');

  // Demo engine 202: triggered, simulated, job id carried through, token sent.
  {
    const { impl, calls } = fakeFetch(() =>
      json(202, {
        success: true,
        data: { status: 'queued', jobId: 'run-1', simulated: true, mode: 'demo', message: 'Simulated scraping run queued for GeM-Demo' },
      }),
    );
    const outcome = await requestEngineRun({
      baseUrls: ['http://demo-scraper:4001', 'http://localhost:4001'],
      registryKey: 'gem-demo',
      token: 'tok-0123456789abcdef',
      fetchImpl: impl,
    });
    assert.deepEqual(outcome, {
      kind: 'triggered',
      baseUrl: 'http://demo-scraper:4001',
      jobId: 'run-1',
      simulated: true,
      message: 'Simulated scraping run queued for GeM-Demo',
    });
    assert.equal(calls.length, 1, 'stops at the first engine that accepts');
    assert.equal(calls[0].url, 'http://demo-scraper:4001/api/portals/gem-demo/run');
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer tok-0123456789abcdef');
    console.log('  ✓ demo 202 → triggered with simulated=true and the engine job id');
  }

  // Real engine 202 (no simulated field) and started-inline (no job id).
  {
    const { impl } = fakeFetch(() => json(202, { success: true, data: { status: 'started-inline' } }));
    const outcome = await requestEngineRun({ baseUrls: ['http://scraper:4001'], registryKey: 'gem', token: '', fetchImpl: impl });
    assert.equal(outcome.kind, 'triggered');
    if (outcome.kind === 'triggered') {
      assert.equal(outcome.simulated, false);
      assert.equal(outcome.jobId, undefined);
    }
    console.log('  ✓ real 202 → triggered, simulated=false, no invented job id');
  }

  // 409 refused: never tries another URL.
  {
    const { impl, calls } = fakeFetch(() => json(409, { success: false, error: { code: 'RUN_ALREADY_IN_PROGRESS', message: 'busy' } }));
    const outcome = await requestEngineRun({ baseUrls: ['http://a', 'http://b'], registryKey: 'gem-demo', token: 't', fetchImpl: impl });
    assert.deepEqual(outcome, { kind: 'refused', message: 'busy' });
    assert.equal(calls.length, 1);
    console.log('  ✓ 409 → refused, no further URLs tried');
  }

  // 401: stops, reports unauthorized.
  {
    const { impl, calls } = fakeFetch(() => json(401, { success: false }));
    const outcome = await requestEngineRun({ baseUrls: ['http://a', 'http://b'], registryKey: 'gem-demo', token: 'x', fetchImpl: impl });
    assert.deepEqual(outcome, { kind: 'unauthorized' });
    assert.equal(calls.length, 1);
    console.log('  ✓ 401 → unauthorized, no further URLs tried');
  }

  // Network errors and other statuses fall through to the next URL, then unreachable.
  {
    const { impl, calls } = fakeFetch((url) => {
      if (url.startsWith('http://a')) throw new TypeError('fetch failed');
      return json(404, { success: false });
    });
    const outcome = await requestEngineRun({ baseUrls: ['http://a', 'http://b'], registryKey: 'gem', token: '', fetchImpl: impl });
    assert.deepEqual(outcome, { kind: 'unreachable' });
    assert.equal(calls.length, 2);
    console.log('  ✓ network error / 404 on every URL → unreachable (caller decides; no fake success)');
  }

  // Registry keys are URL-encoded.
  {
    const { impl, calls } = fakeFetch(() => json(202, { data: {} }));
    await requestEngineRun({ baseUrls: ['http://a'], registryKey: 'x/../y', token: '', fetchImpl: impl });
    assert.equal(calls[0].url, 'http://a/api/portals/x%2F..%2Fy/run');
    console.log('  ✓ registry key is URL-encoded');
  }

  // Engine status: demo vs live vs unreachable.
  {
    const demo = await fetchEngineStatus({
      baseUrl: 'http://demo-scraper:4001',
      fetchImpl: async () =>
        json(200, { success: true, data: { mode: 'demo', simulated: true, schedulerRunning: false, enabledPortals: 6, notice: 'simulated' } }),
    });
    assert.equal(demo.reachable, true);
    assert.equal(demo.mode, 'demo');
    assert.equal(demo.simulated, true);
    assert.equal(demo.enabledPortals, 6);
    assert.equal(demo.notice, 'simulated');

    const live = await fetchEngineStatus({
      baseUrl: 'http://scraper:4001',
      fetchImpl: async () => json(200, { success: true, data: { status: 'healthy', schedulerRunning: true, enabledPortals: 3 } }),
    });
    assert.equal(live.mode, 'live');
    assert.equal(live.simulated, false);
    assert.equal(live.schedulerRunning, true);

    const down = await fetchEngineStatus({
      baseUrl: 'http://scraper:4001',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    assert.equal(down.reachable, false);
    assert.equal(down.mode, 'unknown');

    const error = await fetchEngineStatus({ baseUrl: 'http://scraper:4001', fetchImpl: async () => json(500, {}) });
    assert.equal(error.reachable, false);
    console.log('  ✓ engine status distinguishes demo, live and unreachable engines');
  }

  console.log('--- Scraper Engine Client Tests passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
