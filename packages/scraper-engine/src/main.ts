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

import { config, PORTAL_CONFIGS, getPortalConfig } from './config';
import { createLogger } from './utils/logger';
import { scraperEvents } from './utils/events';
import { StorageWriter } from './storage/writer';
import { createAdminApi } from './api/server';
import { getAllScraperClasses } from './index';
import type { ScrapeResult } from './scrapers/base-scraper';

const logger = createLogger('Main');

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
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

  // --- Event listeners ---
  setupEventListeners();

  // --- Manual trigger handler ---
  async function triggerManualRun(portalKey: string): Promise<void> {
    const portalConfig = getPortalConfig(portalKey);
    if (!portalConfig) throw new Error(`Unknown portal: ${portalKey}`);

    const scraperClasses = getAllScraperClasses();
    const ScraperClass = (scraperClasses as Record<string, any>)[portalKey];
    if (!ScraperClass) throw new Error(`No scraper class for: ${portalKey}`);

    const run = await storageWriter.createRun(portalConfig.name, 'manual', portalConfig.maxPages);
    await storageWriter.startRun(run.id);

    scraperEvents.emit('run:start', {
      portalName: portalConfig.name,
      runId: run.id,
      triggeredBy: 'manual',
      timestamp: new Date(),
    });

    // Run in background
    (async () => {
      try {
        const scraper = new ScraperClass({ prisma, maxConcurrency: portalConfig.maxConcurrency });
        const result: ScrapeResult = await scraper.scrape();

        await storageWriter.completeRun(run.id, {
          totalFound: result.totalFound,
          newTenders: result.newTenders,
          updatedTenders: result.updatedTenders,
          duplicates: 0,
          errors: result.errors,
          pagesScraped: 0,
        });

        scraperEvents.emit('run:complete', {
          portalName: portalConfig.name,
          runId: run.id,
          totalFound: result.totalFound,
          newTenders: result.newTenders,
          updatedTenders: result.updatedTenders,
          duplicates: 0,
          errors: result.errors,
          duration: result.duration,
          pagesScraped: 0,
          timestamp: new Date(),
        });

        await scraper.cleanup();
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
      }
    })();
  }

  // --- Admin API ---
  if (config.api.enabled) {
    const api = createAdminApi({
      port: config.api.port,
      storageWriter,
      onTriggerRun: triggerManualRun,
    });
    await api.start();
  }

  // --- Graceful shutdown ---
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
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
