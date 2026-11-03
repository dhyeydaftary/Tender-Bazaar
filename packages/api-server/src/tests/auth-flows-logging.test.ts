import assert from 'node:assert/strict';
import { runProbe } from './probes/run-probe';

/**
 * Password-reset and OTP flows on a deployed server.
 *
 * The forgot-password handler used to print the full reset link, token
 * included, to the console on every request, and send-OTP printed the code
 * whenever no SMS provider was configured. On a hosted platform the console is
 * the log drain, readable by everyone with dashboard access, so both were a
 * credential leak. They are now development-only. The flows are exercised for
 * real (probes/auth-flows-probe.ts) with the data layer stubbed in-process.
 */

console.log('--- Starting Auth Flow Logging Tests ---');

/** No SMS provider at all. Pinned empty so a developer's .env cannot leak in. */
const NO_SMS_PROVIDER = {
  MSG91_AUTH_KEY: '',
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_PHONE_NUMBER: '',
  FAST2SMS_API_KEY: '',
};

/** A complete, valid production environment; none of these are real values. */
const PRODUCTION_ENV = {
  ...NO_SMS_PROVIDER,
  NODE_ENV: 'production',
  RENDER: 'true',
  DATABASE_URL: 'postgresql://app:Real-Db-Pass-123@db.internal:5432/tenderbazaar',
  REDIS_URL: 'rediss://default:Real-Redis-Pass-456@redis.internal:6379',
  JWT_SECRET: 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE',
  JWT_REFRESH_SECRET: 'Z5tR8yHn2kQw7vXp4LmB9cJ3dFgS6aTe',
  FRONTEND_URL: 'https://app.tenderbazaar.example',
};

// 1. Production: nothing secret in the logs, no account disclosure.
{
  const prod = runProbe('auth-flows-probe.ts', PRODUCTION_ENV);
  assert.equal(prod.status, 0, `the production probe must run: ${prod.stderr}`);
  const r = prod.json;
  assert.ok(r, `the probe must report results, got: ${prod.stdout}`);

  assert.equal(r.sameMessage, true, 'forgot-password must answer identically for known and unknown emails');
  assert.equal(r.resetEmailQueued, true, 'the reset email is still queued, with a 32-byte token');
  assert.equal(r.resetLinkLogged, false, 'production must not log the reset link');
  assert.equal(r.resetTokenLogged, false, 'production must not log the reset token');
  assert.deepEqual(r.otpOutcome, { ok: false, code: 'SMS_NOT_CONFIGURED' }, 'production without an SMS provider refuses, never "sent"');
  assert.equal(r.otpStored, false, 'the undelivered code is withdrawn');
  assert.equal(r.otpLogged, false, 'production must not log the OTP');
  assert.equal(r.sixDigitRunInLog, false, 'no six-digit code anywhere in the log');
  assert.equal(r.smsFailureLogged, true, 'production reports that the OTP was not delivered');
  assert.ok(!prod.stdout.includes('reset-password?token='), 'the token never reaches stdout');
  console.log('✓ Production: reset links and OTPs never reach the logs; forgot-password does not reveal accounts');
}

// 2. Development keeps both on the console, where they are needed.
{
  const dev = runProbe('auth-flows-probe.ts', { ...NO_SMS_PROVIDER, NODE_ENV: 'development' });
  assert.equal(dev.status, 0, `the development probe must run: ${dev.stderr}`);
  assert.equal(dev.json.sameMessage, true);
  assert.equal(dev.json.resetLinkLogged, true, 'development still prints the reset link for local testing');
  assert.deepEqual(dev.json.otpOutcome, { ok: true, message: 'OTP sent successfully' });
  assert.equal(dev.json.otpStored, true);
  assert.equal(dev.json.otpLogged, true, 'development still prints the OTP');
  console.log('✓ Development keeps printing the reset link and OTP to the console');
}

// 3. Unset NODE_ENV is not development.
{
  const unset = runProbe('auth-flows-probe.ts', { ...NO_SMS_PROVIDER });
  assert.equal(unset.status, 0, `a bare checkout must run: ${unset.stderr}`);
  assert.equal(unset.json.resetLinkLogged, false, 'unset NODE_ENV must behave like a deployed server');
  assert.equal(unset.json.otpLogged, false);
  assert.equal(unset.json.otpOutcome.ok, false, 'unset NODE_ENV does not get the print-the-code fallback either');
  console.log('✓ Unset NODE_ENV logs like a deployed server');
}

console.log('--- All Auth Flow Logging Tests Passed ---');
