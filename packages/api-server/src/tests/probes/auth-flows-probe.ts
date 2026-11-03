/**
 * Runs the real forgot-password and send-OTP flows (modules/auth/service.ts)
 * in a fresh process, with Prisma, Redis and the notification queue stubbed
 * in-process, and reports what reached the server log. Used by
 * auth-flows-logging.test.ts: a deployed server must never write a reset link
 * or a one-time code to its logs, while a developer's console still gets them.
 */

// The notification publisher would open a Redis connection on first use;
// replace it in the require cache before anything imports it.
const publisherId = require.resolve('../../queue/notification-publisher');
const published: any[] = [];
require.cache[publisherId] = {
  id: publisherId,
  filename: publisherId,
  loaded: true,
  exports: {
    NOTIFICATIONS_QUEUE: 'notifications',
    publishNotificationJob: async (job: unknown) => {
      published.push(job);
    },
    closeNotificationPublisher: async () => undefined,
  },
} as any;

import { makeFakePrisma, makeFakeRedis, injectModule } from './fake-prisma';

const KNOWN_EMAIL = 'known@example.com';
const PHONE = '9876543210';

// The data layer is replaced before anything imports it. The real
// @prisma/client is never loaded: on import it reads the repository's .env
// into process.env, which would contaminate the environment under test.
const redis = makeFakeRedis();
injectModule('../../config/redis', { redis, default: redis });
const db = makeFakePrisma([{ id: 'user-known', email: KNOWN_EMAIL, name: 'Known Person', role: 'USER' }]);
injectModule('../../config/database', { prisma: db.prisma, default: db.prisma });

/* eslint-disable @typescript-eslint/no-var-requires */
// The environment is parsed first, from exactly what this process was given.
require('../../config/env');
const { authService } = require('../../modules/auth/service');
/* eslint-enable @typescript-eslint/no-var-requires */

// Capture everything the service writes to the console; nothing is echoed, so
// the JSON report below is the only line on stdout.
const lines: string[] = [];
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  console[level] = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
  };
}

(async () => {
  const known = await authService.forgotPassword(KNOWN_EMAIL);
  const unknown = await authService.forgotPassword('nobody@example.com');
  const resetUrl: string = published[0]?.data?.resetUrl ?? '';
  const resetToken = resetUrl.split('token=')[1] ?? '';

  // Without an SMS provider a development server prints the code; a deployed
  // one refuses (SMS_NOT_CONFIGURED) and withdraws it. Report both shapes.
  let otpOutcome: { ok: true; message: string } | { ok: false; code: string } = { ok: false, code: 'UNKNOWN' };
  try {
    const otpResult = await authService.sendOtp(PHONE);
    otpOutcome = { ok: true, message: otpResult.message };
  } catch (err: any) {
    otpOutcome = { ok: false, code: err?.code ?? 'UNKNOWN' };
  }
  const otpStored = redis.peek(`otp:${PHONE}`) !== null;

  // The phone number itself is logged on purpose; strip it so a six-digit run
  // inside it cannot masquerade as the OTP.
  const logText = lines.join('\n').split(PHONE).join('<phone>');
  const loggedCode = logText.match(/Development OTP for <phone>:\s*(\d{6})/)?.[1] ?? null;

  process.stdout.write(
    JSON.stringify({
      sameMessage: known.message === unknown.message,
      message: known.message,
      resetEmailQueued: published.length === 1 && resetToken.length === 64,
      resetLinkLogged: logText.includes('reset-password?token='),
      resetTokenLogged: resetToken !== '' && logText.includes(resetToken),
      otpOutcome,
      otpStored,
      otpLogged: loggedCode !== null,
      sixDigitRunInLog: /\b\d{6}\b/.test(logText),
      smsFailureLogged: /NOT delivered/.test(logText),
    }) + '\n',
  );
  process.exit(0);
})().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
