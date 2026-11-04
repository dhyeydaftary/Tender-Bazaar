import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { buildHealthReport, healthHttpStatus } from '../shared/health';
import { runProbe } from './probes/run-probe';

/**
 * Health reporting and startup ordering for a hosted deployment.
 *
 * Two audit findings: /health answered 503 whenever Elasticsearch was down,
 * although tender search falls back to PostgreSQL, so a platform health check
 * would have pulled a working API out of service; and the entry point ran the
 * index setup and a full reindex BEFORE opening the port, so a slow or absent
 * cluster delayed or (on failure) killed the boot. Section 1 pins the report
 * mapping, section 2 drives the real app's health endpoints, section 3 runs
 * the real entry point and measures when the port answers.
 */

console.log('--- Starting Health & Startup Tests ---');

const ok = () => Promise.resolve();
const fail = () => Promise.reject(new Error('down'));
const CLOSED_PORT_ES = 'http://127.0.0.1:1';

/** A TCP port that is free right now, for the entry point to listen on. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    (server as unknown as NodeJS.EventEmitter).on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** No secrets here; development mode with the data layer stubbed. */
const BASE_ENV = {
  NODE_ENV: 'development',
  ELASTICSEARCH_URL: CLOSED_PORT_ES,
};

async function main(): Promise<void> {
  // 1. Essential vs optional dependencies.
  {
    const allUp = await buildHealthReport({ database: ok, redis: ok, elasticsearch: async () => 'healthy' }, 1);
    assert.equal(allUp.status, 'ok');
    assert.equal(allUp.search, 'elasticsearch');
    assert.equal(healthHttpStatus(allUp), 200);

    const esDown = await buildHealthReport({ database: ok, redis: ok, elasticsearch: () => Promise.reject(new Error('x')) }, 1);
    assert.equal(esDown.status, 'degraded', 'an optional dependency only degrades');
    assert.equal(esDown.search, 'postgresql');
    assert.equal(healthHttpStatus(esDown), 200, 'degraded is NOT a 503');

    const esDisabled = await buildHealthReport({ database: ok, redis: ok, elasticsearch: fail as any, elasticsearchEnabled: false }, 1);
    assert.equal(esDisabled.services.elasticsearch, 'disabled', 'not probed when switched off');
    assert.equal(esDisabled.status, 'degraded');
    assert.equal(esDisabled.search, 'postgresql');

    const dbDown = await buildHealthReport({ database: fail, redis: ok, elasticsearch: async () => 'healthy' }, 1);
    assert.equal(dbDown.status, 'unhealthy');
    assert.equal(healthHttpStatus(dbDown), 503, 'an essential failure is a 503');

    const redisDown = await buildHealthReport({ database: ok, redis: fail, elasticsearch: async () => 'healthy' }, 1);
    assert.equal(redisDown.status, 'unhealthy', 'Redis holds revocations, OTP state and queues: essential');
    assert.equal(healthHttpStatus(redisDown), 503);
    console.log('✓ PostgreSQL and Redis are essential (503); Elasticsearch only degrades (200) or is disabled');
  }

  // 2. The real endpoints.
  {
    const esUnreachable = runProbe('health-probe.ts', BASE_ENV);
    assert.equal(esUnreachable.status, 0, `probe must run: ${esUnreachable.stderr}`);
    const r = esUnreachable.json;
    assert.equal(r.health.status, 200, 'Elasticsearch unreachable: /health still answers 200');
    assert.equal(r.health.body.status, 'degraded');
    assert.equal(r.health.body.services.elasticsearch, 'unhealthy');
    assert.equal(r.health.body.search, 'postgresql');
    assert.equal(r.apiHealth.status, 200, '/api/v1/health shares the handler');
    assert.equal(r.live.status, 200);
    assert.equal(r.live.body.status, 'ok');

    const disabled = runProbe('health-probe.ts', { ...BASE_ENV, ELASTICSEARCH_ENABLED: 'false' });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.equal(disabled.json.health.status, 200);
    assert.equal(disabled.json.health.body.services.elasticsearch, 'disabled');
    assert.equal(disabled.json.health.body.search, 'postgresql');

    const dbDown = runProbe('health-probe.ts', { ...BASE_ENV, PROBE_DB_DOWN: '1' });
    assert.equal(dbDown.status, 0, dbDown.stderr);
    assert.equal(dbDown.json.health.status, 503, 'PostgreSQL down: 503');
    assert.equal(dbDown.json.health.body.status, 'unhealthy');
    assert.equal(dbDown.json.live.status, 200, 'liveness never depends on the database');

    const redisDown = runProbe('health-probe.ts', { ...BASE_ENV, PROBE_REDIS_DOWN: '1' });
    assert.equal(redisDown.json.health.status, 503, 'Redis down: 503');
    console.log('✓ Real app: /health 200 degraded without Elasticsearch, 503 only when PostgreSQL or Redis is down; /health/live always 200');
  }

  // 3. The real entry point: the port opens before any search work, and a
  //    failing cluster neither delays nor kills the process. Needs a Redis for
  //    the BullMQ worker and the alert scheduler (CI provides TEST_REDIS_URL).
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!redisUrl) {
    console.log('↷ Startup-ordering checks skipped: set TEST_REDIS_URL to a disposable Redis to run them');
  } else {
    const port = await freePort();
    const withEs = runProbe('startup-probe.ts', { ...BASE_ENV, REDIS_URL: redisUrl, PORT: String(port) });
    assert.equal(withEs.status, 0, `startup probe must run: ${withEs.stderr}`);
    const s = withEs.json;
    assert.ok(s, withEs.stdout);
    assert.ok(s.listening, 'the entry point announced the listener');
    assert.ok(s.firstResponseMs !== null && s.firstResponseMs < 8000, `the port answered within 8s (took ${s.firstResponseMs}ms) while the index setup was still retrying`);
    assert.ok(s.indexNotReady, 'the unreachable cluster was reported as NOT ready');
    assert.ok(s.searchLogMs !== null && s.searchLogMs > s.firstResponseMs, `the search bootstrap finished after the port opened (${s.searchLogMs}ms > ${s.firstResponseMs}ms)`);
    assert.equal(s.afterSearchStatus, 200, 'still serving after the search bootstrap failed');
    assert.equal(s.healthStatus, 200, '/health is 200 (degraded) with the cluster down');
    assert.ok(s.workerStarted, 'the index worker still starts so queued jobs stay bounded');
    assert.equal(s.failedToInitialize, false, 'no fatal initialisation error');

    const disabled = runProbe('startup-probe.ts', { ...BASE_ENV, ELASTICSEARCH_ENABLED: 'false', REDIS_URL: redisUrl, PORT: String(await freePort()) });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.ok(disabled.json.disabledLog, 'disabled mode is announced');
    assert.equal(disabled.json.indexNotReady, false, 'no cluster is contacted when disabled');
    assert.ok(disabled.json.workerStarted, 'the queue is still drained when disabled');
    assert.equal(disabled.json.afterSearchStatus, 200);
    console.log(`✓ Real startup: port answered in ${s.firstResponseMs}ms, search bootstrap finished at ${s.searchLogMs}ms, process survived; disabled mode skips the cluster`);
  }

  // 4. Source guards on the entry point.
  {
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    assert.ok(src.indexOf('app.listen(PORT') < src.indexOf('void bootstrapSearchIndex()'), 'listen is called before the search bootstrap is started');
    assert.ok(!/await bootstrapSearchIndex/.test(src), 'the search bootstrap is never awaited by bootstrap()');
    assert.match(src, /env\.PORT/, 'the port comes from the environment');
    console.log('✓ Entry point: listen first, search in the background, PORT from the environment');
  }

  console.log('--- All Health & Startup Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
