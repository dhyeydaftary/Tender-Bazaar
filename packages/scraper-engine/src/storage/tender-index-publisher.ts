/**
 * Tender index publisher (producer side)
 *
 * Publishes ID-only "please index this tender" jobs onto the shared
 * `tender-index` BullMQ queue. The api-server owns the consumer, the
 * Elasticsearch client and the document mapping.
 *
 * This package stays PRODUCER-ONLY on purpose:
 *   - it does NOT import @elastic/elasticsearch (not a dependency here)
 *   - it does NOT build Elasticsearch documents
 *   - it does NOT know the index name or mapping
 *
 * That avoids a second PostgreSQL -> Elasticsearch projection drifting from the
 * one in api-server, and avoids any cross-package source import (scraper-engine
 * compiles with `rootDir: src` and has no path aliases, so importing api-server
 * source would break both the build and the Docker `dist/` layout).
 *
 * The only contract shared between the two packages is the queue name and the
 * job payload shape below.
 *
 * Failure policy: enqueueing is best-effort and NEVER throws. A tender is
 * already safely in PostgreSQL by the time we get here, and scraping must not
 * stop because Redis is unavailable. A failed enqueue is logged loudly and
 * counted; the tender stays stale in Elasticsearch until the api-server's
 * boot-time full reindex picks it up. This is a documented limitation of the
 * current design (no outbox table, no periodic reconciliation).
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('TenderIndexPublisher');

// ─── Contract shared with api-server (packages/api-server/src/queue) ────────

export type TenderIndexOp = 'index' | 'delete';

export interface TenderIndexJobData {
  /** Prisma Tender.id — also used as the Elasticsearch _id by the consumer. */
  tenderId: string;
  op: TenderIndexOp;
  /** Provenance for logs only; the consumer never builds a document from it. */
  reason?: string;
}

// ─── Lazy queue ─────────────────────────────────────────────────────────────

let queue: Queue<TenderIndexJobData> | null = null;
let connection: IORedis | null = null;
let disabled = false;

/** Count of enqueue failures, surfaced in run logs so drift is visible. */
let failedEnqueues = 0;

export function getFailedEnqueueCount(): number {
  return failedEnqueues;
}

function getQueue(): Queue<TenderIndexJobData> | null {
  if (disabled) return null;
  if (queue) return queue;

  try {
    connection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: true,
    });
    connection.on('error', (err) =>
      logger.warn('Redis error on index queue connection', { error: err.message }),
    );

    queue = new Queue<TenderIndexJobData>(config.queue.tenderIndexName, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
    return queue;
  } catch (error) {
    // Could not even construct the queue — stop trying for this process.
    disabled = true;
    logger.error(
      'Could not create the tender-index queue; Elasticsearch sync is disabled for ' +
      'this process. Tenders remain correct in PostgreSQL and will be picked up by ' +
      "the api-server's boot-time full reindex.",
      { error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Enqueue one tender for (re)indexing. Returns whether the job was accepted.
 */
export async function publishTenderIndex(
  tenderId: string,
  op: TenderIndexOp = 'index',
  reason?: string,
): Promise<boolean> {
  const q = getQueue();
  if (!q) {
    failedEnqueues++;
    return false;
  }

  try {
    await q.add(op, { tenderId, op, reason });
    return true;
  } catch (error) {
    failedEnqueues++;
    logger.error(
      `FAILED to enqueue Elasticsearch ${op} for tender ${tenderId}. The tender IS ` +
      `saved in PostgreSQL (source of truth) and is NOT lost, but it will not appear ` +
      `in search until the api-server restarts and runs its boot-time full reindex.`,
      { tenderId, op, reason, error: error instanceof Error ? error.message : String(error) },
    );
    return false;
  }
}

/**
 * Enqueue a batch in one round trip.
 *
 * Preferred when a whole listing page has just been saved: one `addBulk` instead
 * of N `add` calls keeps the Redis cost per page roughly constant.
 */
export async function publishTenderIndexBulk(
  tenderIds: string[],
  reason?: string,
): Promise<number> {
  const unique = [...new Set(tenderIds.filter(Boolean))];
  if (unique.length === 0) return 0;

  const q = getQueue();
  if (!q) {
    failedEnqueues += unique.length;
    return 0;
  }

  try {
    await q.addBulk(
      unique.map((tenderId) => ({
        name: 'index' as const,
        data: { tenderId, op: 'index' as const, reason },
      })),
    );
    return unique.length;
  } catch (error) {
    failedEnqueues += unique.length;
    logger.error(
      `FAILED to enqueue Elasticsearch indexing for ${unique.length} tender(s). They ARE ` +
      `saved in PostgreSQL (source of truth) and are NOT lost, but they will not appear ` +
      `in search until the api-server restarts and runs its boot-time full reindex.`,
      { count: unique.length, reason, error: error instanceof Error ? error.message : String(error) },
    );
    return 0;
  }
}

/** Close the queue and its Redis connection. Safe if nothing was created. */
export async function closeTenderIndexPublisher(): Promise<void> {
  if (queue) {
    await queue.close().catch(() => {});
    queue = null;
  }
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}
