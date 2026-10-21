import assert from 'node:assert/strict';

import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { selectEmailTransport } from '../providers/email';

/**
 * Email transport selection.
 *
 * Nodemailer was on 6.10.1, which carries five HIGH advisories (addressparser
 * DoS, OAuth2 TLS verification, and the `raw`/`jsonTransport` file-access and
 * SSRF bypasses). Moving to 10.x clears them, but it also removes the SES SDK
 * v2/v3 transport: `{ SES: { ses, aws } }` built from @aws-sdk/client-ses no
 * longer configures anything, and the transport throws "Missing SES
 * configuration" instead. Nothing exercised that branch, so the break would
 * have surfaced the first time production fell through to SES.
 *
 * These tests pin the selection order and the SES wiring. No message is sent
 * and no connection is opened: the credentials below authenticate nothing.
 */

const SES_ENV = {
  AWS_SES_ACCESS_KEY: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SES_SECRET_KEY: 'test-secret-not-a-real-key',
};

console.log('--- Starting Email Transport Selection Tests ---');

// 1. SMTP wins when fully configured, and `secure` tracks the port.
{
  const choice = selectEmailTransport({
    SMTP_HOST: 'smtp.example.invalid',
    SMTP_USER: 'mailer',
    SMTP_PASS: 'pw',
    SMTP_PORT: '465',
    ...SES_ENV,
    GMAIL_USER: 'someone@gmail.com',
    GMAIL_APP_PASSWORD: 'app-pw',
  });

  assert.equal(choice.kind, 'smtp');
  assert.equal(choice.options.host, 'smtp.example.invalid');
  assert.equal(choice.options.port, 465);
  assert.equal(choice.options.secure, true, 'port 465 is implicit TLS');

  const plain = selectEmailTransport({
    SMTP_HOST: 'smtp.example.invalid',
    SMTP_USER: 'mailer',
    SMTP_PASS: 'pw',
  });
  assert.equal(plain.kind, 'smtp');
  assert.equal(plain.options.port, 587, 'default submission port');
  assert.equal(plain.options.secure, false);

  console.log('✓ SMTP takes precedence; port default and implicit-TLS flag are correct');
}

// 2. A partial SMTP block never half-configures a transport.
{
  const choice = selectEmailTransport({ SMTP_HOST: 'smtp.example.invalid' });
  assert.equal(choice.kind, 'json', 'host alone must not select SMTP');

  console.log('✓ Incomplete SMTP credentials fall through instead of half-configuring');
}

// 3. Gmail is preferred over SES, but only below SMTP.
{
  const choice = selectEmailTransport({
    GMAIL_USER: 'someone@gmail.com',
    GMAIL_APP_PASSWORD: 'app-pw',
    ...SES_ENV,
  });

  assert.equal(choice.kind, 'gmail');
  assert.equal(choice.options.service, 'gmail');

  console.log('✓ Gmail is selected ahead of SES when SMTP is absent');
}

// 4. The SES branch is wired for the nodemailer 10 API, not the removed one.
{
  const choice = selectEmailTransport(SES_ENV, 'ap-south-1');
  assert.equal(choice.kind, 'ses');
  if (choice.kind !== 'ses') throw new Error('unreachable');

  assert.ok(
    choice.options.SES.sesClient instanceof SESv2Client,
    'the client must be an SESv2Client; nodemailer 7 removed SES SDK v2/v3 support',
  );
  assert.equal(
    choice.options.SES.SendEmailCommand,
    SendEmailCommand,
    'the transport constructs SendEmailCommand itself and needs the sesv2 class',
  );
  assert.ok(
    !('aws' in (choice.options.SES as Record<string, unknown>)),
    'the pre-7 `aws` key is gone and must not be reintroduced',
  );

  console.log('✓ SES uses the SESv2 client and SendEmailCommand required by nodemailer 10');
}

// 5. The SES options really do build a transport — the shape check above is
//    only worth as much as nodemailer's own validation agrees with it.
{
  const choice = selectEmailTransport(SES_ENV);
  if (choice.kind !== 'ses') throw new Error('expected the SES branch');

  const transport = nodemailer.createTransport(choice.options);
  assert.equal(
    (transport as unknown as { transporter: { name: string } }).transporter.name,
    'SESTransport',
    'nodemailer must accept the options as an SES transport',
  );

  assert.throws(
    // The removed shape, to prove the assertion above is not vacuous.
    () => nodemailer.createTransport({ SES: { ses: {}, aws: {} } } as never),
    /legacy SES configuration|Missing SES configuration/,
    'the pre-7 shape must be rejected, not silently accepted',
  );

  console.log('✓ nodemailer accepts the SESv2 options and rejects the pre-7 shape');
}

// 6. Placeholder credentials from .env.example are not credentials.
{
  const choice = selectEmailTransport({
    AWS_SES_ACCESS_KEY: 'your-ses-access-key',
    AWS_SES_SECRET_KEY: 'your-ses-secret-key',
  });

  assert.equal(choice.kind, 'json', 'placeholders must not select SES');

  console.log('✓ .env.example placeholders fall through to the logging transport');
}

// 7. Unconfigured email logs instead of pretending to deliver, and says so.
{
  const choice = selectEmailTransport({});
  assert.equal(choice.kind, 'json');
  if (choice.kind !== 'json') throw new Error('unreachable');
  assert.equal(choice.options.jsonTransport, true);
  assert.match(choice.description, /No live SMTP \/ AWS SES credentials/);
  assert.match(choice.description, /SMTP_HOST/, 'the message must name what to set');

  console.log('✓ Unconfigured email selects jsonTransport and reports it honestly');
}

console.log('--- All Email Transport Selection Tests Passed ---');
