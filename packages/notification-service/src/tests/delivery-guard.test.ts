import assert from 'node:assert/strict';

/**
 * Unconfigured providers fail closed in production.
 *
 * With no email provider configured the service used nodemailer's JSON
 * transport, which only prints the message, and the job completed as if the
 * email had been delivered. Password resets, alerts and subscription notices
 * then vanished without any failed job or error. SMS and WhatsApp had the
 * same "log and succeed" branch. Now a production worker throws
 * <CHANNEL>_NOT_CONFIGURED, so the job fails and the gap is visible, while
 * development keeps the console fallbacks. No message is sent by this suite.
 */

console.log('--- Starting Delivery Guard Tests ---');

const ORIGINAL_ENV = { ...process.env };
const PROVIDER_VARS = [
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GMAIL_USER', 'GMAIL_APP_PASSWORD',
  'AWS_SES_ACCESS_KEY', 'AWS_SES_SECRET_KEY', 'MSG91_AUTH_KEY', 'WATI_API_URL', 'WATI_API_KEY',
];

function load(nodeEnv: string | undefined, extra: Record<string, string> = {}) {
  for (const key of Object.keys(process.env)) if (!(key in ORIGINAL_ENV)) delete process.env[key];
  Object.assign(process.env, ORIGINAL_ENV);
  for (const name of PROVIDER_VARS) delete process.env[name];
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  Object.assign(process.env, extra);
  for (const mod of ['../config', '../providers/delivery-guard', '../providers/email', '../providers/sms', '../providers/whatsapp']) {
    delete require.cache[require.resolve(mod)];
  }
  /* eslint-disable @typescript-eslint/no-var-requires */
  return {
    email: require('../providers/email') as typeof import('../providers/email'),
    sms: require('../providers/sms') as typeof import('../providers/sms'),
    whatsapp: require('../providers/whatsapp') as typeof import('../providers/whatsapp'),
    guard: require('../providers/delivery-guard') as typeof import('../providers/delivery-guard'),
  };
  /* eslint-enable @typescript-eslint/no-var-requires */
}

const silence = () => {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const lines: string[] = [];
  console.log = console.warn = console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  return { lines, restore: () => Object.assign(console, original) };
};

async function main(): Promise<void> {
  // 1. Production with no provider: every channel refuses, with a named error.
  {
    const { email, sms, whatsapp, guard } = load('production');
    const out = silence();
    try {
      await assert.rejects(email.sendEmail('user@example.com', 'Reset your password', '<p>link</p>'), (err: any) => {
        assert.ok(err instanceof guard.ProviderNotConfiguredError);
        assert.equal(err.code, 'EMAIL_NOT_CONFIGURED');
        assert.match(err.message, /SMTP_HOST/);
        assert.match(err.message, /NOT delivered/);
        return true;
      });
      await assert.rejects(sms.sendSms('+919876543210', 'hello'), (err: any) => err.code === 'SMS_NOT_CONFIGURED');
      await assert.rejects(sms.sendOtpSms('+919876543210', '123456'), (err: any) => err.code === 'SMS_NOT_CONFIGURED');
      await assert.rejects(whatsapp.sendWhatsAppMessage('+919876543210', 'generic_notification', []), (err: any) => err.code === 'WHATSAPP_NOT_CONFIGURED');
      await assert.rejects(
        whatsapp.sendTenderAlertWhatsApp('+919876543210', 'alert', [{ title: 't', organization: 'o', bidSubmissionDeadline: new Date() }]),
        (err: any) => err.code === 'WHATSAPP_NOT_CONFIGURED',
      );
    } finally {
      out.restore();
    }
    assert.ok(!out.lines.some((l) => /Sent to|would be sent|Message ID/.test(l)), 'nothing was reported as sent');
    assert.ok(!out.lines.some((l) => l.includes('123456')), 'the OTP never reaches the log');
    console.log('✓ Production without a provider: email, SMS and WhatsApp fail with <CHANNEL>_NOT_CONFIGURED and log nothing as sent');
  }

  // 2. Development without a provider keeps the console fallbacks.
  {
    const { email, sms, whatsapp } = load('development');
    const out = silence();
    try {
      await email.sendEmail('user@example.com', 'Reset your password', '<p>link</p>');
      await sms.sendSms('+919876543210', 'hello');
      await whatsapp.sendWhatsAppMessage('+919876543210', 'generic_notification', []);
    } finally {
      out.restore();
    }
    assert.ok(out.lines.some((l) => /Dev mode - email to user@example.com/.test(l)), 'development prints the email');
    assert.ok(out.lines.some((l) => /\[SMS\] Dev mode/.test(l)), 'development prints the SMS');
    console.log('✓ Development keeps printing messages to the console');
  }

  // 3. Unset NODE_ENV is treated as development here (the worker has no
  //    hosted-platform marker check), and a configured provider is still
  //    selected ahead of the fallback in production.
  {
    const unset = load(undefined);
    assert.equal(unset.guard.assertDevFallbackAllowed('Email', 'X'), undefined, 'unset NODE_ENV allows the fallback');

    const configured = load('production', { SMTP_HOST: 'smtp.example.invalid', SMTP_USER: 'u', SMTP_PASS: 'p' });
    assert.equal(configured.email.selectEmailTransport().kind, 'smtp', 'production with SMTP configured uses SMTP');
    console.log('✓ A configured provider is used in production; the guard only fires for the console fallback');
  }

  console.log('--- All Delivery Guard Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
