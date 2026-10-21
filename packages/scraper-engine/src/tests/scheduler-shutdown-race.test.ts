import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import Redis from 'ioredis';

import { ScrapingScheduler } from '../scheduler/scheduler';

/**
 * Regression test for the BullMQ RedisConnection shutdown race.
 *
 * THE DEFECT
 *
 * `ScrapingScheduler.stop()` could close a BullMQ component while its Redis
 * connection was still `initializing`. In that state
 * `RedisConnection.close()` calls `_client.disconnect()` and then, in its
 * `finally`, `removeAllListeners()` — which destroys the error-forwarding
 * bridge BullMQ installs in `queue-base.js`. The still-pending `init()`
 * promise then rejects with "Connection is closed.", emitted as an 'error'
 * event on a RedisConnection with no listeners left. Node treats that as a
 * fatal uncaught exception and kills the process, so `pnpm test` exited 1.
 *
 * This is exactly how CI run 39225507050 failed, while run 39226205710 passed
 * on the SAME commit — the two diverged ~20ms after the same assertion.
 *
 * WHY THIS TEST USES A PROXY
 *
 * `start()` creates the Worker and QueueEvents connections WITHOUT awaiting
 * them (`startWorker()` and `startQueueEvents()` are called synchronously, and
 * nothing between them and `running = true` awaits Redis). Against a local
 * Redis those connections become ready in well under a millisecond, so a plain
 * "start() then stop()" test reproduces the race only by luck — it flaked at
 * roughly 1-in-5 in CI, which is useless as an assertion and is precisely the
 * test we must not write.
 *
 * So this suite does not race the clock. It puts a TCP proxy in front of the
 * real Redis which holds every new connection for CONNECT_DELAY_MS before
 * dialling upstream. The scheduler is handed an ioredis pointed at the proxy,
 * and because `duplicate()` inherits host and port, the Worker and QueueEvents
 * connections go through it automatically — no scheduler change required.
 * `stop()` is therefore GUARANTEED to be called while those connections are
 * still initialising.
 *
 * HOW FAILURE IS DETECTED
 *
 * The scenario runs in a CHILD PROCESS and the parent asserts on its exit
 * code. The original defect killed the process; catching `uncaughtException`
 * in-process would suppress the very symptom under test and would say nothing
 * about leaked handles. A child that exits 0 on its own, promptly, proves both
 * that no fatal error fired and that nothing kept the event loop alive.
 *
 * ANTI-VACUITY
 *
 * Passing is not enough: the run must be shown to have ENTERED the race. The
 * child reports how long `stop()` took. If the connections had already been
 * ready, `stop()` would return almost immediately; because it must wait for
 * readiness it takes roughly CONNECT_DELAY_MS. The parent asserts that floor,
 * so a test that silently stopped exercising the race fails instead of going
 * green.
 *
 * NOT COVERED — do not read this suite as proving either of these:
 *   * Redis unreachable at shutdown. A never-responding proxy would be
 *     deterministic, but `waitUntilReady()` would never settle, the bounded
 *     wait in stop() would time out, and close() would run while
 *     `initializing` — the original fatal path, still reachable. That residual gap is
 *     real and untested here.
 *   * Concurrent stop(). `running` flips to false only at the end of stop()
 *     and there is no re-entrancy guard, so a signal arriving during an admin
 *     stop runs teardown twice. Not exercised here.
 *
 * Requires a REAL Redis (BullMQ has no in-memory mode). SKIPS when unreachable.
 *   TEST_REDIS_URL=redis://127.0.0.1:56379
 *
 * No portal is contacted and no notification is sent: no scrape handler is
 * registered, the missed-window sweep is disabled, and no job is ever enqueued.
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379';

/**
 * How long the proxy holds each new connection before dialling the real Redis.
 *
 * Hardcoded on purpose. It must stay comfortably BELOW the bounded wait in
 * `stop()` (`SHUTDOWN_READY_TIMEOUT_MS`, 5_000 ms, module-private in
 * scheduler.ts and deliberately not exported just for a test). If that
 * constant is ever lowered below this value, the connections will stop
 * becoming ready in time and this suite will begin exercising the TIMEOUT path
 * instead of the readiness path — the assertion below would still fail loudly
 * rather than pass vacuously, which is the point.
 */
const CONNECT_DELAY_MS = 750;

/**
 * `stop()` must have BLOCKED waiting for an initialising connection. With a
 * CONNECT_DELAY_MS proxy it should take roughly that long; if the connections
 * were already ready it would return in a few milliseconds. The floor is set
 * below CONNECT_DELAY_MS to absorb scheduler slop while still being far above
 * the "already ready" case.
 */
const MIN_BLOCKING_STOP_MS = 500;

/** A child that has not exited by now has leaked a handle or hung in stop(). */
const CHILD_TIMEOUT_MS = 30_000;

const CHILD_FLAG = 'TB_SHUTDOWN_RACE_CHILD';
const CHILD_REDIS_URL = 'TB_SHUTDOWN_RACE_REDIS_URL';

interface ChildReport {
  stopMs: number;
  neverStartedStopMs: number;
}

// ─── Child: the scenario under test ──────────────────────────────────────────

async function runChild(): Promise<void> {
  const url = process.env[CHILD_REDIS_URL];
  if (!url) throw new Error(`${CHILD_REDIS_URL} is not set`);

  // Case 1 — stop() while the Worker/QueueEvents connections are initialising.
  const redis = new Redis(url, { maxRetriesPerRequest: 3 });
  const scheduler = new ScrapingScheduler(redis, {
    queueName: `test-shutdown-race-a-${process.pid}`,
    // 0 disables the sweep, so no timer and no catch-up work interferes.
    missedWindowSweepMs: 0,
    concurrency: 1,
  });

  await scheduler.start();
  // No await between the connections being created and here, so they are still
  // inside their CONNECT_DELAY_MS window.
  const startedAt = Date.now();
  await scheduler.stop();
  const stopMs = Date.now() - startedAt;

  // Case 2 — a scheduler that was constructed but never started still owns a
  // Queue and a duplicated connection; stop() must release them.
  const redis2 = new Redis(url, { maxRetriesPerRequest: 3 });
  const neverStarted = new ScrapingScheduler(redis2, {
    queueName: `test-shutdown-race-b-${process.pid}`,
    missedWindowSweepMs: 0,
  });
  const neverStartedAt = Date.now();
  await neverStarted.stop();
  const neverStartedStopMs = Date.now() - neverStartedAt;

  await redis.quit().catch(() => redis.disconnect());
  await redis2.quit().catch(() => redis2.disconnect());

  const report: ChildReport = { stopMs, neverStartedStopMs };
  process.stdout.write(`${JSON.stringify(report)}\n`);

  // Deliberately no process.exit(): exiting naturally IS the assertion that
  // nothing left a handle open.
}

// ─── Parent: proxy, child supervision, assertions ────────────────────────────

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: Number(parsed.port || 6379),
  };
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

interface Proxy {
  port: number;
  close(): Promise<void>;
}

/**
 * A TCP proxy that accepts immediately but waits CONNECT_DELAY_MS before
 * dialling upstream, so anything connecting through it is observably stuck in
 * BullMQ's `initializing` state for that long. It forwards real Redis traffic
 * unmodified once connected: this is a timing double, not a Redis fake.
 */
async function startDelayingProxy(host: string, port: number): Promise<Proxy> {
  const open = new Set<net.Socket>();

  const server = net.createServer((client) => {
    open.add(client);
    client.on('error', () => client.destroy());

    const timer = setTimeout(() => {
      const upstream = net.connect(port, host);
      open.add(upstream);
      upstream.on('error', () => {
        client.destroy();
        upstream.destroy();
      });
      upstream.on('close', () => open.delete(upstream));
      client.pipe(upstream);
      upstream.pipe(client);
    }, CONNECT_DELAY_MS);

    client.on('close', () => {
      clearTimeout(timer);
      open.delete(client);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as net.AddressInfo;

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of open) socket.destroy();
        open.clear();
        server.close(() => resolve());
      }),
  };
}

interface ChildResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs THIS file again as a child, flagged into child mode. The parent must
 * stay asynchronous — a synchronous spawn would block this process's event
 * loop and the proxy above would never accept a connection.
 */
function runChildProcess(raceUrl: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    // `node --import tsx <file>` rather than the `npx` shim: npx needs a shell
    // on Windows, and this repository's path contains spaces.
    const child = spawn(process.execPath, ['--import', 'tsx', __filename], {
      env: { ...process.env, [CHILD_FLAG]: '1', [CHILD_REDIS_URL]: raceUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new Error(
          `the child did not exit within ${CHILD_TIMEOUT_MS}ms — shutdown hung or a handle leaked`,
        ),
      );
    }, CHILD_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** The child logs scheduler output too, so take the last JSON line. */
function parseReport(stdout: string): ChildReport {
  const line = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{') && l.endsWith('}'))
    .pop();
  assert.ok(line, `the child printed no report. stdout was:\n${stdout}`);
  return JSON.parse(line) as ChildReport;
}

/** Remove only this suite's own queue keys from the disposable Redis. */
async function cleanupQueueKeys(): Promise<void> {
  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 3 });
  try {
    const keys = await redis.keys('bull:test-shutdown-race-*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Best effort: leaving a few keys in a disposable Redis is not a failure.
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function runParent(): Promise<void> {
  console.log('--- Starting Scheduler Shutdown Race Tests ---');

  if (!(await redisReachable())) {
    console.log(`! SKIPPED: no Redis at ${TEST_REDIS_URL}`);
    console.log('--- Scheduler Shutdown Race Tests SKIPPED ---');
    return;
  }

  const { host, port } = parseRedisUrl(TEST_REDIS_URL);
  const proxy = await startDelayingProxy(host, port);

  try {
    const result = await runChildProcess(`redis://127.0.0.1:${proxy.port}`);

    // The defect's signature: an 'error' event on a RedisConnection whose
    // listeners were already removed. Note we do NOT assert the absence of
    // "Connection is closed." itself — the scheduler legitimately LOGS that
    // through its own worker/queue-events error handlers, and did so even in
    // the run that passed. Only the unhandled emit is a failure.
    assert.ok(
      !/Emitted 'error' event on RedisConnection/.test(result.stderr),
      `the unhandled RedisConnection error reappeared:\n${result.stderr}`,
    );
    assert.equal(
      result.code,
      0,
      `the child exited ${result.code}; shutdown was not clean:\n${result.stderr}`,
    );

    const report = parseReport(result.stdout);

    // Anti-vacuity: prove this run actually sat inside the race window.
    assert.ok(
      report.stopMs >= MIN_BLOCKING_STOP_MS,
      `stop() returned in ${report.stopMs}ms, below the ${MIN_BLOCKING_STOP_MS}ms floor — ` +
        `the connections were already ready, so this run did NOT exercise the ` +
        `initialisation race (proxy delay ${CONNECT_DELAY_MS}ms). The test would ` +
        `have passed for the wrong reason.`,
    );

    console.log(
      `✓ stop() during connection initialisation completes cleanly ` +
        `(blocked ${report.stopMs}ms on readiness, exit 0, no unhandled Redis error)`,
    );

    assert.equal(
      typeof report.neverStartedStopMs,
      'number',
      'the child must report the never-started case',
    );
    console.log(
      `✓ A scheduler that was never started releases its queue and connections ` +
        `(stop() took ${report.neverStartedStopMs}ms)`,
    );

    console.log('✓ The child exited on its own, so no handle was leaked');
  } finally {
    await proxy.close();
    await cleanupQueueKeys();
  }

  console.log('--- All Scheduler Shutdown Race Tests Passed ---');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (process.env[CHILD_FLAG] === '1') {
  void runChild().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
} else {
  void runParent().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
