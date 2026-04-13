import {
  addNotificationJob,
  notificationQueue,
  notificationWorker,
  NotificationJobType,
} from './queue/notification-queue';

import type { NotificationJobData, NotificationChannel } from './queue/notification-queue';

// Re-export provider functions for direct use by API server
export { sendEmail, sendTenderAlertEmail, sendDeadlineReminderEmail, sendWelcomeEmail } from './providers/email';
export { sendWhatsAppMessage, sendTenderAlertWhatsApp } from './providers/whatsapp';
export { sendPushNotification, sendMultiplePushNotifications } from './providers/push';
export { sendSms, sendOtpSms } from './providers/sms';

// Re-export templates
export { tenderAlertTemplate } from './templates/tender-alert';
export { deadlineReminderTemplate } from './templates/deadline-reminder';

// Re-export queue types and functions
export {
  addNotificationJob,
  notificationQueue,
  notificationWorker,
  NotificationJobType,
};
export type { NotificationJobData, NotificationChannel };

// Re-export template types
export type { TenderAlertItem } from './templates/tender-alert';
export type { DeadlineTenderItem } from './templates/deadline-reminder';
export type { PushNotificationPayload } from './providers/push';
export type { WhatsAppTenderItem } from './providers/whatsapp';

// ─── Standalone startup ────────────────────────────────────────────
// When run as `node dist/index.js` or `tsx src/index.ts` directly,
// start the worker and handle graceful shutdown.

const isMainModule =
  require.main === module ||
  process.argv[1]?.endsWith('notification-service/src/index.ts') ||
  process.argv[1]?.endsWith('notification-service/dist/index.js');

if (isMainModule) {
  console.log('[NotificationService] Starting notification worker...');
  console.log(`[NotificationService] Worker concurrency: 5`);
  console.log(`[NotificationService] Queue: notifications`);

  async function shutdown(signal: string) {
    console.log(`\n[NotificationService] Received ${signal}, shutting down gracefully...`);

    try {
      // Close the worker first (stop processing new jobs)
      await notificationWorker.close();
      console.log('[NotificationService] Worker closed');

      // Then close the queue
      await notificationQueue.close();
      console.log('[NotificationService] Queue closed');

      process.exit(0);
    } catch (error) {
      console.error('[NotificationService] Error during shutdown:', error);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason) => {
    console.error('[NotificationService] Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[NotificationService] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  console.log('[NotificationService] Ready and processing jobs');
}
