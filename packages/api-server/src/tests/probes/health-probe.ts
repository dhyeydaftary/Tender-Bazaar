/**
 * Boots the real Express app with PostgreSQL and Redis replaced in-process and
 * Elasticsearch pointed at a closed port, then reports what /health,
 * /api/v1/health and /health/live answer. PROBE_DB_DOWN=1 makes the database
 * probe fail; ELASTICSEARCH_ENABLED comes from the environment like any other
 * setting. Used by health-and-startup.test.ts.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { makeFakePrisma, makeFakeRedis, injectModule } from './fake-prisma';

const db = makeFakePrisma([]);
if (process.env.PROBE_DB_DOWN === '1') {
  db.prisma.$queryRaw = async () => {
    throw new Error('connection refused');
  };
}
injectModule('../../config/database', { prisma: db.prisma, default: db.prisma });
const redis = makeFakeRedis();
if (process.env.PROBE_REDIS_DOWN === '1') {
  redis.ping = async () => {
    throw new Error('connection refused');
  };
}
injectModule('../../config/redis', { redis, default: redis });

/* eslint-disable @typescript-eslint/no-var-requires */
require('../../config/env');
const app = require('../../app').default;
/* eslint-enable @typescript-eslint/no-var-requires */

function get(port: number, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          let body: any = null;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            body = null;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      })
      .on('error', reject);
  });
}

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;

  const [health, apiHealth, live] = await Promise.all([
    get(port, '/health'),
    get(port, '/api/v1/health'),
    get(port, '/health/live'),
  ]);

  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(JSON.stringify({ health, apiHealth, live }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
