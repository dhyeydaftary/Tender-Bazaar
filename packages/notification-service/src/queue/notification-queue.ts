import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { sendEmail, sendTenderAlertEmail, sendDeadlineReminderEmail } from '../providers/email';
import { sendWhatsAppMessage, sendTenderAlertWhatsApp } from '../providers/whatsapp';
import { sendPushNotification } from '../providers/push';
import { sendSms } from '../providers/sms';

// ─── Types ──────────────────────────────────────────────────────────

export enum NotificationJobType {
  TENDER_ALERT = 'TENDER_ALERT',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  SUBSCRIPTION_EXPIRY = 'SUBSCRIPTION_EXPIRY',
  NEW_CORRIGENDUM = 'NEW_CORRIGENDUM',
  TENDER_RESULT = 'TENDER_RESULT',
  ELIGIBILITY_RESULT = 'ELIGIBILITY_RESULT',
}

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS' | 'IN_APP';

export interface NotificationJobData {
  userId: string;
  type: NotificationJobType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  recipientEmail?: string;
  recipientPhone?: string;
  fcmToken?: string;
}

// ─── Redis Connection ───────────────────────────────────────────────

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on('connect', () => {
  console.log('[Queue] Redis connected');
});

connection.on('error', (err) => {
  console.error('[Queue] Redis error:', err.message);
});

// ─── Queue ──────────────────────────────────────────────────────────

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs for debugging
    },
  },
});

// ─── Worker ─────────────────────────────────────────────────────────

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { channel, type, title, message, data, recipientEmail, recipientPhone, fcmToken, userId } =
    job.data;

  console.log(
    `[Worker] Processing job ${job.id} - type: ${type}, channel: ${channel}, user: ${userId}`
  );

  switch (channel) {
    case 'EMAIL': {
      if (!recipientEmail) {
        throw new Error('recipientEmail is required for EMAIL channel');
      }

      // Use specialized email templates for certain types
      if (type === NotificationJobType.TENDER_ALERT && data?.alertName && data?.tenders) {
        await sendTenderAlertEmail(
          recipientEmail,
          data.alertName as string,
          data.tenders as Array<{
            id: string;
            title: string;
            organization: string;
            estimatedValue?: number;
            bidSubmissionDeadline: Date | string;
            state?: string;
            category?: string;
          }>
        );
      } else if (type === NotificationJobType.DEADLINE_REMINDER && data?.tender) {
        await sendDeadlineReminderEmail(
          recipientEmail,
          data.tender as {
            id: string;
            title: string;
            organization: string;
            estimatedValue?: number;
            bidSubmissionDeadline: Date | string;
            referenceNumber?: string;
            state?: string;
          }
        );
      } else {
        // Generic email for other notification types
        const html = buildGenericEmailHtml(title, message);
        await sendEmail(recipientEmail, title, html);
      }
      break;
    }

    case 'WHATSAPP': {
      if (!recipientPhone) {
        throw new Error('recipientPhone is required for WHATSAPP channel');
      }

      if (type === NotificationJobType.TENDER_ALERT && data?.alertName && data?.tenders) {
        await sendTenderAlertWhatsApp(
          recipientPhone,
          data.alertName as string,
          data.tenders as Array<{
            title: string;
            organization: string;
            estimatedValue?: number;
            bidSubmissionDeadline: Date | string;
          }>
        );
      } else {
        // Generic WhatsApp message
        await sendWhatsAppMessage(recipientPhone, 'generic_notification', [
          { name: 'title', value: title },
          { name: 'message', value: message },
        ]);
      }
      break;
    }

    case 'PUSH': {
      if (!fcmToken) {
        throw new Error('fcmToken is required for PUSH channel');
      }

      await sendPushNotification(fcmToken, {
        title,
        body: message,
        data: data
          ? Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
            )
          : undefined,
      });
      break;
    }

    case 'SMS': {
      if (!recipientPhone) {
        throw new Error('recipientPhone is required for SMS channel');
      }

      await sendSms(recipientPhone, `${title}: ${message}`);
      break;
    }

    case 'IN_APP': {
      // In-app notifications are stored directly in the database by the API server.
      // The worker just logs it here; actual DB write happens in the API layer.
      console.log(`[Worker] IN_APP notification for user ${userId}: ${title}`);
      break;
    }

    default:
      throw new Error(`Unknown notification channel: ${channel}`);
  }

  console.log(`[Worker] Job ${job.id} completed successfully`);
}

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  processNotification,
  {
    connection,
    concurrency: 5,
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed - ${job.data.type} via ${job.data.channel}`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(
    `[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`,
    err.message
  );
});

notificationWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

// ─── Helper ─────────────────────────────────────────────────────────

function buildGenericEmailHtml(title: string, message: string): string {
  const frontendUrl = config.frontendUrl;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: #1B2845; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #FF6B35; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                TenderBazaar
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #FFFFFF; padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2845; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                ${title}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #374151; line-height: 1.6; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                ${message}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 12px 32px; background-color: #FF6B35; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
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

// ─── Public API ─────────────────────────────────────────────────────

export async function addNotificationJob(
  jobData: NotificationJobData
): Promise<string> {
  const job = await notificationQueue.add(
    `${jobData.type}:${jobData.channel}`,
    jobData,
    {
      priority: getPriority(jobData.type),
    }
  );
  console.log(
    `[Queue] Added job ${job.id} - ${jobData.type} via ${jobData.channel} for user ${jobData.userId}`
  );
  return job.id!;
}

function getPriority(type: NotificationJobType): number {
  switch (type) {
    case NotificationJobType.DEADLINE_REMINDER:
      return 1; // Highest priority
    case NotificationJobType.TENDER_ALERT:
      return 2;
    case NotificationJobType.NEW_CORRIGENDUM:
      return 2;
    case NotificationJobType.ELIGIBILITY_RESULT:
      return 3;
    case NotificationJobType.SUBSCRIPTION_EXPIRY:
      return 4;
    case NotificationJobType.TENDER_RESULT:
      return 5;
    default:
      return 5;
  }
}
