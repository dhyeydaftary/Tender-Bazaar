/**
 * Scraper Engine — Main Entry Point
 *
 * Boots the complete scraper engine:
 * 1. Initializes database connection
 * 2. Creates storage writer
 * 3. Registers all portal health records
 * 4. Sets up event listeners (logging, notifications)
 * 5. Starts the scraping scheduler
 * 6. Starts the admin API server
 *
 * This file is meant to be run as the main process (Docker or CLI).
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { config, PORTAL_CONFIGS, getPortalConfig, assertApiSecurity } from './config';
import { createLogger } from './utils/logger';
import { scraperEvents } from './utils/events';
import { StorageWriter } from './storage/writer';
import { createAdminApi, type TriggerRunOutcome } from './api/server';
import { getAllScraperClasses } from './index';
import { ScrapingScheduler, type ScraperJobResult } from './scheduler/scheduler';
import { closeTenderIndexPublisher } from './storage/tender-index-publisher';
import type { ScrapeResult } from './scrapers/base-scraper';

const logger = createLogger('Main');

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  // Fail closed before anything else starts: in production the control API
  // must have a real shared secret, or the scheduler/portal endpoints would be
  // callable by anyone who can reach the port.
  assertApiSecurity();

  logger.info('Booting scraper engine...', {
    env: config.env,
    portals: PORTAL_CONFIGS.length,
    enabledPortals: PORTAL_CONFIGS.filter((p) => p.enabled).length,
  });

  // --- Database ---
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error('Failed to connect to database', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // --- Redis ---
  let redis: Redis | null = null;
  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis connection failed — running without Redis', {
      error: err instanceof Error ? err.message : String(err),
    });
    redis = null;
  }

  // --- Storage Writer ---
  const storageWriter = new StorageWriter(prisma);

  // Register health records for all portals
  for (const portal of PORTAL_CONFIGS) {
    await storageWriter.ensureHealthRecord(portal.name, portal.cronExpression);
  }
  logger.info('Portal health records initialized');

  // Recover runs left RUNNING by a process that was killed mid-scrape. This
  // used to happen only as a side effect of an administrator opening the
  // scrapers page (which also mutated data on a GET request).
  try {
    const recovered = await storageWriter.recoverStaleRuns();
    if (recovered > 0) {
      logger.warn('Recovered interrupted scraping runs from a previous process', {
        count: recovered,
      });
    }
  } catch (err) {
    logger.error('Could not recover stale runs', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // --- Event listeners ---
  setupEventListeners();

  // --- Shared scrape execution ---
  /**
   * Execute one scraping run for a portal and await its completion.
   *
   * This is the single place that instantiates a scraper, tracks the run via
   * StorageWriter and emits run events. Both the manual trigger (fire-and-forget)
   * and the scheduler's BullMQ worker (awaits the result) go through it, so
   * there is exactly one scrape code path.
   *
   * `portalKey` must be a registry key (PortalConfig.key).
   */
  async function executeScrapeRun(
    portalKey: string,
    triggeredBy: 'manual' | 'schedule' | 'retry' | 'catchup',
    maxPages?: number,
    fullRescrape = false,
  ): Promise<ScrapeResult> {
    const portalConfig = getPortalConfig(portalKey);
    if (!portalConfig) throw new Error(`Unknown portal: ${portalKey}`);

    const scraperClasses = getAllScraperClasses();
    const ScraperClass = (scraperClasses as Record<string, any>)[portalKey];
    if (!ScraperClass) throw new Error(`No scraper class for: ${portalKey}`);

    const pages = maxPages ?? portalConfig.maxPages;

    const run = await storageWriter.createRun(portalConfig.name, triggeredBy, pages);
    await storageWriter.startRun(run.id);

    scraperEvents.emit('run:start', {
      portalName: portalConfig.name,
      runId: run.id,
      triggeredBy,
      timestamp: new Date(),
    });

    let scraper: any;
    try {
      scraper = new ScraperClass({
        prisma,
        maxConcurrency: portalConfig.maxConcurrency,
        maxPages: pages,
        fullRescrape,
      });
      const result: ScrapeResult = await scraper.scrape();

      const duplicates = (result.skippedExisting ?? 0) + (result.updatedTenders ?? 0) > 0
        ? (result.skippedExisting ?? 0) + (result.updatedTenders ?? 0)
        : Math.max(0, result.totalFound - result.newTenders);

      await storageWriter.completeRun(run.id, {
        totalFound: result.totalFound,
        newTenders: result.newTenders,
        updatedTenders: result.updatedTenders,
        duplicates,
        errors: result.errors,
        pagesScraped: result.pagesScraped ?? 0,
      });

      scraperEvents.emit('run:complete', {
        portalName: portalConfig.name,
        runId: run.id,
        totalFound: result.totalFound,
        newTenders: result.newTenders,
        updatedTenders: result.updatedTenders,
        duplicates,
        errors: result.errors,
        duration: result.duration,
        pagesScraped: result.pagesScraped ?? 0,
        timestamp: new Date(),
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await storageWriter.failRun(run.id, error);

      scraperEvents.emit('run:error', {
        portalName: portalConfig.name,
        runId: run.id,
        error,
        duration: 0,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      // The scraper owns a Playwright browser; always release it. Prisma is shared
      // and owned by main(), so only close the browser here.
      if (scraper?.closeBrowser) {
        await scraper.closeBrowser().catch(() => {});
      }
    }
  }

  // --- Scheduler (declared before the manual trigger, which reads it) ---
  // Requires Redis (BullMQ + schedule persistence). Without it the engine still
  // serves the admin API and manual runs, and /api/health reports
  // schedulerRunning: false rather than pretending otherwise.
  let scheduler: ScrapingScheduler | null = null;

  // --- Manual trigger handler (kept fire-and-forget: the API returns immediately) ---
  async function triggerManualRun(portalKey: string): Promise<TriggerRunOutcome> {
    const portalConfig = getPortalConfig(portalKey);
    if (!portalConfig) throw new Error(`Unknown portal: ${portalKey}`);

    // If the scheduler is up, route through the queue so locking, retries and
    // concurrency limits apply. Otherwise run directly in-process.
    if (scheduler && scheduler.isRunning) {
      // Detailed variant: enqueueScrapeJob() returns the EXISTING job when the
      // per-portal lock refuses a new one, so its non-null return cannot say
      // whether anything was queued — which is exactly how the control API came
      // to report success for a run it had skipped.
      const outcome = await scheduler.enqueueScrapeJobDetailed(
        portalKey,
        'manual',
        portalConfig.maxPages,
      );
      return outcome.status === 'queued'
        ? { status: 'queued', jobId: outcome.job.id }
        : { status: 'already-running', jobId: outcome.job?.id };
    }

    void executeScrapeRun(portalKey, 'manual').catch(() => {
      // Already logged and recorded as a failed run by executeScrapeRun.
    });
    return { status: 'started-inline' };
  }

  if (redis) {
    scheduler = new ScrapingScheduler(redis, {
      concurrency: config.queue.concurrency,
      queueName: config.queue.name,
      // QUEUE_RETRY_ATTEMPTS / QUEUE_RETRY_BACKOFF_MS were documented but
      // unread: the scheduler hardcoded 3 / 60000. Passing them through makes
      // both variables live, and the defaults keep the previous behaviour.
      attempts: config.queue.retryAttempts,
      backoffMs: config.queue.retryBackoffMs,
      missedWindowSweepMs: config.missedWindows.sweepMs,
      missedWindowGraceMs: config.missedWindows.graceMs,
      maxCatchUpPerSweep: config.missedWindows.maxCatchUp,
      // PostgreSQL (ScraperHealth + AdminSetting) is authoritative for operator
      // intent, so admin enable/disable, cron edits and the pause flag actually
      // reach the scheduler — and survive a restart.
      scheduleSource: {
        getScheduleOverrides: () => storageWriter.getScheduleOverrides(),
        // Last ATTEMPTED run per portal, for missed-window detection. Reuses
        // the existing health projection rather than adding a query; lastRunAt
        // is written on both the success and failure paths, so a portal that
        // keeps failing is not mistaken for one that never fired.
        getPortalLastRuns: async () =>
          (await storageWriter.getAllHealth()).map((row) => ({
            portalName: row.portalName,
            lastRunAt: row.lastRunAt,
          })),
        getSchedulerPaused: () => storageWriter.getSchedulerPaused(),
        setSchedulerPaused: (paused: boolean) =>
          storageWriter.setSchedulerPaused(paused),
      },
    });

    // The worker calls this; portalName is a registry key.
    scheduler.registerScrapeHandler(async (
      portalName,
      maxPages,
      fullRescrape,
      triggeredBy,
    ): Promise<ScraperJobResult> => {
      const started = Date.now();

      // A queued job can sit in the queue across an admin change. Drop it
      // rather than scraping a portal the operator has just disabled.
      //
      // This applies to 'schedule', 'retry' AND 'catchup': all are
      // machine-initiated, and
      // an operator who disabled a portal does not expect the hourly retry
      // sweep to scrape it anyway. A 'manual' trigger is an explicit human
      // instruction and is still honoured.
      //
      // The result is flagged `skipped` so it cannot be mistaken for a
      // successful scrape. It previously returned a bare all-zero result, which
      // BullMQ counted as a success: the originating failure vanished from the failed
      // set with no HTTP request and no ScrapingRun row (Phase 8, §C.9).
      // Scheduler.retryFailedJobs() now also declines to retry a disabled
      // portal at all, so this branch is the second line of defence.
      const machineTriggered = (triggeredBy ?? 'schedule') !== 'manual';
      if (
        machineTriggered &&
        scheduler &&
        !(await scheduler.isSchedulingAllowed(portalName))
      ) {
        const skippedReason = 'portal disabled or scheduling paused';
        logger.warn('Dropping queued run — no scrape performed, no run record created', {
          portal: portalName,
          triggeredBy: triggeredBy ?? 'schedule',
          reason: skippedReason,
        });
        return {
          portalName,
          tendersFound: 0,
          tendersNew: 0,
          tendersDuplicate: 0,
          tendersFailed: 0,
          duration: Date.now() - started,
          errors: [],
          skipped: true,
          skippedReason,
        };
      }

      try {
        const result = await executeScrapeRun(
          portalName,
          triggeredBy ?? 'schedule',
          maxPages,
          fullRescrape ?? false,
        );
        return {
          portalName,
          tendersFound: result.totalFound,
          tendersNew: result.newTenders,
          tendersDuplicate:
            (result.skippedExisting ?? 0) + (result.updatedTenders ?? 0) > 0
              ? (result.skippedExisting ?? 0) + (result.updatedTenders ?? 0)
              : Math.max(0, result.totalFound - result.newTenders),
          tendersFailed: result.errors,
          duration: Date.now() - started,
          errors: [],
        };
      } catch (err) {
        // Surface as a thrown error so BullMQ records the attempt and retries.
        throw err instanceof Error ? err : new Error(String(err));
      }
    });

    await scheduler.start();
    logger.info('Scheduler started', {
      schedules: (await scheduler.getSchedules()).filter((s) => s.enabled).length,
    });
  } else {
    logger.warn('Scheduler not started — Redis unavailable (manual runs still work)');
  }

  // --- Periodic recovery of interrupted runs ---
  // Startup recovery handles a restart; this covers a long-lived process whose
  // worker was killed mid-job (e.g. OOM) without the container restarting.
  const staleRunSweep = setInterval(
    () => {
      void storageWriter
        .recoverStaleRuns()
        .then((count) => {
          if (count > 0) {
            logger.warn('Recovered interrupted scraping runs', { count });
          }
        })
        .catch((err) =>
          logger.error('Stale-run sweep failed', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    },
    10 * 60 * 1000,
  );
  if (typeof staleRunSweep.unref === 'function') staleRunSweep.unref();

  // --- Admin API ---
  if (config.api.enabled) {
    const api = createAdminApi({
      port: config.api.port,
      storageWriter,
      scheduler: scheduler ?? undefined,
      onTriggerRun: triggerManualRun,
    });
    await api.start();
  }

  // --- Graceful shutdown ---
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      clearInterval(staleRunSweep);
      // Stop cron jobs + BullMQ worker/queue before tearing down Redis, so
      // in-flight jobs drain and no scheduler resources leak.
      if (scheduler) {
        await scheduler.stop();
        logger.info('Scheduler stopped');
      }
      await closeTenderIndexPublisher();
      await storageWriter.disconnect();
      if (redis) await redis.quit();
      logger.info('Shutdown complete');
    } catch (err) {
      logger.error('Error during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  logger.info('Scraper engine is ready', {
    apiPort: config.api.enabled ? config.api.port : 'disabled',
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function setupEventListeners() {
  const eventLogger = createLogger('Events');

  scraperEvents.on('run:start', (event) => {
    eventLogger.info(`Run started: ${event.portalName}`, {
      runId: event.runId,
      triggeredBy: event.triggeredBy,
    });
  });

  scraperEvents.on('run:complete', (event) => {
    eventLogger.info(`Run complete: ${event.portalName}`, {
      runId: event.runId,
      totalFound: event.totalFound,
      newTenders: event.newTenders,
      updatedTenders: event.updatedTenders,
      errors: event.errors,
      duration: event.duration,
    });
  });

  scraperEvents.on('run:error', (event) => {
    eventLogger.error(`Run failed: ${event.portalName}`, {
      runId: event.runId,
      error: event.error.message,
    });
  });

  scraperEvents.on('tender:new', (event) => {
    eventLogger.debug(`New tender: ${event.title.substring(0, 60)}`, {
      portal: event.portalName,
      tenderId: event.tenderId,
      state: event.state,
      value: event.estimatedValue,
    });
  });

  scraperEvents.on('health:degraded', (event) => {
    eventLogger.warn(`Portal DEGRADED: ${event.portalName}`, {
      consecutiveFailures: event.consecutiveFailures,
      errorRate: event.errorRate,
    });
  });

  scraperEvents.on('health:unhealthy', (event) => {
    eventLogger.error(`Portal UNHEALTHY: ${event.portalName}`, {
      consecutiveFailures: event.consecutiveFailures,
      errorRate: event.errorRate,
      lastError: event.lastError,
    });
  });

  scraperEvents.on('health:recovered', (event) => {
    eventLogger.info(`Portal RECOVERED: ${event.portalName}`, {
      previousStatus: event.previousStatus,
    });
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('Fatal error during boot:', err);
  process.exit(1);
});
