import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SESTransport from 'nodemailer/lib/ses-transport';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type JSONTransport from 'nodemailer/lib/json-transport';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { config } from '../config';
import {
  tenderAlertTemplate,
  TenderAlertItem,
} from '../templates/tender-alert';
import {
  deadlineReminderTemplate,
  DeadlineTenderItem,
} from '../templates/deadline-reminder';

let transporter: Transporter | null = null;

/**
 * Which transport the configured environment selects, and the options to build
 * it with.
 *
 * Split out of `getTransporter` so the choice can be asserted without opening a
 * connection or caching a module-level transporter. The SES branch changed
 * shape when nodemailer went from 6 to 10 (the SDK v2/v3 `{ ses, aws }` form
 * was removed in favour of `{ sesClient, SendEmailCommand }` from
 * @aws-sdk/client-sesv2), and nothing exercised it, so the break would only
 * have surfaced the first time production tried to send mail through SES.
 */
export type EmailTransportChoice =
  | { kind: 'smtp'; description: string; options: SMTPTransport.Options }
  | { kind: 'gmail'; description: string; options: SMTPTransport.Options }
  | { kind: 'ses'; description: string; options: SESTransport.Options }
  | { kind: 'json'; description: string; options: JSONTransport.Options };

const SES_PLACEHOLDERS = new Set(['your-ses-access-key', 'your-ses-secret-key']);

function configured(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !SES_PLACEHOLDERS.has(value);
}

export function selectEmailTransport(
  env: NodeJS.ProcessEnv = process.env,
  region: string = config.aws.region,
): EmailTransportChoice {
  const smtpHost = env.SMTP_HOST;
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;

  const gmailUser = env.GMAIL_USER;
  const gmailPass = env.GMAIL_APP_PASSWORD;

  const sesKey = env.AWS_SES_ACCESS_KEY;
  const sesSecret = env.AWS_SES_SECRET_KEY;

  if (configured(smtpHost) && configured(smtpUser) && configured(smtpPass)) {
    const port = Number(env.SMTP_PORT) || 587;
    return {
      kind: 'smtp',
      description: `[Email] Using custom SMTP transport (${smtpHost})`,
      options: {
        host: smtpHost,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      },
    };
  }

  if (configured(gmailUser) && configured(gmailPass)) {
    return {
      kind: 'gmail',
      description: `[Email] Using Gmail SMTP transport (${gmailUser})`,
      options: {
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      },
    };
  }

  if (configured(sesKey) && configured(sesSecret)) {
    const sesClient = new SESv2Client({
      region,
      credentials: { accessKeyId: sesKey, secretAccessKey: sesSecret },
    });
    return {
      kind: 'ses',
      description: '[Email] Using AWS SES transport',
      // Nodemailer 7 dropped the SES SDK v2/v3 clients: the SES transport now
      // takes `{ sesClient, SendEmailCommand }` from @aws-sdk/client-sesv2 and
      // issues the SendEmail call itself.
      options: { SES: { sesClient, SendEmailCommand } },
    };
  }

  // Unconfigured fallback: logs to console rather than pretending to deliver.
  return {
    kind: 'json',
    description:
      '[Email] No live SMTP / AWS SES credentials configured in .env. Messages will log to service console. Set SMTP_HOST/USER/PASS or GMAIL_USER/GMAIL_APP_PASSWORD for internet email dispatch.',
    options: { jsonTransport: true },
  };
}

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  const choice = selectEmailTransport();
  // Switched rather than passed straight through: createTransport is overloaded
  // per transport, so a union of option shapes matches no single overload.
  transporter =
    choice.kind === 'ses'
      ? nodemailer.createTransport(choice.options)
      : choice.kind === 'json'
        ? nodemailer.createTransport(choice.options)
        : nodemailer.createTransport(choice.options);
  console.log(choice.description);

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const transport = await getTransporter();

  const mailOptions = {
    from: `TenderBazaar <${config.aws.sesFromEmail}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    if (config.isDev) {
      console.log(`[Email] Dev mode - email to ${to}:`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Message ID: ${info.messageId}`);
    } else {
      console.log(`[Email] Sent to ${to} - Message ID: ${info.messageId}`);
    }
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    throw error;
  }
}

export async function sendTenderAlertEmail(
  to: string,
  alertName: string,
  tenders: TenderAlertItem[]
): Promise<void> {
  const subject = `${tenders.length} new tender${tenders.length !== 1 ? 's' : ''} match '${alertName}' - TenderBazaar`;
  const html = tenderAlertTemplate(alertName, tenders);
  await sendEmail(to, subject, html);
}

export async function sendDeadlineReminderEmail(
  to: string,
  tender: DeadlineTenderItem
): Promise<void> {
  const subject = `Deadline approaching: ${tender.title} - TenderBazaar`;
  const html = deadlineReminderTemplate(tender);
  await sendEmail(to, subject, html);
}

export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<void> {
  const frontendUrl = config.frontendUrl;
  const subject = `Welcome to TenderBazaar, ${userName}!`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TenderBazaar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1B2845; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #FF6B35; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                TenderBazaar
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                Welcome aboard, ${userName}!
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #6B7280; line-height: 1.6; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                You've joined India's smartest tender discovery platform. Here's how to get started:
              </p>

              <!-- Step 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="48" style="vertical-align: top;">
                    <div style="width: 36px; height: 36px; background-color: #FF6B35; border-radius: 50%; text-align: center; line-height: 36px; color: #FFFFFF; font-weight: 700; font-size: 16px; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">1</div>
                  </td>
                  <td style="vertical-align: top; padding-top: 6px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Complete Your Company Profile</h4>
                    <p style="margin: 0; font-size: 14px; color: #6B7280; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Add your business details for AI-powered eligibility matching.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="48" style="vertical-align: top;">
                    <div style="width: 36px; height: 36px; background-color: #FF6B35; border-radius: 50%; text-align: center; line-height: 36px; color: #FFFFFF; font-weight: 700; font-size: 16px; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">2</div>
                  </td>
                  <td style="vertical-align: top; padding-top: 6px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Set Up Smart Alerts</h4>
                    <p style="margin: 0; font-size: 14px; color: #6B7280; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Get notified when tenders matching your criteria are published.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="48" style="vertical-align: top;">
                    <div style="width: 36px; height: 36px; background-color: #FF6B35; border-radius: 50%; text-align: center; line-height: 36px; color: #FFFFFF; font-weight: 700; font-size: 16px; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">3</div>
                  </td>
                  <td style="vertical-align: top; padding-top: 6px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Explore Tenders</h4>
                    <p style="margin: 0; font-size: 14px; color: #6B7280; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Browse thousands of government tenders from 50+ portals across India.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 14px 40px; background-color: #00D4AA; color: #1B2845; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-align: center;">
                Need help? Reply to this email or visit our
                <a href="${frontendUrl}/support" style="color: #FF6B35; text-decoration: underline;">support page</a>.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-align: center;">
                &copy; ${new Date().getFullYear()} TenderBazaar. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(to, subject, html);
}
