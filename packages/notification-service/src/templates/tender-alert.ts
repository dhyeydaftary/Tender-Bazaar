import { config } from '../config';

export interface TenderAlertItem {
  id: string;
  title: string;
  organization: string;
  estimatedValue?: number;
  bidSubmissionDeadline: Date | string;
  state?: string;
  category?: string;
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

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function tenderAlertTemplate(
  alertName: string,
  tenders: TenderAlertItem[]
): string {
  const frontendUrl = config.frontendUrl;
  const count = tenders.length;

  const tenderCards = tenders
    .map(
      (t) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #E5E7EB;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                  ${t.title}
                </h3>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #6B7280; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                  ${t.organization}
                </p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">
                  <tr>
                    <td style="padding-right: 20px;">
                      <span style="font-size: 12px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Value</span><br/>
                      <span style="font-size: 14px; font-weight: 600; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${formatValue(t.estimatedValue)}</span>
                    </td>
                    <td style="padding-right: 20px;">
                      <span style="font-size: 12px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Deadline</span><br/>
                      <span style="font-size: 14px; font-weight: 600; color: #DC2626; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${formatDate(t.bidSubmissionDeadline)}</span>
                    </td>
                    ${
                      t.state
                        ? `<td>
                      <span style="font-size: 12px; color: #9CA3AF; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">Location</span><br/>
                      <span style="font-size: 14px; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">${t.state}</span>
                    </td>`
                        : ''
                    }
                  </tr>
                </table>
              </td>
              <td width="120" style="vertical-align: middle; text-align: right;">
                <a href="${frontendUrl}/tenders/${t.id}" style="display: inline-block; padding: 10px 20px; background-color: #FF6B35; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                  View Tender
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${count} new tenders match '${alertName}'</title>
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
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                ${count} new tender${count !== 1 ? 's' : ''} match '${alertName}'
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #6B7280; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                Here are the latest tenders matching your alert criteria.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${tenderCards}
              </table>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/dashboard/alerts" style="display: inline-block; padding: 14px 32px; background-color: #00D4AA; color: #1B2845; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 700; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      View All Matches
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
                You received this email because of your alert '${alertName}'.
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
