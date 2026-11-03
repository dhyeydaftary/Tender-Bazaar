/**
 * Runs the REAL entry point (src/index.ts, bootstrap and all) with PostgreSQL
 * replaced in-process, a real Redis (REDIS_URL, for the BullMQ worker and the
 * alert scheduler) and Elasticsearch either disabled or pointed at a closed
 * port. Reports how long the HTTP listener took to answer, what the search
 * bootstrap logged afterwards, and that the process was still alive to tell.
 * Used by health-and-startup.test.ts.
 */
import http from 'node:http';
import { makeFakePrisma, makeFakeRedis, injectModule } from './fake-prisma';

const startedAt = Date.now();
const port = Number(process.env.PORT);

const db = makeFakePrisma([]);
injectModule('../../config/database', { prisma: db.prisma, default: db.prisma });
const redis = makeFakeRedis();
injectModule('../../config/redis', { redis, default: redis });

const lines: string[] = [];
const original = { log: console.log, error: console.error, warn: console.warn };
for (const level of ['log', 'warn', 'error'] as const) {
  console[level] = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}

/* eslint-disable @typescript-eslint/no-var-requires */
require('../../config/env');
require('../../index');
/* eslint-enable @typescript-eslint/no-var-requires */

function ping(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    http
      .get({ host: '127.0.0.1', port, path, timeout: 1000 }, (res) => {
        res.resume();
        resolve(res.statusCode ?? null);
      })
      .on('error', () => resolve(null))
      .on('timeout', () => resolve(null));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. How long until the port answers?
  let firstResponseMs: number | null = null;
  for (let i = 0; i < 150; i++) {
    if ((await ping('/api/v1')) === 200) {
      firstResponseMs = Date.now() - startedAt;
      break;
    }
    await sleep(100);
  }

  // 2. Wait for the search bootstrap to report, which happens AFTER the port
  //    is open (or not at all when it is disabled).
  const done = (text: string) =>
    /Elasticsearch index NOT ready|Elasticsearch index ready|Elasticsearch is disabled|Elasticsearch bootstrap failed/.test(text);
  let searchLogMs: number | null = null;
  for (let i = 0; i < 300; i++) {
    if (done(lines.join('\n'))) {
      searchLogMs = Date.now() - startedAt;
      break;
    }
    await sleep(100);
  }

  // 3. Still serving after the search bootstrap finished (or failed)?
  await sleep(300);
  const afterSearch = await ping('/api/v1');
  const health = await ping('/health');

  const text = lines.join('\n');
  original.log(
    JSON.stringify({
      firstResponseMs,
      searchLogMs,
      afterSearchStatus: afterSearch,
      healthStatus: health,
      indexNotReady: /Elasticsearch index NOT ready/.test(text),
      disabledLog: /Elasticsearch is disabled/.test(text),
      workerStarted: /\[TenderIndexWorker\] Started/.test(text),
      listening: /API Server running on port/.test(text),
      failedToInitialize: /Failed to initialize API/.test(text),
      uploadWarning: /local filesystem, which is ephemeral/.test(text),
    }),
  );
  process.exit(0);
})().catch((err) => {
  original.error(err);
  process.exit(1);
});
