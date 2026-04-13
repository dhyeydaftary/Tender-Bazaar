import nodemailer from 'nodemailer';
import { SES } from '@aws-sdk/client-ses';
import { config } from '../config';
import {
  tenderAlertTemplate,
  TenderAlertItem,
} from '../templates/tender-alert';
import {
  deadlineReminderTemplate,
  DeadlineTenderItem,
} from '../templates/deadline-reminder';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (config.isDev) {
    // In development, use a JSON transport that logs to console
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    console.log('[Email] Using JSON transport (dev mode)');
  } else {
    // In production, use AWS SES
    const ses = new SES({ region: config.aws.region });
    transporter = nodemailer.createTransport({
      SES: { ses, aws: { SES } },
    } as nodemailer.TransportOptions);
    console.log('[Email] Using AWS SES transport');
  }

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
