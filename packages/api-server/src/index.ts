import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import app from './app';
import { env, reportOptionalIntegrationStatus } from './config/env';
import { prisma } from './config/database';
import {
  createTenderIndex,
  bulkIndexTenders,
} from './config/elasticsearch-setup';
import {
  startTenderIndexWorker,
  stopTenderIndexWorker,
} from './queue/tender-index-queue';
import { closeScraperJobPublisher } from './queue/scraper-job-publisher';
import { startAlertScheduler, stopAlertScheduler } from './queue/alert-scheduler';
import { closeNotificationPublisher } from './queue/notification-publisher';

const PORT = env.PORT || 4000;

async function bootstrap() {
  try {
    console.log('Initializing API services...');

    // Say plainly which optional integrations are inert. These never block
    // startup (an absent RAZORPAY_KEY_ID used to crash-loop the whole API),
    // but booting with payments or notifications silently disabled is its own
    // failure mode, so it is reported rather than left to be discovered.
    reportOptionalIntegrationStatus();

    // Verify PostgreSQL connection
    await prisma.$connect();
    console.log('PostgreSQL connected');

    // Create the Elasticsearch index if it doesn't exist.
    //
    // This used to print "Elasticsearch index ready" unconditionally, even when
    // createTenderIndex() had just failed — producing a boot log that claimed
    // the index was ready directly alongside "Failed to create or update tender
    // index: TimeoutError". Startup stays non-fatal (GET /health reports
    // `index "<name>" missing` and returns 503, which the container healthcheck
    // acts on), but the log now says which of the two actually happened.
    const indexSetup = await createTenderIndex();
    if (indexSetup.ok) {
      console.log(
        `Elasticsearch index ready (${indexSetup.detail}` +
          `${indexSetup.attempts > 1 ? `, after ${indexSetup.attempts} attempts` : ''})`,
      );
    } else {
      console.error(
        `Elasticsearch index NOT ready after ${indexSetup.attempts} attempt(s): ${indexSetup.detail}. ` +
          `Tender search is DEGRADED — /health will report 503 until the index exists.`,
      );
    }

    // Sync existing PostgreSQL tenders into Elasticsearch, in pages.
    //
    // This used to be `prisma.tender.findMany()` with no arguments: every
    // tender row, with all its columns and JSON fields, materialised in memory
    // at once on every boot. Under the production memory limit (1 GB) that
    // grows into an OOM-on-startup as the table fills — and it crashes exactly
    // when the table is large, i.e. after the scrapers have been working.
    const REINDEX_PAGE_SIZE = Number(process.env.ES_REINDEX_PAGE_SIZE ?? 500);
    let indexed = 0;
    let cursor: string | undefined;

    for (;;) {
      const page = await prisma.tender.findMany({
        take: REINDEX_PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (page.length === 0) break;

      await bulkIndexTenders(page);
      indexed += page.length;
      cursor = page[page.length - 1].id;

      if (page.length < REINDEX_PAGE_SIZE) break;
    }

    if (indexed > 0) {
      console.log(
        `Synced ${indexed} tenders to Elasticsearch (pages of ${REINDEX_PAGE_SIZE})`,
      );
    } else {
      console.log('No tenders found in PostgreSQL');
    }

    // Start the incremental PostgreSQL -> Elasticsearch worker.
    //
    // Deliberately started AFTER the boot-time full reindex above: that reindex
    // is the reconciliation pass for anything the queue missed while this
    // process was down, so it should settle before incremental jobs drain.
    startTenderIndexWorker();

    // Periodic alert evaluation. `matchTendersToAlerts` previously had no
    // caller at all, so saved alerts were never matched and never notified.
    startAlertScheduler();

    // Start API server
    const server = app.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });

    // --- Graceful shutdown ---
    let shuttingDown = false;
    async function shutdown(signal: string) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down...`);
      try {
        server.close();
        await stopTenderIndexWorker();
        await stopAlertScheduler();
        await closeNotificationPublisher();
        await closeScraperJobPublisher();
        await prisma.$disconnect();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      process.exit(0);
    }

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to initialize API:', error);
    process.exit(1);
  }
}

bootstrap();