import assert from 'node:assert/strict';
import { envSchema, parseRedisUrl, validateDeploymentEnvironment, validateProductionConnections } from '../config/env';
import { runProbe } from './probes/run-probe';

/**
 * Production REDIS_URL validation, including Render's default internal URL.
 *
 * Render Key Value hands out an internal connection URL with no credentials
 * (`redis://<host>:6379`) unless internal authentication is switched on. The
 * production check used to refuse any Redis URL without a password, which
 * rejected that legitimate configuration outright. It now accepts an
 * unauthenticated URL only with the explicit opt-in
 * REDIS_ALLOW_UNAUTHENTICATED=true, and keeps refusing placeholder passwords,
 * malformed URLs and loopback hosts whatever the flag says. Nothing is
 * inferred from the hostname.
 */

console.log('--- Starting Redis Connection Validation Tests ---');

const STRONG_A = 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE';
const STRONG_B = 'Z5tR8yHn2kQw7vXp4LmB9cJ3dFgS6aTe';
const RENDER_INTERNAL = 'redis://red-d2abc3def456ghi7jkl8m9n0:6379';

/** A complete production environment apart from Redis; none of these are real values. */
const PROD = {
  NODE_ENV: 'production',
  RENDER: 'true',
  DATABASE_URL: 'postgresql://app:Real-Db-Pass-123@db.internal:5432/tenderbazaar',
  JWT_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
  FRONTEND_URL: 'https://app.tenderbazaar.example',
  ADMIN_URL: 'https://admin.tenderbazaar.example',
  CORS_ORIGINS: '',
  GOOGLE_CLIENT_ID: '',
  ALLOW_DEMO_GOOGLE_AUTH: 'false',
  AI_SERVICE_TOKEN: '',
};

const redisProblems = (input: Record<string, string | undefined>) =>
  validateProductionConnections({ NODE_ENV: 'production', DATABASE_URL: PROD.DATABASE_URL, ...input }).filter((p) =>
    p.startsWith('REDIS_URL:'),
  );

// 1. URL parsing.
{
  assert.deepEqual(parseRedisUrl(RENDER_INTERNAL), { host: 'red-d2abc3def456ghi7jkl8m9n0', username: '', password: null, tls: false });
  assert.deepEqual(parseRedisUrl('rediss://default:S3cret-Value@host:6379'), { host: 'host', username: 'default', password: 'S3cret-Value', tls: true });
  assert.equal(parseRedisUrl('redis://:change%2Dme@host:6379')!.password, 'change-me', 'percent-encoding is decoded');
  assert.equal(parseRedisUrl('redis://user@host:6379')!.password, null, 'a username alone carries no password');
  for (const bad of ['', '   ', 'host:6379', 'http://host:6379', 'redis://', 'not a url', 'redis:///db']) {
    assert.equal(parseRedisUrl(bad), null, `${JSON.stringify(bad)} is not a Redis URL`);
  }
  console.log('✓ Redis URLs are parsed, not pattern-matched; non-Redis and empty values are rejected');
}

// 2. The production rules, with and without the opt-in.
{
  // Render-style internal URL without credentials.
  assert.match(redisProblems({ REDIS_URL: RENDER_INTERNAL })[0], /REDIS_ALLOW_UNAUTHENTICATED=true/, 'without the opt-in the message names it');
  assert.deepEqual(redisProblems({ REDIS_URL: RENDER_INTERNAL, REDIS_ALLOW_UNAUTHENTICATED: 'true' }), [], 'with the opt-in the Render URL is accepted');
  assert.match(redisProblems({ REDIS_URL: RENDER_INTERNAL, REDIS_ALLOW_UNAUTHENTICATED: 'false' })[0], /has no password/, 'an explicit false is not an opt-in');

  // Authenticated URL with a strong password: fine either way.
  assert.deepEqual(redisProblems({ REDIS_URL: 'rediss://default:A-real-Password-123@host:6379' }), []);
  assert.deepEqual(redisProblems({ REDIS_URL: 'redis://:A-real-Password-123@host:6379', REDIS_ALLOW_UNAUTHENTICATED: 'true' }), [], 'the flag does not disturb an authenticated URL');

  // Weak or placeholder password: refused, flag or no flag.
  for (const weak of ['changeme', 'change%2Dme', 'redis', 'password', 'secret']) {
    const url = `redis://:${weak}@host:6379`;
    assert.match(redisProblems({ REDIS_URL: url })[0], /placeholder/, `${weak} refused`);
    assert.match(redisProblems({ REDIS_URL: url, REDIS_ALLOW_UNAUTHENTICATED: 'true' })[0], /placeholder/, `${weak} refused even with the opt-in`);
  }

  // Malformed credentials and malformed URLs: refused, flag or no flag.
  assert.match(redisProblems({ REDIS_URL: 'redis://user@host:6379', REDIS_ALLOW_UNAUTHENTICATED: 'true' })[0], /username but no password/);
  for (const bad of ['host:6379', 'http://host:6379', 'redis://', 'not a url']) {
    assert.match(redisProblems({ REDIS_URL: bad, REDIS_ALLOW_UNAUTHENTICATED: 'true' })[0], /valid redis:\/\/ or rediss:\/\/ URL/, `${JSON.stringify(bad)} refused`);
  }

  // An unauthenticated loopback URL is the development default: refused, flag or no flag.
  for (const loop of ['redis://localhost:6379', 'redis://127.0.0.1:6379']) {
    assert.match(redisProblems({ REDIS_URL: loop, REDIS_ALLOW_UNAUTHENTICATED: 'true' })[0], /localhost/, `${loop} refused with the opt-in`);
    assert.match(redisProblems({ REDIS_URL: loop })[0], /localhost/, `${loop} refused without it`);
  }
  // An authenticated loopback URL (a sidecar) is accepted, as before this change.
  assert.deepEqual(redisProblems({ REDIS_URL: 'redis://:A-real-Password-123@localhost:6379' }), []);

  // Missing URL: the schema default (localhost) is refused by the connection
  // rule, and the deployment rule names the variable as unset.
  assert.ok(validateDeploymentEnvironment({ ...PROD, REDIS_URL: undefined }).some((p) => p.startsWith('REDIS_URL: must be set')));
  assert.ok(validateDeploymentEnvironment({ ...PROD, REDIS_URL: '   ' }).some((p) => p.startsWith('REDIS_URL: must be set')));

  // Nothing echoes the value.
  for (const problem of [
    ...redisProblems({ REDIS_URL: 'redis://:Sup3rS3cret@host:6379' }),
    ...redisProblems({ REDIS_URL: 'redis://sup3r@host:6379' }),
  ]) {
    assert.ok(!/Sup3rS3cret|sup3r/.test(problem), 'messages never contain configured values');
  }

  // Development and test are never validated.
  assert.deepEqual(validateProductionConnections({ NODE_ENV: 'development', REDIS_URL: 'redis://localhost:6379' }), []);
  assert.deepEqual(validateProductionConnections({ NODE_ENV: 'test', REDIS_URL: 'not a url' }), []);
  console.log('✓ Unauthenticated URLs need the explicit opt-in; placeholders, malformed URLs and localhost are refused regardless');
}

// 3. Through the schema, as startup parses it.
{
  const parse = (overrides: Record<string, string>) => envSchema.safeParse({ ...PROD, ...overrides });
  assert.equal(parse({ REDIS_URL: RENDER_INTERNAL }).success, false, 'schema refuses the Render URL without the opt-in');
  assert.equal(parse({ REDIS_URL: RENDER_INTERNAL, REDIS_ALLOW_UNAUTHENTICATED: 'true' }).success, true, 'schema accepts it with the opt-in');
  assert.equal(parse({ REDIS_URL: 'redis://:changeme@host:6379', REDIS_ALLOW_UNAUTHENTICATED: 'true' }).success, false);
  assert.equal(parse({ REDIS_ALLOW_UNAUTHENTICATED: 'yes' }).success, false, 'the flag is a strict true/false');
  assert.equal(envSchema.safeParse({ NODE_ENV: 'development' }).data?.REDIS_ALLOW_UNAUTHENTICATED, 'false', 'off by default');
  console.log('✓ The schema carries the opt-in as a strict boolean string, off by default');
}

// 4. Real startup, in fresh processes.
{
  const refused = runProbe('env-probe.ts', { ...PROD, REDIS_URL: RENDER_INTERNAL });
  assert.notEqual(refused.status, 0, 'production with the Render URL and no opt-in must refuse to start');
  assert.match(refused.stderr, /REDIS_URL: has no password/);
  assert.match(refused.stderr, /REDIS_ALLOW_UNAUTHENTICATED=true/);

  const accepted = runProbe('env-probe.ts', { ...PROD, REDIS_URL: RENDER_INTERNAL, REDIS_ALLOW_UNAUTHENTICATED: 'true' });
  assert.equal(accepted.status, 0, `production with the Render URL and the opt-in must start: ${accepted.stderr}`);
  assert.equal(accepted.json.nodeEnv, 'production');

  const authenticated = runProbe('env-probe.ts', { ...PROD, REDIS_URL: 'rediss://default:A-real-Password-123@red-host:6379' });
  assert.equal(authenticated.status, 0, `an authenticated URL still starts without the flag: ${authenticated.stderr}`);

  const weakWithFlag = runProbe('env-probe.ts', { ...PROD, REDIS_URL: 'redis://:changeme@red-host:6379', REDIS_ALLOW_UNAUTHENTICATED: 'true' });
  assert.notEqual(weakWithFlag.status, 0, 'a placeholder password is refused even with the opt-in');
  assert.match(weakWithFlag.stderr, /placeholder Redis password/);

  const missing = runProbe('env-probe.ts', { ...PROD, REDIS_URL: undefined, REDIS_ALLOW_UNAUTHENTICATED: 'true' });
  assert.notEqual(missing.status, 0, 'a missing REDIS_URL is refused even with the opt-in');
  assert.match(missing.stderr, /REDIS_URL: must be set in production/);

  const external = runProbe('env-probe.ts', { ...PROD, REDIS_URL: 'redis://redis.example.com:6379' });
  assert.notEqual(external.status, 0, 'an unauthenticated URL anywhere else is refused without the opt-in');

  const dev = runProbe('env-probe.ts', { NODE_ENV: 'development', REDIS_URL: 'redis://localhost:6379' });
  assert.equal(dev.status, 0, `development keeps the unauthenticated local Redis: ${dev.stderr}`);

  for (const result of [refused, weakWithFlag, missing, external]) {
    assert.ok(!result.stderr.includes('changeme') && !result.stderr.includes(STRONG_A), 'errors never print values');
  }
  console.log('✓ Real startup: Render internal URL starts only with the opt-in; weak, missing and foreign unauthenticated URLs refuse; development unchanged');
}

console.log('--- All Redis Connection Validation Tests Passed ---');
