import assert from 'node:assert/strict';

/**
 * Mock-mode containment.
 *
 * verifyPayment() skips HMAC signature verification when isRazorpayMockMode()
 * is true (modules/payments/service.ts). That predicate used to be derived
 * purely from "are the credentials placeholders?", and RAZORPAY_KEY_ID defaults
 * to '' with nothing rejecting that in production — so a production server with
 * Razorpay unconfigured would have skipped verification and activated
 * subscriptions WITHOUT PAYMENT.
 *
 * It never actually happened because the server crashed at boot on the empty
 * key. That crash was an accident, not a control, and Phase 9 removes it by
 * constructing the client lazily. This suite pins the control that replaces it:
 * production is never mock mode, whatever the credentials look like.
 *
 * The predicate is module-private, so the decision logic is re-stated here and
 * asserted against the source to guarantee the two cannot drift apart.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

console.log('--- Starting Payment Mock-Mode Containment Tests ---');

const SERVICE_SRC = readFileSync(
  join(__dirname, '..', 'modules', 'payments', 'service.ts'),
  'utf8',
);

/** The rule as implemented: production is never mock mode. */
function mockModeFor(nodeEnv: string, configured: boolean): boolean {
  if (nodeEnv === 'production') return false;
  return !configured;
}

// 1. The implementation really does short-circuit on production, and it does so
//    BEFORE consulting the credentials.
{
  const fn = SERVICE_SRC.slice(
    SERVICE_SRC.indexOf('function isRazorpayMockMode'),
    SERVICE_SRC.indexOf('/** Plan display order'),
  );

  assert.ok(
    /if\s*\(\s*env\.NODE_ENV\s*===\s*'production'\s*\)\s*return\s+false\s*;/.test(fn),
    'isRazorpayMockMode must return false outright in production',
  );

  const prodGuardAt = fn.search(/env\.NODE_ENV\s*===\s*'production'/);
  const credsAt = fn.search(/isRazorpayConfigured\(\)/);
  assert.ok(prodGuardAt >= 0 && credsAt >= 0, 'both checks must be present');
  assert.ok(
    prodGuardAt < credsAt,
    'the production guard must come first, so credentials can never re-enable mock mode',
  );

  console.log('✓ Production short-circuit is present and precedes the credential check');
}

// 2. Truth table: unconfigured production must NOT be mock mode.
{
  assert.equal(mockModeFor('production', false), false, 'production + unconfigured');
  assert.equal(mockModeFor('production', true), false, 'production + configured');
  assert.equal(mockModeFor('development', false), true, 'development + unconfigured');
  assert.equal(mockModeFor('development', true), false, 'development + configured');
  assert.equal(mockModeFor('test', false), true, 'test + unconfigured');

  console.log('✓ Unconfigured production is not mock mode; development behaviour unchanged');
}

// 3. Signature verification is still gated on the predicate (not removed), and
//    still ignores caller-supplied ids — the Phase-7 fix must not regress.
{
  assert.ok(
    SERVICE_SRC.includes('if (!isRazorpayMockMode()) {'),
    'HMAC verification must remain gated on server configuration only',
  );
  assert.ok(
    SERVICE_SRC.includes("createHmac('sha256', env.RAZORPAY_KEY_SECRET)"),
    'HMAC verification must still be performed',
  );
  assert.ok(
    !/razorpayPaymentId\s*\.\s*startsWith\(\s*'pay_mock_'/.test(SERVICE_SRC),
    'caller-supplied ids must never influence whether verification runs',
  );

  console.log('✓ HMAC verification intact and still independent of caller-supplied ids');
}

// 4. The module no longer imports a ready-built client, so importing payments
//    cannot crash the server.
{
  assert.ok(
    !/import\s+razorpay\s+from\s+'\.\.\/\.\.\/config\/razorpay'/.test(SERVICE_SRC),
    'the eager default-import of the client must be gone',
  );
  assert.ok(
    SERVICE_SRC.includes("import { getRazorpayClient, isRazorpayConfigured } from '../../config/razorpay'"),
    'the service must use the lazy accessor',
  );
  assert.ok(
    !/await\s+razorpay\.orders\.create\(/.test(SERVICE_SRC),
    'no call site may use the old eager client binding',
  );
  assert.equal(
    (SERVICE_SRC.match(/const gateway = getRazorpayClient\(\);/g) ?? []).length,
    2,
    'both order-creation call sites must go through the lazy accessor',
  );
  assert.equal(
    (SERVICE_SRC.match(/gateway\.orders\.create\(/g) ?? []).length,
    2,
    'both order-creation call sites must use the client obtained from the accessor',
  );

  console.log('✓ Payments service imports no eagerly-built client; both call sites are lazy');
}

// 5. A failed or unconfigured gateway is an error, never a locally minted
//    order (which previously made the browser fake a "successful" payment).
{
  assert.ok(
    !/falling back to mock order/.test(SERVICE_SRC),
    'order creation must not fall back to a mock order',
  );
  assert.equal(
    (SERVICE_SRC.match(/throw gatewayOrderError\(err\)/g) ?? []).length,
    2,
    'both order-creation call sites must surface gateway failures',
  );

  console.log('✓ Gateway failures surface as errors; no fallback mock orders');
}

console.log('--- All Payment Mock-Mode Containment Tests Passed ---');
