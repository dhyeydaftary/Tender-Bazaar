/**
 * Periodic alert evaluation.
 *
 * `alertService.matchTendersToAlerts(frequency)` existed but had no caller
 * anywhere in the repository — no cron, no route, no worker. Alerts were stored
 * correctly and then never evaluated, so no alert ever produced a notification.
 * This module is that missing producer.
 *
 * WHY HERE
 * --------
 * The evaluation needs Prisma, the alert service and the plan service, all of
 * which live in this package; the notification-service is a separate process
 * that only consumes. The API server already owns a BullMQ lifecycle
 * (`startTenderIndexWorker` / graceful shutdown in index.ts), so hooking in
 * here is the smallest reliable integration point and adds no dependency. The
 * pattern below — lazy Queue/Worker creation, `start*`/`stop*`, shared Redis
 * options — mirrors queue/tender-index-queue.ts.
 *
 * CADENCE
 * -------
 * Derived from the existing AlertFrequency enum and the windows
 * `getSinceDate()` already assumes for a first run (1 hour / 24 hours / 7 days)
 * — not newly invented:
 *
 *   INSTANT -> every hour
 *   DAILY   -> every 24 hours
 *   WEEKLY  -> every 7 days
 *
 * DUPLICATE SUPPRESSION
 * ---------------------
 * Three independent layers:
 *
 *   1. Repeatable jobs use a stable `jobId` per frequency, so BullMQ keeps one
 *      schedule per frequency however many times this starts.
 *   2. The worker runs with `concurrency: 1`, so two runs cannot overlap within
 *      this process.
 *   3. A short Redis lock guards against overlap across processes (two API
 *      instances sharing one Redis), and `matchTendersToAlerts` itself only
 *      considers tenders published since `alert.lastMatchedAt`, so a tender is
 *      never notified twice even if a run repeats.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../config/env';
import { alertService } from '../modules/alerts/service';

export const ALERT_EVALUATION_QUEUE = process.env.ALERT_EVALUATION_QUEUE || 'alert-evaluation';

type AlertFrequency = 'INSTANT' | 'DAILY' | 'WEEKLY';

interface AlertEvaluationJobData {
  frequency: AlertFrequency;
}

const HOUR_MS = 60 * 60 * 1000;

/** Cadence per frequency, matching the windows getSinceDate() assumes. */
const CADENCE_MS: Record<AlertFrequency, number> = {
  INSTANT: HOUR_MS,
  DAILY: 24 * HOUR_MS,
  WEEKLY: 7 * 24 * HOUR_MS,
};

/** Lock TTL: long enough for a slow run, short enough to self-heal on crash. */
const LOCK_TTL_SECONDS = 10 * 60;

let queue: Queue<AlertEvaluationJobData> | null = null;
let worker: Worker<AlertEvaluationJobData> | null = null;
let queueConnection: IORedis | null = null;
let workerConnection: IORedis | null = null;
let lockConnection: IORedis | null = null;

const redisOptions = { maxRetriesPerRequest: null as null };

function getQueue(): Queue<AlertEvaluationJobData> {
  if (!queue) {
    queueConnection = new IORedis(env.REDIS_URL, redisOptions);
    queue = new Queue<AlertEvaluationJobData>(ALERT_EVALUATION_QUEUE, {
      connection: queueConnection,
    });
  }
  return queue;
}

/**
 * Cross-process guard. Returns false when another run already holds the lock,
 * in which case this run is skipped rather than queued behind it — the next
 * tick will pick up anything missed, because the watermark is per alert.
 */
async function acquireLock(frequency: AlertFrequency): Promise<boolean> {
  if (!lockConnection) lockConnection = new IORedis(env.REDIS_URL, redisOptions);
  const result = await lockConnection.set(
    `alert-eval-lock:${frequency}`,
    String(Date.now()),
    'EX',
    LOCK_TTL_SECONDS,
    'NX',
  );
  return result === 'OK';
}

async function releaseLock(frequency: AlertFrequency): Promise<void> {
  if (lockConnection) await lockConnection.del(`alert-eval-lock:${frequency}`);
}

/**
 * Register one repeatable job per frequency and start the worker that runs
 * them. Idempotent: calling it twice does not double-schedule, because each
 * repeatable job carries a stable id.
 */
export function startAlertScheduler(): void {
  if (worker) return;

  const q = getQueue();

  // Register the schedules. Fire-and-forget with explicit logging: a Redis
  // problem here must not prevent the HTTP server from starting.
  void (async () => {
    for (const frequency of Object.keys(CADENCE_MS) as AlertFrequency[]) {
      try {
        await q.add(
          `evaluate:${frequency}`,
          { frequency },
          {
            jobId: `alert-eval-${frequency}`,
            repeat: { every: CADENCE_MS[frequency] },
            removeOnComplete: 50,
            removeOnFail: 50,
          },
        );
      } catch (error) {
        console.error(
          `[AlertScheduler] Could not schedule ${frequency} evaluation:`,
          (error as Error).message,
        );
      }
    }
  })();

  workerConnection = new IORedis(env.REDIS_URL, redisOptions);

  worker = new Worker<AlertEvaluationJobData>(
    ALERT_EVALUATION_QUEUE,
    async (job: Job<AlertEvaluationJobData>) => {
      const { frequency } = job.data;

      if (!await acquireLock(frequency)) {
        console.log(`[AlertScheduler] ${frequency} evaluation already running elsewhere; skipping`);
        return { skipped: true };
      }

      const startedAt = Date.now();
      try {
        const result = await alertService.matchTendersToAlerts(frequency);
        console.log(
          `[AlertScheduler] ${frequency}: ${result.alertsProcessed} alert(s), ` +
            `${result.totalMatches} match(es) in ${Date.now() - startedAt}ms`,
        );
        return result;
      } finally {
        await releaseLock(frequency);
      }
    },
    {
      connection: workerConnection,
      // Serialises runs inside this process; combined with the Redis lock this
      // prevents overlapping evaluation of the same frequency.
      concurrency: 1,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(
      `[AlertScheduler] Job ${job?.id} (${job?.data?.frequency}) failed ` +
        `attempt ${job?.attemptsMade}:`,
      error?.message,
    );
  });

  console.log(
    `[AlertScheduler] Started (queue: ${ALERT_EVALUATION_QUEUE}; ` +
      'INSTANT hourly, DAILY daily, WEEKLY weekly)',
  );
}

/** Close the worker, queue and Redis connections. Safe if never started. */
export async function stopAlertScheduler(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  for (const conn of [workerConnection, queueConnection, lockConnection]) {
    if (conn) await conn.quit();
  }
  workerConnection = null;
  queueConnection = null;
  lockConnection = null;
}

/**
 * Run one evaluation immediately, bypassing the schedule.
 *
 * Exists for tests and for an operator-triggered run; the scheduler above is
 * what runs in normal operation.
 */
export async function evaluateAlertsNow(frequency: AlertFrequency) {
  return alertService.matchTendersToAlerts(frequency);
}
