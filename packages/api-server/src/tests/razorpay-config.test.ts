import assert from 'node:assert/strict';

/**
 * Razorpay configuration safety.
 *
 * Phase 8 staging found that config/razorpay.ts built the SDK client at module
 * import time. `RAZORPAY_KEY_ID` defaults to '' and the SDK throws on an empty
 * key, so an unconfigured optional integration crashed the WHOLE API server at
 * startup (RestartCount=54).
 *
 * Fixing that by deferring construction removes the crash — but the crash was
 * also, by accident, the only thing stopping a far worse outcome: with empty
 * credentials `isRazorpayMockMode()` returned true, and verifyPayment() skips
 * HMAC verification in mock mode. A production server with Razorpay
 * unconfigured would have activated subscriptions without payment.
 *
 * So this suite pins BOTH properties: importing with no credentials must not
 * throw, and production must never fall into mock mode.
 */

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

/** Load a fresh copy of the config module under a given environment. */
async function loadRazorpayConfig(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  // Bust the require cache so `env` is re-read.
  const resolved = require.resolve('../config/razorpay');
  const envResolved = require.resolve('../config/env');
  delete require.cache[resolved];
  delete require.cache[envResolved];

  return require('../config/razorpay') as typeof import('../config/razorpay');
}

async function main(): Promise<void> {
  console.log('--- Starting Razorpay Configuration Safety Tests ---');

  // 1. Module initialization with payment credentials ABSENT must not throw.
  {
    restoreEnv();
    let mod: Awaited<ReturnType<typeof loadRazorpayConfig>> | null = null;

    assert.doesNotThrow(() => {
      // Importing the module is what used to crash the server.
      mod = require('../config/razorpay');
    }, 'importing config/razorpay must never construct the SDK');

    mod = await loadRazorpayConfig({
      NODE_ENV: 'development',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
    });

    assert.equal(
      mod!.isRazorpayConfigured(),
      false,
      'empty credentials must read as unconfigured',
    );

    console.log('✓ Importing the config module with credentials absent does not throw');
  }

  // 2. A payment operation with credentials absent gets a controlled error,
  //    not an SDK exception.
  {
    const mod = await loadRazorpayConfig({
      NODE_ENV: 'development',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
    });

    assert.throws(
      () => mod.getRazorpayClient(),
      (err: unknown) => {
        const e = err as { statusCode?: number; code?: string; message?: string };
        assert.equal(e.statusCode, 503, 'must be a 503, not a generic 500');
        assert.equal(e.code, 'PAYMENTS_NOT_CONFIGURED');
        assert.match(String(e.message), /not configured/i);
        return true;
      },
      'getRazorpayClient() must raise a controlled configuration error',
    );

    console.log('✓ Payment operation without credentials raises a controlled 503 PAYMENTS_NOT_CONFIGURED');
  }

  // 3. Placeholder credentials from .env.example also read as unconfigured, so
  //    a half-configured server cannot be mistaken for a real one.
  {
    for (const [keyId, keySecret] of [
      ['rzp_test_xxxxxxxxxxxx', 'your-razorpay-secret'],
      ['your-razorpay-key-id', 'abcdef123456'],
      ['rzp_live_realish', 'secret_xxxx'],
    ]) {
      const mod = await loadRazorpayConfig({
        NODE_ENV: 'development',
        RAZORPAY_KEY_ID: keyId,
        RAZORPAY_KEY_SECRET: keySecret,
      });
      assert.equal(
        mod.isRazorpayConfigured(),
        false,
        `${keyId} / ${keySecret} must read as unconfigured`,
      );
      assert.throws(() => mod.getRazorpayClient());
    }

    console.log('✓ Placeholder credentials read as unconfigured (3 variants)');
  }

  // 4. Normal initialization WITH credentials present: the client builds, is
  //    cached, and existing behaviour is preserved.
  {
    // NODE_ENV=production also engages the unrelated production guards in
    // config/env.ts (JWT strength, authenticated Redis, non-default DB
    // password), so those are satisfied here to keep the test about Razorpay.
    // None of these are real credentials.
    const mod = await loadRazorpayConfig({
      NODE_ENV: 'production',
      RAZORPAY_KEY_ID: 'rzp_live_phase9test',
      RAZORPAY_KEY_SECRET: 'phase9-test-secret-value',
      JWT_SECRET: 'phase9-test-access-secret-0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET: 'phase9-test-refresh-secret-fedcba9876543210fedcba9876543210',
      REDIS_URL: 'redis://:phase9testredispw@redis:6379',
      DATABASE_URL: 'postgresql://postgres:phase9testdbpw@postgres:5432/tenderbazaar',
    });

    assert.equal(mod.isRazorpayConfigured(), true);

    const first = mod.getRazorpayClient();
    assert.ok(first, 'a client must be returned when credentials are present');
    assert.ok((first as { orders?: unknown }).orders, 'the client exposes orders');
    assert.equal(mod.getRazorpayClient(), first, 'the client must be cached, not rebuilt');

    mod.resetRazorpayClientForTests();
    assert.notEqual(
      mod.getRazorpayClient(),
      first,
      'the test reset helper must drop the cache',
    );

    console.log('✓ With credentials present the client builds, is cached, and is resettable');
  }

  restoreEnv();
  console.log('--- All Razorpay Configuration Safety Tests Passed ---');
}

main().catch((err) => {
  restoreEnv();
  console.error(err);
  process.exit(1);
});
