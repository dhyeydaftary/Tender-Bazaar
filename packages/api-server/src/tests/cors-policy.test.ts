import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCorsPolicy, isOriginAllowed, DEV_ORIGINS } from '../shared/middleware/cors-policy';
import { runProbe } from './probes/run-probe';

/**
 * Cross-origin access to the API.
 *
 * Production must answer credentialed browser requests only from the origins
 * it was explicitly configured with (FRONTEND_URL, ADMIN_URL, CORS_ORIGINS):
 * never a wildcard, never a visitor's own localhost, and never because
 * NODE_ENV happened to be unset. The local origins stay available for an
 * explicit NODE_ENV=development. Sections 1-2 pin the policy function,
 * section 3 checks app.ts is wired to it, and section 4 boots the real
 * Express app in fresh processes and sends requests with real Origin headers.
 */

console.log('--- Starting CORS Policy Tests ---');

const FRONTEND = 'https://app.tenderbazaar.example';
const ADMIN = 'https://admin.tenderbazaar.example';
const EXTRA = 'https://tenderbazaar.vercel.app';
const EXTRA_2 = 'https://www.tenderbazaar.example';

/** A complete, valid production environment; none of these are real values. */
const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  RENDER: 'true',
  DATABASE_URL: 'postgresql://app:Real-Db-Pass-123@db.internal:5432/tenderbazaar',
  REDIS_URL: 'rediss://default:Real-Redis-Pass-456@redis.internal:6379',
  JWT_SECRET: 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE',
  JWT_REFRESH_SECRET: 'Z5tR8yHn2kQw7vXp4LmB9cJ3dFgS6aTe',
  FRONTEND_URL: FRONTEND,
  ADMIN_URL: ADMIN,
  // A trailing slash is tolerated in configuration and normalised away.
  CORS_ORIGINS: `${EXTRA}, ${EXTRA_2}/`,
};

const UNTRUSTED = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://localhost:3000',
  'https://evil.example',
  `${FRONTEND}.evil.example`,
  'http://app.tenderbazaar.example',
  'https://*.vercel.app',
];

// 1. Production policy: exactly the configured origins.
{
  const policy = buildCorsPolicy({
    frontendUrl: FRONTEND,
    adminUrl: `${ADMIN}/`,
    extraOrigins: [EXTRA, '*', 'https://*.vercel.app', ''],
    developmentShortcuts: false,
  });
  assert.deepEqual(policy.allowedOrigins, [FRONTEND, ADMIN, EXTRA], 'configured origins only, normalised, wildcards dropped');
  assert.equal(policy.allowLoopbackOrigins, false);

  for (const origin of [FRONTEND, ADMIN, EXTRA]) {
    assert.equal(isOriginAllowed(policy, origin), true, `${origin} is trusted`);
  }
  for (const origin of [...UNTRUSTED, 'http://localhost:4000', 'https://app.tenderbazaar.example:8443', 'null', '*']) {
    assert.equal(isOriginAllowed(policy, origin), false, `${origin} is rejected`);
  }
  assert.equal(isOriginAllowed(policy, undefined), true, 'requests without an Origin (curl, server-to-server) are not CORS requests');

  const unconfigured = buildCorsPolicy({ developmentShortcuts: false });
  assert.deepEqual(unconfigured.allowedOrigins, []);
  assert.equal(isOriginAllowed(unconfigured, 'http://localhost:3000'), false, 'nothing configured means nothing trusted, not everything');
  console.log('✓ Production trusts exactly the configured origins; wildcards and loopback are never trusted');
}

// 2. Development policy: the local origins and any loopback port, on top of
//    whatever is configured.
{
  const policy = buildCorsPolicy({ frontendUrl: 'http://localhost:3000', developmentShortcuts: true });
  for (const origin of [...DEV_ORIGINS, 'http://localhost:5173', 'http://127.0.0.1:8080']) {
    assert.equal(isOriginAllowed(policy, origin), true, `${origin} works in development`);
  }
  assert.equal(isOriginAllowed(policy, 'https://evil.example'), false, 'development still rejects foreign origins');
  assert.equal(isOriginAllowed(policy, 'http://evil.example:3000'), false);
  console.log('✓ Development keeps the local origins working');
}

// 3. app.ts is wired to the policy, switched on the RAW NODE_ENV, with no
//    wildcard or reflect-anything configuration.
{
  const appSrc = readFileSync(join(__dirname, '..', 'app.ts'), 'utf8');
  assert.ok(
    appSrc.includes('developmentShortcuts: DEVELOPMENT_SHORTCUTS_ENABLED'),
    'development origins must follow DEVELOPMENT_SHORTCUTS_ENABLED (an explicit NODE_ENV=development)',
  );
  assert.ok(appSrc.includes('isOriginAllowed(corsPolicy, origin)'), 'the cors middleware must consult the policy');
  assert.ok(appSrc.includes('credentials: true'), 'requests are credentialed, which is why the origin list has to be exact');
  assert.ok(!/origin:\s*(true|'\*'|"\*")/.test(appSrc), 'no reflect-any-origin or wildcard configuration');
  assert.ok(!/NODE_ENV\s*!==\s*'production'/.test(appSrc), "no 'anything but production' CORS shortcut: unset NODE_ENV must not widen CORS");
  console.log('✓ app.ts uses the policy with the explicit-development switch');
}

// 4. The real app, in fresh processes.
{
  const trusted = [FRONTEND, ADMIN, EXTRA, EXTRA_2];
  const origins = ['-', ...trusted, ...UNTRUSTED];
  const prod = runProbe('cors-probe.ts', { ...PRODUCTION_ENV, PROBE_ORIGINS: origins.join(',') });
  assert.equal(prod.status, 0, `the production app must start: ${prod.stderr}`);
  const r = prod.json;
  assert.ok(r, `the probe must report results, got: ${prod.stdout}`);

  // No Origin header: a plain request, served without any CORS grant.
  assert.equal(r['-'].get.status, 200);
  assert.equal(r['-'].get.allowOrigin, null);

  for (const origin of trusted) {
    assert.equal(r[origin].get.status, 200, `${origin}: request served`);
    assert.equal(r[origin].get.allowOrigin, origin, `${origin}: granted exactly, never *`);
    assert.equal(r[origin].get.allowCredentials, 'true');
    assert.equal(r[origin].preflight.status, 204, `${origin}: preflight accepted`);
    assert.equal(r[origin].preflight.allowOrigin, origin);
  }
  for (const origin of UNTRUSTED) {
    assert.equal(r[origin].get.status, 403, `${origin}: rejected before any route runs`);
    assert.equal(r[origin].get.code, 'CORS_ORIGIN_DENIED');
    assert.equal(r[origin].get.allowOrigin, null, `${origin}: no grant header`);
    assert.equal(r[origin].preflight.status, 403, `${origin}: preflight rejected`);
    assert.equal(r[origin].preflight.allowOrigin, null);
  }

  // Development: the local origins work, any loopback port works, foreign
  // origins still do not.
  const devOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:5173', 'https://evil.example'];
  const dev = runProbe('cors-probe.ts', { NODE_ENV: 'development', PROBE_ORIGINS: devOrigins.join(',') });
  assert.equal(dev.status, 0, `the development app must start: ${dev.stderr}`);
  for (const origin of devOrigins.slice(0, 3)) {
    assert.equal(dev.json[origin].get.status, 200, `${origin}: development allows it`);
    assert.equal(dev.json[origin].get.allowOrigin, origin);
  }
  assert.equal(dev.json['https://evil.example'].get.status, 403);

  // Unset NODE_ENV: the default FRONTEND_URL (localhost:3000) is trusted, but
  // the development-only any-loopback allowance is NOT switched on.
  const unset = runProbe('cors-probe.ts', { PROBE_ORIGINS: 'http://localhost:3000,http://localhost:5173' });
  assert.equal(unset.status, 0, `a bare checkout must start: ${unset.stderr}`);
  assert.equal(unset.json['http://localhost:3000'].get.status, 200);
  assert.equal(unset.json['http://localhost:5173'].get.status, 403, 'unset NODE_ENV must not enable the any-loopback allowance');

  console.log('✓ Real app: production grants exactly the configured origins and rejects localhost, foreign and wildcard origins; development keeps local origins');
}

console.log('--- All CORS Policy Tests Passed ---');
