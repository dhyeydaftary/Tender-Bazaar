/**
 * Boots the REAL Express app (src/app.ts) in a fresh process and reports how
 * its CORS layer answers requests carrying each Origin in PROBE_ORIGINS
 * (comma-separated; `-` means "no Origin header"). Used by
 * cors-policy.test.ts, so what gets asserted is the behaviour of the deployed
 * middleware stack rather than a restatement of the policy.
 *
 * Nothing here touches the database, Redis or Elasticsearch: those clients
 * connect lazily, and GET /api/v1 is a static route.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/* eslint-disable @typescript-eslint/no-var-requires */
// The environment is parsed first, from exactly what this process was given.
// app.ts imports the error handler (and with it @prisma/client, which loads
// the repository's .env into process.env) before its own env import.
require('../../config/env');
const app = require('../../app').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface ProbeResponse {
  status: number;
  allowOrigin: string | null;
  allowCredentials: string | null;
  code: string | null;
}

function request(port: number, method: string, headers: Record<string, string>): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/v1', method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        let code: string | null = null;
        try {
          code = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error?.code ?? null;
        } catch {
          code = null;
        }
        const header = (name: string) => {
          const value = res.headers[name];
          return value === undefined ? null : String(value);
        };
        resolve({
          status: res.statusCode ?? 0,
          allowOrigin: header('access-control-allow-origin'),
          allowCredentials: header('access-control-allow-credentials'),
          code,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;

  const origins = (process.env.PROBE_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const results: Record<string, { get: ProbeResponse; preflight: ProbeResponse }> = {};
  for (const origin of origins) {
    const originHeader: Record<string, string> = origin === '-' ? {} : { Origin: origin };
    const get = await request(port, 'GET', originHeader);
    const preflight = await request(port, 'OPTIONS', {
      ...originHeader,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    });
    results[origin] = { get, preflight };
  }

  // morgan writes its access-log lines asynchronously; let them flush so the
  // JSON report is the LAST line of stdout, which is what run-probe reads.
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(JSON.stringify(results));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
