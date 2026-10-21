/**
 * Producer for the shared `notifications` BullMQ queue.
 *
 * Deliberately producer-only, mirroring queue/scraper-job-publisher.ts: this
 * package does not import @tenderbazaar/notification-service (it is not a
 * dependency, and the worker runs as its own process). Both sides agree only on
 * the queue name and the job payload shape below, which mirrors
 * `NotificationJobData` in
 * packages/notification-service/src/queue/notification-queue.ts.
 *
 * Retry policy is intentionally NOT redefined here. The consuming worker's
 * queue already declares `attempts: 3` with exponential backoff, and job
 * options set by a producer would not override the worker's own defaults for
 * that queue; the existing policy stands.
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../config/env';

/** Must match the queue name the notification-service worker listens on. */
export const NOTIFICATIONS_QUEUE = process.env.NOTIFICATIONS_QUEUE || 'notifications';

/** Mirrors NotificationJobType in the notification service. */
export type NotificationJobType =
  | 'TENDER_ALERT'
  | 'DEADLINE_REMINDER'
  | 'SUBSCRIPTION_EXPIRY'
  | 'NEW_CORRIGENDUM'
  | 'TENDER_RESULT'
  | 'ELIGIBILITY_RESULT'
  | 'SYSTEM';

/** Mirrors NotificationChannel in the notification service. */
export type NotificationJobChannel = 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS' | 'IN_APP';

export interface NotificationJobData {
  userId: string;
  type: NotificationJobType;
  channel: NotificationJobChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  recipientEmail?: string;
  recipientPhone?: string;
  fcmToken?: string;
}

let queue: Queue<NotificationJobData> | null = null;
let connection: IORedis | null = null;

/**
 * Created on first use so importing this module does not open a Redis
 * connection (matters for tests and for the scraper/CLI entry points).
 */
function getQueue(): Queue<NotificationJobData> {
  if (!queue) {
    connection = new IORedis(env.REDIS_URL, {
      // Required by BullMQ for the connections it uses.
      maxRetriesPerRequest: null,
    });
    queue = new Queue<NotificationJobData>(NOTIFICATIONS_QUEUE, { connection });
  }
  return queue;
}

/**
 * Enqueue one notification job.
 *
 * Resolves to the job id, or null when enqueueing failed. A failure is logged
 * and swallowed on purpose: the in-app notification row has already been
 * written by the caller, so a Redis hiccup must not fail the whole alert run
 * or lose the matches already recorded.
 */
export async function publishNotificationJob(
  jobData: NotificationJobData,
): Promise<string | null> {
  try {
    const job = await getQueue().add(`${jobData.type}:${jobData.channel}`, jobData);
    return job.id ?? null;
  } catch (error) {
    // No PII and no credentials: user id and channel only.
    console.error(
      `[NotificationPublisher] Failed to enqueue ${jobData.type}/${jobData.channel} for user ${jobData.userId}:`,
      (error as Error).message,
    );
    return null;
  }
}

/** Close the queue and its Redis connection. Safe to call when never used. */
export async function closeNotificationPublisher(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
