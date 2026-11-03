import assert from 'node:assert/strict';
import {
  applyApiError,
  applySendSuccess,
  clearOtpState,
  deriveOtpControls,
  emptyOtpState,
  formatCountdown,
  hasActiveRestriction,
  loadOtpState,
  saveOtpState,
  apiErrorOf,
} from '../otp-state';

/**
 * The OTP page's timers and button states, driven only by what the API says.
 *
 * The page used to show a toast and leave every button enabled, so a user
 * locked out for fifteen minutes saw no countdown and could keep pressing
 * Verify; the one-minute resend cooldown and the hourly cap were invisible
 * too. These tests pin the derivation with a fixed clock.
 */

console.log('--- Starting OTP State Tests ---');

const T0 = 1_700_000_000_000;
const PHONE = '9876543210';
const SEND_OK = { message: 'OTP sent successfully', expiresInSeconds: 300, resendAfterSeconds: 60, maxAttempts: 5 };

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    size: () => map.size,
  };
}

// 1. A successful send starts the validity and resend countdowns.
{
  const s = applySendSuccess(emptyOtpState(PHONE), SEND_OK, T0);
  const c = deriveOtpControls(s, T0);
  assert.equal(c.otpRemainingSeconds, 300);
  assert.equal(c.resendRemainingSeconds, 60);
  assert.equal(c.canVerify, true);
  assert.equal(c.canResend, false);
  assert.equal(c.resendBlockedBy, 'cooldown');
  assert.equal(s.attemptsRemaining, 5);

  const later = deriveOtpControls(s, T0 + 61_000);
  assert.equal(later.canResend, true, 'the resend button comes back after the cooldown');
  assert.equal(later.otpRemainingSeconds, 239);

  const expired = deriveOtpControls(s, T0 + 300_000);
  assert.equal(expired.otpExpired, true, 'the code has expired');
  assert.equal(expired.canVerify, false, 'an expired code cannot be submitted');
  assert.equal(expired.canResend, true);
  console.log('✓ Send starts a 5:00 validity countdown and a 1:00 resend cooldown; expiry disables Verify');
}

// 2. A send response without timing figures invents nothing.
{
  const s = applySendSuccess(emptyOtpState(PHONE), { message: 'ok' }, T0);
  const c = deriveOtpControls(s, T0);
  assert.equal(s.otpExpiresAt, null);
  assert.equal(c.canVerify, false, 'without expiry information there is no code to verify against');
  assert.equal(c.canResend, true);
  console.log('✓ Missing timing figures produce no countdown');
}

// 3. Wrong codes count down the attempts; the fifth locks the number for 15 minutes.
{
  let s = applySendSuccess(emptyOtpState(PHONE), SEND_OK, T0);
  s = applyApiError(s, { code: 'INVALID_OTP', details: { attemptsRemaining: 4 } }, T0 + 1000);
  assert.equal(s.attemptsRemaining, 4);
  assert.equal(deriveOtpControls(s, T0 + 1000).canVerify, true, 'still allowed to try');

  s = applyApiError(s, { code: 'OTP_LOCKED', details: { retryAfterSeconds: 900 } }, T0 + 5000);
  const c = deriveOtpControls(s, T0 + 5000);
  assert.equal(c.lockRemainingSeconds, 900);
  assert.equal(c.canVerify, false, 'Verify is disabled while locked');
  assert.equal(c.canResend, false, 'no new code while locked');
  assert.equal(c.resendBlockedBy, 'locked');
  assert.equal(s.attemptsRemaining, 0);

  const midway = deriveOtpControls(s, T0 + 5000 + 450_000);
  assert.equal(midway.lockRemainingSeconds, 450);
  assert.equal(formatCountdown(midway.lockRemainingSeconds), '7:30');

  const over = deriveOtpControls(s, T0 + 5000 + 900_000);
  assert.equal(over.lockRemainingSeconds, 0);
  assert.equal(over.canResend, true, 'controls return when the lockout expires');
  assert.equal(over.canVerify, false, 'but the voided code is gone; a new one is needed');
  console.log('✓ Lockout: 15:00 countdown, Verify and Resend disabled, both return afterwards');
}

// 4. Cooldown and hourly-limit errors from the server override local guesses.
{
  let s = applySendSuccess(emptyOtpState(PHONE), SEND_OK, T0);
  s = applyApiError(s, { code: 'OTP_COOLDOWN', details: { retryAfterSeconds: 37 } }, T0 + 10_000);
  assert.equal(deriveOtpControls(s, T0 + 10_000).resendRemainingSeconds, 37, 'the server\'s remaining cooldown wins');

  s = applyApiError(s, { code: 'OTP_TOO_MANY_REQUESTS', details: { retryAfterSeconds: 3100 } }, T0 + 20_000);
  const c = deriveOtpControls(s, T0 + 20_000);
  assert.equal(c.resendBlockedBy, 'hourly-limit');
  assert.equal(c.sendLimitRemainingSeconds, 3100);
  assert.equal(formatCountdown(c.sendLimitRemainingSeconds), '51:40');
  assert.equal(deriveOtpControls(s, T0 + 20_000 + 3_100_000).canResend, true);

  // Without a wait time the button stays disabled and no countdown is shown.
  const unknown = applyApiError(emptyOtpState(PHONE), { code: 'OTP_TOO_MANY_REQUESTS' }, T0);
  const uc = deriveOtpControls(unknown, T0);
  assert.equal(uc.canResend, false);
  assert.equal(uc.sendLimitRemainingSeconds, 0, 'no invented countdown');
  assert.equal(uc.resendBlockedBy, 'hourly-limit');

  // Unknown codes (delivery failures, validation) change nothing.
  assert.deepEqual(applyApiError(s, { code: 'SMS_NOT_CONFIGURED' }, T0), s);
  console.log('✓ Server-reported cooldown and hourly limit drive the Resend button; no countdown without a figure');
}

// 5. Persistence across a refresh, and expiry of stale state.
{
  const storage = fakeStorage();
  const s = applyApiError(applySendSuccess(emptyOtpState(PHONE), SEND_OK, T0), { code: 'OTP_LOCKED', details: { retryAfterSeconds: 900 } }, T0);
  saveOtpState(storage, s);
  const restored = loadOtpState(storage, T0 + 60_000);
  assert.ok(restored, 'a lockout survives a refresh');
  assert.equal(restored!.phone, PHONE);
  assert.equal(deriveOtpControls(restored!, T0 + 60_000).lockRemainingSeconds, 840);

  assert.equal(loadOtpState(storage, T0 + 901_000), null, 'once everything has expired nothing is restored');
  clearOtpState(storage);
  assert.equal(storage.size(), 0);

  storage.setItem('tb_otp_state', '{not json');
  assert.equal(loadOtpState(storage, T0), null, 'corrupt storage reads as nothing saved');
  storage.setItem('tb_otp_state', JSON.stringify({ phone: 'abc', lockedUntil: T0 + 1 }));
  assert.equal(loadOtpState(storage, T0), null, 'an invalid phone is not restored');
  assert.equal(loadOtpState(null, T0), null, 'no storage at all is fine');
  assert.equal(hasActiveRestriction(emptyOtpState(PHONE), T0), false);
  console.log('✓ Restrictions persist across a refresh and stale state is dropped');
}

// 6. Error extraction from an axios-style failure.
{
  assert.deepEqual(
    apiErrorOf({ response: { data: { error: { code: 'OTP_LOCKED', message: 'x', details: { retryAfterSeconds: 5 } } } } }),
    { code: 'OTP_LOCKED', message: 'x', details: { retryAfterSeconds: 5 } },
  );
  assert.equal(apiErrorOf(new Error('Network Error')), null);
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(59.9), '0:59');
  console.log('✓ API errors are read from the response envelope; countdowns format as m:ss');
}

console.log('--- All OTP State Tests Passed ---');
