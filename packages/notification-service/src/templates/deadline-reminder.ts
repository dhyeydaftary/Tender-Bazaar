import { config } from '../config';

export interface DeadlineTenderItem {
  id: string;
  title: string;
  organization: string;
  estimatedValue?: number;
  bidSubmissionDeadline: Date | string;
  referenceNumber?: string;
  state?: string;
}

function formatValue(value?: number): string {
  if (!value || value <= 0) return 'Not Disclosed';
  if (value >= 10_000_000) {
    return `\u20B9 ${(value / 10_000_000).toFixed(2)} Cr`;
  }
  if (value >= 100_000) {
    return `\u20B9 ${(value / 100_000).toFixed(2)} L`;
  }
  return `\u20B9 ${value.toLocaleString('en-IN')}`;
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function getDeadlineCountdown(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
  return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
}

export function deadlineReminderTemplate(tender: DeadlineTenderItem): string {
  const frontendUrl = config.frontendUrl;
  const countdown = getDeadlineCountdown(tender.bidSubmissionDeadline);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tender Deadline Approaching!</title>
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
          <!-- Alert Banner -->
          <tr>
            <td style="background-color: #FEF2F2; padding: 16px 32px; border-bottom: 2px solid #DC2626;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #DC2626; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      Tender Deadline Approaching!
                    </h2>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #991B1B; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      Time remaining: <strong>${countdown}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 32px;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                ${tender.title}
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-size: 13px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Organization</span><br/>
                    <span style="font-size: 15px; font-weight: 500; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${tender.organization}</span>
                  </td>
                </tr>
                ${
                  tender.referenceNumber
                    ? `<tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-size: 13px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Reference No.</span><br/>
                    <span style="font-size: 15px; font-weight: 500; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${tender.referenceNumber}</span>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-size: 13px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Estimated Value</span><br/>
                    <span style="font-size: 15px; font-weight: 600; color: #00D4AA; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${formatValue(tender.estimatedValue)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-size: 13px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Submission Deadline</span><br/>
                    <span style="font-size: 15px; font-weight: 700; color: #DC2626; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${formatDateTime(tender.bidSubmissionDeadline)}</span>
                  </td>
                </tr>
                ${
                  tender.state
                    ? `<tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-size: 13px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Location</span><br/>
                    <span style="font-size: 15px; font-weight: 500; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${tender.state}</span>
                  </td>
                </tr>`
                    : ''
                }
              </table>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/tenders/${tender.id}" style="display: inline-block; padding: 14px 40px; background-color: #FF6B35; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      Submit Bid Now
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
                <a href="${frontendUrl}/dashboard/alerts" style="color: #FF6B35; text-decoration: underline;">Manage alerts</a> |
                <a href="${frontendUrl}/unsubscribe" style="color: #FF6B35; text-decoration: underline;">Unsubscribe</a>
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
}
