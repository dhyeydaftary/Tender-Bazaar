import assert from 'node:assert/strict';
import {
  validateDeploymentEnvironment,
  developmentShortcutsAllowed,
  checkTrustedOrigin,
  HOSTED_PLATFORM_MARKERS,
} from '../config/env';
import { runProbe } from './probes/run-probe';

/**
 * Production must never silently run with development configuration.
 *
 * The schema defaults an unset NODE_ENV to 'development' so a bare local
 * checkout keeps working. That default used to switch on every development
 * shortcut on a server that merely forgot to set NODE_ENV (mock payments,
 * dev CORS origins, the rate-limit bypass). Sections 1-3 pin the rules;
 * section 4 starts the real environment module in fresh processes and checks
 * what actually happens at startup.
 */

console.log('--- Starting Production Configuration Tests ---');

const STRONG_A = 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE';
const STRONG_B = 'Z5tR8yHn2kQw7vXp4LmB9cJ3dFgS6aTe';

/** A complete, valid production environment (raw, as the process sees it). */
const VALID_PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:Real-Db-Pass-123@db.internal:5432/tenderbazaar',
  REDIS_URL: 'rediss://default:Real-Redis-Pass-456@redis.internal:6379',
  JWT_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
  FRONTEND_URL: 'https://app.tenderbazaar.example',
  ADMIN_URL: 'https://admin.tenderbazaar.example',
};

// 1. Development shortcuts need an EXPLICIT NODE_ENV=development.
{
  assert.equal(developmentShortcutsAllowed('development'), true);
  assert.equal(developmentShortcutsAllowed(undefined), false, 'unset NODE_ENV must not enable shortcuts');
  assert.equal(developmentShortcutsAllowed(''), false);
  assert.equal(developmentShortcutsAllowed('production'), false);
  assert.equal(developmentShortcutsAllowed('test'), false);
  console.log('✓ Development shortcuts require an explicit NODE_ENV=development');
}

// 2. Deployment rules, checked on the raw environment.
{
  assert.deepEqual(validateDeploymentEnvironment(VALID_PRODUCTION), [], 'a complete production config passes');
  assert.deepEqual(validateDeploymentEnvironment({}), [], 'a bare local checkout passes');
  assert.deepEqual(validateDeploymentEnvironment({ NODE_ENV: 'development' }), []);

  assert.ok(HOSTED_PLATFORM_MARKERS.includes('RENDER') && HOSTED_PLATFORM_MARKERS.includes('RENDER_SERVICE_ID'));
  for (const marker of HOSTED_PLATFORM_MARKERS) {
    for (const nodeEnv of [undefined, '', 'development', 'test']) {
      const problems = validateDeploymentEnvironment({ ...VALID_PRODUCTION, NODE_ENV: nodeEnv, [marker]: 'srv-123' });
      assert.ok(
        problems.some((p) => p.startsWith('NODE_ENV:')),
        `${marker} set with NODE_ENV=${nodeEnv} must be rejected`,
      );
    }
  }
  assert.deepEqual(validateDeploymentEnvironment({ ...VALID_PRODUCTION, RENDER: 'true' }), []);

  const missing = validateDeploymentEnvironment({ NODE_ENV: 'production' });
  assert.ok(missing.some((p) => p.startsWith('DATABASE_URL:')), 'DATABASE_URL must be required');
  assert.ok(missing.some((p) => p.startsWith('FRONTEND_URL:')), 'FRONTEND_URL must be required');

  const bad = (overrides: Record<string, string>, prefix: string, why: string) => {
    const problems = validateDeploymentEnvironment({ ...VALID_PRODUCTION, ...overrides });
    assert.ok(problems.some((p) => p.startsWith(prefix)), why);
  };
  bad({ FRONTEND_URL: 'http://app.tenderbazaar.example' }, 'FRONTEND_URL:', 'http origin rejected');
  bad({ FRONTEND_URL: 'https://localhost:3000' }, 'FRONTEND_URL:', 'localhost rejected');
  bad({ FRONTEND_URL: 'https://app.example.com/dashboard' }, 'FRONTEND_URL:', 'paths rejected');
  bad({ ADMIN_URL: 'https://127.0.0.1' }, 'ADMIN_URL:', 'loopback admin origin rejected');
  bad({ CORS_ORIGINS: 'https://*.vercel.app' }, 'CORS_ORIGINS:', 'wildcards rejected');
  bad({ CORS_ORIGINS: 'https://ok.example.com,*' }, 'CORS_ORIGINS:', 'bare * rejected');
  bad({ ALLOW_DEMO_GOOGLE_AUTH: 'true' }, 'ALLOW_DEMO_GOOGLE_AUTH:', 'retired unsigned Google flag rejected');
  bad({ GOOGLE_CLIENT_ID: 'your-google-client-id' }, 'GOOGLE_CLIENT_ID:', 'placeholder client id rejected');
  bad({ RAZORPAY_KEY_ID: 'rzp_live_abc' }, 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:', 'key id without secret rejected');
  bad({ RAZORPAY_KEY_SECRET: 'secret-only' }, 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:', 'secret without key id rejected');

  assert.deepEqual(
    validateDeploymentEnvironment({
      ...VALID_PRODUCTION,
      CORS_ORIGINS: 'https://tenderbazaar.example, https://tenderbazaar.vercel.app',
      GOOGLE_CLIENT_ID: '1234567890-abc123def.apps.googleusercontent.com',
      RAZORPAY_KEY_ID: 'rzp_live_abc',
      RAZORPAY_KEY_SECRET: 'a-real-secret',
    }),
    [],
    'a complete production config with optional integrations passes',
  );

  // Messages never echo values.
  const secretish = 'https://user:Sup3rS3cret@app.example.com';
  for (const problem of validateDeploymentEnvironment({ ...VALID_PRODUCTION, FRONTEND_URL: secretish })) {
    assert.ok(!problem.includes('Sup3rS3cret'), 'problem messages must not contain configured values');
  }
  console.log('✓ Production requires NODE_ENV on Render, explicit URLs, https origins, no wildcard or retired flags');
}

// 3. Origin checks outside production keep local development working.
{
  assert.equal(checkTrustedOrigin('FRONTEND_URL', 'http://localhost:3000', false), null);
  assert.equal(checkTrustedOrigin('FRONTEND_URL', 'https://app.example.com/', false), null);
  assert.notEqual(checkTrustedOrigin('FRONTEND_URL', '*', false), null);
  console.log('✓ Development origins remain acceptable outside production');
}

// 4. Real startup, in fresh processes.
{
  const dev = runProbe('env-probe.ts', { NODE_ENV: 'development' });
  assert.equal(dev.status, 0, `development must start: ${dev.stderr}`);
  assert.equal(dev.json.developmentShortcuts, true);
  assert.equal(dev.json.allowDemoGoogleAuth, 'false', 'the retired Google flag now defaults to false');

  const unset = runProbe('env-probe.ts', {});
  assert.equal(unset.status, 0, `a bare local checkout must still start: ${unset.stderr}`);
  assert.equal(unset.json.developmentShortcuts, false, 'unset NODE_ENV must not enable development shortcuts');
  assert.match(unset.stderr, /NODE_ENV is not set/, 'unset NODE_ENV must be reported loudly');

  const onRender = runProbe('env-probe.ts', { RENDER: 'true' });
  assert.notEqual(onRender.status, 0, 'Render without NODE_ENV must refuse to start');
  assert.match(onRender.stderr, /NODE_ENV: must be set to 'production' on a hosted deployment/);

  const onOtherPlatform = runProbe('env-probe.ts', { FLY_APP_NAME: 'tenderbazaar-api' });
  assert.notEqual(onOtherPlatform.status, 0, 'any other hosting platform without NODE_ENV must refuse to start too');
  assert.match(onOtherPlatform.stderr, /FLY_APP_NAME is set/);

  const renderDev = runProbe('env-probe.ts', { RENDER: 'true', NODE_ENV: 'development' });
  assert.notEqual(renderDev.status, 0, 'Render with NODE_ENV=development must refuse to start');

  const bareProd = runProbe('env-probe.ts', { NODE_ENV: 'production' });
  assert.notEqual(bareProd.status, 0, 'production with nothing configured must refuse to start');
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'REDIS_URL', 'DATABASE_URL', 'FRONTEND_URL']) {
    assert.ok(bareProd.stderr.includes(`- ${name}:`), `startup error must name ${name}`);
  }

  const prod = runProbe('env-probe.ts', { ...VALID_PRODUCTION, RENDER: 'true' });
  assert.equal(prod.status, 0, `a complete production config must start: ${prod.stderr}`);
  assert.equal(prod.json.nodeEnv, 'production');
  assert.equal(prod.json.developmentShortcuts, false);

  const prodDemoGoogle = runProbe('env-probe.ts', { ...VALID_PRODUCTION, ALLOW_DEMO_GOOGLE_AUTH: 'true' });
  assert.notEqual(prodDemoGoogle.status, 0, 'production with the retired unsigned Google flag must refuse to start');

  const prodPartialRazorpay = runProbe('env-probe.ts', { ...VALID_PRODUCTION, RAZORPAY_KEY_ID: 'rzp_live_abc' });
  assert.notEqual(prodPartialRazorpay.status, 0, 'production with half a Razorpay configuration must refuse to start');

  for (const result of [onRender, bareProd]) {
    assert.ok(!result.stderr.includes(STRONG_A) && !result.stderr.includes('Real-Db-Pass'), 'errors never print values');
  }
  console.log('✓ Real startup: development works, unset NODE_ENV is safe, misconfigured production refuses to start');
}

console.log('--- All Production Configuration Tests Passed ---');
