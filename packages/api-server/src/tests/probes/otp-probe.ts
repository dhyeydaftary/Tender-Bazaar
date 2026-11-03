/**
 * Runs the real OTP flows (authService.sendOtp / verifyOtp) in a fresh
 * process with Redis and Prisma stubbed in-process and a controllable clock,
 * and reports what happened in each scenario. NODE_ENV decides whether the
 * no-provider fallback (print the code) is allowed; otp-security.test.ts runs
 * it once as development and once as production.
 */
import { makeFakePrisma, makeFakeRedis, injectModule } from './fake-prisma';

const redis = makeFakeRedis();
injectModule('../../config/redis', { redis, default: redis });
const db = makeFakePrisma([]);
injectModule('../../config/database', { prisma: db.prisma, default: db.prisma });

const lines: string[] = [];
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  console[level] = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}

/* eslint-disable @typescript-eslint/no-var-requires */
// Parse the environment before any module can pull @prisma/client in (it
// loads the repository's .env on import).
require('../../config/env');
const { authService, OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR } = require('../../modules/auth/service');
/* eslint-enable @typescript-eslint/no-var-requires */

const PHONE = '9876543210';

/** The code the service just issued, read from the developer log line. */
function loggedOtp(): string | null {
  const line = [...lines].reverse().find((l) => l.includes('Development OTP for'));
  const match = line?.match(/:\s*(\d{6})\s*$/);
  return match ? match[1] : null;
}

async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: string; status: number; message: string; details: unknown }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err: any) {
    return { ok: false, code: err?.code ?? 'UNKNOWN', status: err?.statusCode ?? 0, message: err?.message ?? String(err), details: err?.details ?? null };
  }
}

(async () => {
  const report: Record<string, unknown> = {};

  // 1. Issue a code.
  const first = await attempt(() => authService.sendOtp(PHONE));
  report.firstSend = first;
  report.codeStoredHashed = (() => {
    const stored = redis.peek(`otp:${PHONE}`);
    return stored !== null && /^[0-9a-f]{64}$/.test(stored);
  })();
  const otp1 = loggedOtp();
  report.codeLogged = otp1 !== null;
  report.codeFormat = otp1 ? /^\d{6}$/.test(otp1) : null;

  if (first.ok && otp1) {
    // 2. Resend inside the cooldown is refused; the first code still stands.
    report.resendInCooldown = await attempt(() => authService.sendOtp(PHONE));

    // 3. Wrong codes, then the right one: the right one still works below the limit.
    const wrong = otp1 === '000000' ? '111111' : '000000';
    report.wrongAttempt = await attempt(() => authService.verifyOtp(PHONE, wrong));
    const ok = await attempt(() => authService.verifyOtp(PHONE, otp1));
    report.correctAfterOneWrong = ok.ok;
    report.signedInUserCreated = db.users.length === 1 && db.users[0].phone === PHONE;

    // 4. Replay of the consumed code.
    report.replayAfterSuccess = await attempt(() => authService.verifyOtp(PHONE, otp1));

    // 5. Lockout: a new code, then OTP_MAX_ATTEMPTS wrong guesses.
    redis.advance(61);
    const second = await attempt(() => authService.sendOtp(PHONE));
    const otp2 = loggedOtp();
    report.secondSend = second.ok && otp2 !== null && otp2 !== otp1 ? 'new code issued' : second;
    const guesses: string[] = [];
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const guess = String(100000 + i).padStart(6, '0');
      const r = await attempt(() => authService.verifyOtp(PHONE, guess === otp2 ? '999999' : guess));
      guesses.push(r.ok ? 'OK' : r.code);
    }
    report.guessCodes = guesses;
    report.correctAfterLockout = await attempt(() => authService.verifyOtp(PHONE, otp2!));
    report.sendWhileLocked = await attempt(() => authService.sendOtp(PHONE));

    // 6. After the lockout expires: a new code invalidates the previous one.
    redis.advance(15 * 60 + 1);
    const third = await attempt(() => authService.sendOtp(PHONE));
    const otp3 = loggedOtp();
    report.thirdSend = third.ok;
    redis.advance(61);
    const fourth = await attempt(() => authService.sendOtp(PHONE));
    const otp4 = loggedOtp();
    report.fourthSend = fourth.ok;
    report.previousCodeAfterReissue = await attempt(() => authService.verifyOtp(PHONE, otp3!));
    report.currentCodeAfterReissue = (await attempt(() => authService.verifyOtp(PHONE, otp4!))).ok;

    // 7. Expiry: a code older than its TTL is refused.
    redis.advance(61);
    const fifth = await attempt(() => authService.sendOtp(PHONE));
    const otp5 = loggedOtp();
    report.fifthSend = fifth.ok;
    redis.advance(5 * 60 + 1);
    report.expiredCode = await attempt(() => authService.verifyOtp(PHONE, otp5!));

    // 8. Hourly cap on issuing codes (five sends happened this hour already).
    redis.advance(61);
    report.sixthSendThisHour = await attempt(() => authService.sendOtp(PHONE));
    report.sendsThisHour = OTP_MAX_SENDS_PER_HOUR;

    // 9. Unknown number: the same wording as a known one.
    report.unknownNumberWrongCode = await attempt(() => authService.verifyOtp('9000000001', '123456'));
  }

  report.allLogText = lines.join('\n');
  process.stdout.write(JSON.stringify(report) + '\n');
  process.exit(0);
})().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
