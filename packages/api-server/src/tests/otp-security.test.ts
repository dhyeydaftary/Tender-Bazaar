import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runProbe } from './probes/run-probe';

/**
 * Phone OTP sign-in.
 *
 * The code used to come from Math.random, could be guessed without limit
 * (500 failed attempts per IP per 15 minutes was the only brake), and when no
 * SMS provider was configured the server printed the code to its log and told
 * the client it had been sent. Section 1 pins generation; section 2 runs the
 * real flows (probes/otp-probe.ts) with a fake clock; section 3 is production
 * delivery.
 */

console.log('--- Starting OTP Security Tests ---');

const SERVICE_SRC = readFileSync(join(__dirname, '..', 'modules', 'auth', 'service.ts'), 'utf8');

/** No SMS provider at all. Pinned empty so a developer's .env cannot leak in. */
const NO_SMS_PROVIDER = {
  MSG91_AUTH_KEY: '',
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_PHONE_NUMBER: '',
  FAST2SMS_API_KEY: '',
};

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

// 1. Generation: CSPRNG, six digits, stored hashed, compared in constant time.
{
  assert.ok(/crypto\.randomInt\(100000,\s*1000000\)/.test(SERVICE_SRC), 'codes come from crypto.randomInt');
  const code = SERVICE_SRC.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  assert.ok(!/Math\.random/.test(code), 'Math.random is gone from the auth service code');
  assert.ok(/timingSafeEqual/.test(SERVICE_SRC), 'comparison is constant-time');
  console.log('✓ OTPs come from the CSPRNG, keep the six-digit format, and are compared in constant time');
}

// 2. The real flows, as a development server (so the issued code is readable
//    from the console and the scenarios can present it back).
{
  const dev = runProbe('otp-probe.ts', { ...NO_SMS_PROVIDER, NODE_ENV: 'development' });
  assert.equal(dev.status, 0, `the OTP probe must run: ${dev.stderr}`);
  const r = dev.json;
  assert.ok(r, dev.stdout);

  assert.equal(r.firstSend.ok, true, `a code is issued: ${JSON.stringify(r.firstSend)}`);
  assert.equal(r.firstSend.value.message, 'OTP sent successfully', 'the response shape is unchanged');
  assert.deepEqual(
    { ...r.firstSend.value, message: undefined },
    { message: undefined, expiresInSeconds: 300, resendAfterSeconds: 60, maxAttempts: 5, sendsRemainingThisHour: 4 },
    'the send response tells the client the validity, cooldown, attempt budget and remaining sends',
  );
  assert.equal(r.codeFormat, true, 'six digits');
  assert.equal(r.codeStoredHashed, true, 'Redis holds a SHA-256 hash, not the code');

  assert.equal(r.resendInCooldown.code, 'OTP_COOLDOWN', 'a second code within a minute is refused');
  assert.equal(r.resendInCooldown.status, 429);
  assert.ok(
    r.resendInCooldown.details.retryAfterSeconds >= 1 && r.resendInCooldown.details.retryAfterSeconds <= 60,
    `cooldown errors carry the remaining wait: ${JSON.stringify(r.resendInCooldown.details)}`,
  );
  assert.equal(r.wrongAttempt.code, 'INVALID_OTP');
  assert.equal(r.wrongAttempt.status, 401);
  assert.deepEqual(r.wrongAttempt.details, { attemptsRemaining: 4 }, 'a wrong code reports the attempts left');
  assert.equal(r.correctAfterOneWrong, true, 'one wrong guess does not spoil the right code');
  assert.equal(r.signedInUserCreated, true, 'the phone sign-in still creates the account');
  assert.equal(r.replayAfterSuccess.code, 'INVALID_OTP', 'a consumed code cannot be replayed');

  assert.equal(r.secondSend, 'new code issued');
  assert.deepEqual(r.guessCodes, ['INVALID_OTP', 'INVALID_OTP', 'INVALID_OTP', 'INVALID_OTP', 'OTP_LOCKED'], 'the fifth wrong guess locks the number');
  assert.equal(r.correctAfterLockout.code, 'OTP_LOCKED', 'the right code is refused while locked');
  assert.equal(r.correctAfterLockout.status, 429);
  assert.ok(
    r.correctAfterLockout.details.retryAfterSeconds > 0 && r.correctAfterLockout.details.retryAfterSeconds <= 900,
    `lockout errors carry the remaining lockout: ${JSON.stringify(r.correctAfterLockout.details)}`,
  );
  assert.match(r.correctAfterLockout.message, /15 minutes/);
  assert.equal(r.sendWhileLocked.code, 'OTP_LOCKED', 'no new code while locked');
  assert.ok(r.sendWhileLocked.details.retryAfterSeconds > 0);

  assert.equal(r.thirdSend, true, 'the lockout expires');
  assert.equal(r.fourthSend, true);
  assert.equal(r.previousCodeAfterReissue.code, 'INVALID_OTP', 'issuing a new code invalidates the previous one');
  assert.equal(r.currentCodeAfterReissue, true, 'the newest code works');

  assert.equal(r.fifthSend, true);
  assert.equal(r.expiredCode.code, 'INVALID_OTP', 'an expired code is refused');
  assert.equal(r.sixthSendThisHour.code, 'OTP_TOO_MANY_REQUESTS', 'at most five codes per number per hour');
  assert.ok(
    r.sixthSendThisHour.details.retryAfterSeconds > 0 && r.sixthSendThisHour.details.retryAfterSeconds <= 3600,
    `the hourly limit carries the remaining wait: ${JSON.stringify(r.sixthSendThisHour.details)}`,
  );

  assert.equal(r.unknownNumberWrongCode.code, 'INVALID_OTP');
  assert.equal(r.unknownNumberWrongCode.message, r.wrongAttempt.message, 'unknown and known numbers get the same wording');
  assert.ok(r.codeLogged, 'development prints the code when no SMS provider is configured');
  console.log('✓ Real flows: cooldown, five-strike lockout, single use, reissue invalidation, expiry, hourly cap, no enumeration');
}

// 3. Production without an SMS provider: explicit failure, no code stored, no code logged.
{
  const prod = runProbe('otp-probe.ts', PRODUCTION_ENV);
  assert.equal(prod.status, 0, `the production OTP probe must run: ${prod.stderr}`);
  const r = prod.json;
  assert.equal(r.firstSend.ok, false, 'production must not report success');
  assert.equal(r.firstSend.code, 'SMS_NOT_CONFIGURED');
  assert.equal(r.firstSend.status, 503);
  assert.equal(r.codeStoredHashed, false, 'the undelivered code is withdrawn');
  assert.equal(r.codeLogged, false, 'production never logs the code');
  assert.ok(!/\b\d{6}\b/.test(String(r.allLogText).split('9876543210').join('')), 'no six-digit code anywhere in the production log');
  assert.ok(/NOT delivered/.test(r.allLogText), 'the misconfiguration is logged');
  console.log('✓ Production without an SMS provider fails explicitly: 503, nothing stored, nothing logged');
}

console.log('--- All OTP Security Tests Passed ---');
