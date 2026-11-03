/**
 * Tender → Elasticsearch index queue
 *
 * Closes the synchronisation gap between PostgreSQL and Elasticsearch.
 *
 * Producers enqueue an ID-ONLY job; this worker re-reads the tender from
 * PostgreSQL and projects it through the single shared document builder
 * (toTenderDocument). That keeps PostgreSQL authoritative: a job payload can
 * never carry stale field values into the index, because it carries no values.
 *
 *   scraper-engine  ──enqueue {tenderId, op}──►  Redis (BullMQ 'tender-index')
 *                                                      │
 *   api-server worker ──findUnique(tenderId)──► indexTender() ──► Elasticsearch
 *
 * Idempotency: indexTender uses the Prisma Tender.id as the Elasticsearch _id,
 * so a retried or duplicated job updates the same document instead of creating
 * another one. Re-running a job is always safe.
 *
 * Recovery: the api-server boot-time full reindex (src/index.ts) remains in
 * place and is the reconciliation mechanism for any sync event that never made
 * it onto the queue. See the limitation note in the feature report.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../config/env';
import { ELASTICSEARCH_ENABLED } from '../config/elasticsearch';
import { prisma } from '../config/database';
import { indexTender, deleteTenderFromIndex } from '../config/elasticsearch-setup';

// ─── Types ──────────────────────────────────────────────────────────────────

export const TENDER_INDEX_QUEUE = 'tender-index';

export type TenderIndexOp = 'index' | 'delete';

export interface TenderIndexJobData {
  /** Prisma Tender.id — also the Elasticsearch _id. */
  tenderId: string;
  op: TenderIndexOp;
  /** Optional provenance, for log/debug only. Never used to build the document. */
  reason?: string;
}

// ─── Connection ─────────────────────────────────────────────────────────────

/**
 * BullMQ requires `maxRetriesPerRequest: null` on connections used for blocking
 * commands and refuses to start a Worker otherwise.
 */
function createConnection(): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

// ─── Queue (lazily created) ─────────────────────────────────────────────────

let queue: Queue<TenderIndexJobData> | null = null;
let queueConnection: IORedis | null = null;

/**
 * The queue handle used by in-process producers (e.g. the admin tender
 * mutations). Created on first use so merely importing this module does not
 * open a Redis connection.
 */
export function getTenderIndexQueue(): Queue<TenderIndexJobData> {
  if (!queue) {
    queueConnection = createConnection();
    queueConnection.on('error', (err) =>
      console.error('[TenderIndexQueue] Redis error:', err.message),
    );

    queue = new Queue<TenderIndexJobData>(TENDER_INDEX_QUEUE, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queue;
}

/**
 * Best-effort enqueue for in-process producers.
 *
 * Never throws: a failure to enqueue must not fail the PostgreSQL operation that
 * triggered it. The error is logged loudly because the tender will stay stale in
 * Elasticsearch until the next api-server boot reindex.
 */
export async function enqueueTenderIndex(
  tenderId: string,
  op: TenderIndexOp,
  reason?: string,
): Promise<boolean> {
  try {
    await getTenderIndexQueue().add(
      op,
      { tenderId, op, reason },
      { jobId: `${op}:${tenderId}:${Date.now()}` },
    );
    return true;
  } catch (error) {
    console.error(
      `[TenderIndexQueue] FAILED to enqueue ${op} for tender ${tenderId}. ` +
      `PostgreSQL is unchanged and correct, but Elasticsearch will remain stale ` +
      `for this tender until the next api-server restart (boot-time full reindex). ` +
      `Reason: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

// ─── Worker ─────────────────────────────────────────────────────────────────

let worker: Worker<TenderIndexJobData> | null = null;
let workerConnection: IORedis | null = null;

/**
 * Start the indexing worker. Idempotent — calling it twice does not create a
 * second worker.
 */
export function startTenderIndexWorker(): Worker<TenderIndexJobData> {
  if (worker) {
    console.log('[TenderIndexWorker] Already running');
    return worker;
  }

  workerConnection = createConnection();
  workerConnection.on('error', (err) =>
    console.error('[TenderIndexWorker] Redis error:', err.message),
  );

  worker = new Worker<TenderIndexJobData>(
    TENDER_INDEX_QUEUE,
    async (job: Job<TenderIndexJobData>) => {
      const { tenderId, op } = job.data;

      // With Elasticsearch switched off the queue is still consumed, so the
      // scrapers' index jobs never pile up in Redis; they simply complete
      // without touching an index that is not there.
      if (!ELASTICSEARCH_ENABLED) {
        return { tenderId, op, result: 'skipped: elasticsearch disabled' };
      }

      if (op === 'delete') {
        await deleteTenderFromIndex(tenderId);
        return { tenderId, op, result: 'deleted' };
      }

      // Re-read from PostgreSQL: the source of truth decides what gets indexed.
      const tender = await prisma.tender.findUnique({ where: { id: tenderId } });

      if (!tender) {
        // Deleted between enqueue and processing. Make the index match reality
        // rather than failing the job forever.
        await deleteTenderFromIndex(tenderId);
        return { tenderId, op, result: 'absent-in-postgres: removed from index' };
      }

      await indexTender(tender);
      return { tenderId, op, result: 'indexed' };
    },
    {
      connection: workerConnection,
      // Modest on purpose: this runs inside the HTTP API process.
      concurrency: 2,
    },
  );

  worker.on('failed', (job, error) => {
    const attempts = job ? `${job.attemptsMade}/${job.opts.attempts}` : '?';
    console.error(
      `[TenderIndexWorker] ${job?.data.op ?? 'job'} failed for tender ` +
      `${job?.data.tenderId ?? 'unknown'} (attempt ${attempts}): ${error.message}`,
    );
  });

  worker.on('error', (error) => {
    console.error('[TenderIndexWorker] Worker error:', error.message);
  });

  console.log('[TenderIndexWorker] Started (queue: tender-index, concurrency: 2)');
  return worker;
}

/**
 * Close the worker, queue and their Redis connections. Safe to call when
 * nothing was started.
 */
export async function stopTenderIndexWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (workerConnection) {
    await workerConnection.quit().catch(() => {});
    workerConnection = null;
  }
  if (queueConnection) {
    await queueConnection.quit().catch(() => {});
    queueConnection = null;
  }
  console.log('[TenderIndexWorker] Stopped');
}
