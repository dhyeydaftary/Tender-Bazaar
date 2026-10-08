/**
 * Scraper job publisher (producer side)
 *
 * Publishes manual scrape requests onto the shared `scraper-jobs` BullMQ queue.
 * The scraper engine owns the consumer, the 13 scraper classes and the whole
 * ScrapingRun lifecycle.
 *
 *   admin UI ──► api-server ──enqueue──► Redis (BullMQ 'scraper-jobs')
 *                                            │
 *   scraper-engine ScrapingScheduler worker ──┴─► executeScrapeRun()
 *        createRun(PENDING) → startRun(RUNNING) → scrape() → completeRun(COMPLETED)
 *
 * This mirrors packages/scraper-engine/src/storage/tender-index-publisher.ts,
 * which publishes in the opposite direction. The two services stay decoupled:
 * the only shared contract is the queue name and the job payload shape below.
 * Deliberately NOT an HTTP call to the engine — that would couple availability,
 * bypass the queue's retry/backoff, and add the repo's only service-to-service
 * HTTP dependency.
 *
 * This package stays producer-only: it does not import scraper code, does not
 * execute scrapes, and does not write ScrapingRun rows. The engine creates the
 * single authoritative run for each job.
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../config/env';

// ─── Contract shared with scraper-engine ────────────────────────────────────
// Mirrors ScraperJobData in packages/scraper-engine/src/scheduler/scheduler.ts.
// Both sides must agree on the queue name and these fields.

export const SCRAPER_JOBS_QUEUE = process.env.SCRAPER_JOBS_QUEUE || 'scraper-jobs';

/** Matches the engine's JobType.SCRAPE_PORTAL value. */
const JOB_TYPE_SCRAPE_PORTAL = 'SCRAPE_PORTAL';

export interface ScraperJobData {
  jobType: string;
  /**
   * The scraper REGISTRY KEY (e.g. 'gem', 'cppp', 'westbengal') — not the
   * human-readable ScraperHealth.portalName. The engine resolves this through
   * getPortalConfig()/getAllScraperClasses(), which are keyed by it.
   */
  portalName: string;
  triggeredBy: 'schedule' | 'manual' | 'retry';
  maxPages?: number;
  startedAt?: string;
  fullRescrape?: boolean;
}

// ─── Portal name → registry key ─────────────────────────────────────────────

/**
 * Convert a ScraperHealth.portalName into the engine's registry key.
 *
 * The two naming schemes differ only by case for every portal currently
 * registered, verified across all 13: GeM→gem, CPPP→cppp, eProcure→eprocure,
 * Gujarat→gujarat, Maharashtra→maharashtra, Rajasthan→rajasthan,
 * Karnataka→karnataka, TamilNadu→tamilnadu, UP→up, MP→mp, Delhi→delhi,
 * Kerala→kerala, WestBengal→westbengal.
 *
 * Using the existing convention avoids maintaining a second portal registry
 * here that could drift from PORTAL_CONFIGS. If a future portal is registered
 * with a name that is not simply its key in another case, the engine will
 * reject the job with "Unknown portal" and the run will be recorded as failed —
 * a visible failure rather than a silent mismatch.
 */
export function portalNameToRegistryKey(portalName: string): string {
  return portalName.toLowerCase();
}

// ─── Lazy queue ─────────────────────────────────────────────────────────────

let queue: Queue<ScraperJobData> | null = null;
let connection: IORedis | null = null;

function getQueue(): Queue<ScraperJobData> {
  if (!queue) {
    // BullMQ requires maxRetriesPerRequest: null on connections it uses.
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    connection.on('error', (err) =>
      console.error('[ScraperJobPublisher] Redis error:', err.message),
    );

    queue = new Queue<ScraperJobData>(SCRAPER_JOBS_QUEUE, {
      connection,
      // Job options are intentionally minimal: the engine's worker owns retry,
      // backoff and concurrency for this queue. Matching the engine's defaults
      // here would duplicate that policy in two places.
    });
  }
  return queue;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Enqueue a manual scrape for one portal.
 *
 * Throws on failure so the caller can return a real error to the admin instead
 * of reporting a success that never happened.
 */
export async function enqueueScrapeJob(
  portalName: string,
  options?: { maxPages?: number },
): Promise<{ jobId: string; registryKey: string }> {
  const registryKey = portalNameToRegistryKey(portalName);

  const data: ScraperJobData = {
    jobType: JOB_TYPE_SCRAPE_PORTAL,
    portalName: registryKey,
    triggeredBy: 'manual',
    fullRescrape: false,
    startedAt: new Date().toISOString(),
    ...(options?.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
  };

  const job = await getQueue().add(JOB_TYPE_SCRAPE_PORTAL, data, {
    // Same id shape the engine's own scheduler uses, so jobs from either
    // producer look alike in the queue.
    jobId: `scrape-${registryKey}-${Date.now()}`,
  });

  console.log(
    `[ScraperJobPublisher] Enqueued manual scrape for ${portalName} (key: ${registryKey}, job: ${job.id})`,
  );

  return { jobId: String(job.id), registryKey };
}

/** Close the queue and its Redis connection. Safe if nothing was created. */
export async function closeScraperJobPublisher(): Promise<void> {
  if (queue) {
    await queue.close().catch(() => {});
    queue = null;
  }
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}
