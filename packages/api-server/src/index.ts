import './config/load-env';

import app from './app';
import { env, reportOptionalIntegrationStatus } from './config/env';
import { prisma } from './config/database';
import { ELASTICSEARCH_ENABLED } from './config/elasticsearch';
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

/**
 * Elasticsearch bootstrap: create or update the tender index, reconcile it
 * with PostgreSQL, then start the incremental indexing worker.
 *
 * This used to run BEFORE `app.listen`, and the full reindex happened on every
 * boot of every instance. On a hosting platform that only routes traffic once
 * the port answers, a large table (or a slow cluster) meant the deploy timed
 * out, and a reindex failure propagated to bootstrap()'s catch and exited the
 * process. Search is optional: the API serves tender search from PostgreSQL
 * whenever the index is unavailable, so none of this may delay or stop the
 * HTTP listener. It now runs in the background after the port is open, and
 * every failure here is logged and contained.
 */
async function bootstrapSearchIndex(): Promise<void> {
  if (!ELASTICSEARCH_ENABLED) {
    console.log(
      'Elasticsearch is disabled (ELASTICSEARCH_ENABLED=false): tender search uses PostgreSQL. ' +
        'The index worker drains the tender-index queue without indexing.',
    );
    startTenderIndexWorker();
    return;
  }

  try {
    // Create the Elasticsearch index if it doesn't exist.
    //
    // This used to print "Elasticsearch index ready" unconditionally, even when
    // createTenderIndex() had just failed — producing a boot log that claimed
    // the index was ready directly alongside "Failed to create or update tender
    // index: TimeoutError". The log now says which of the two actually happened.
    const indexSetup = await createTenderIndex();
    if (indexSetup.ok) {
      console.log(
        `Elasticsearch index ready (${indexSetup.detail}` +
          `${indexSetup.attempts > 1 ? `, after ${indexSetup.attempts} attempts` : ''})`,
      );
    } else {
      console.error(
        `Elasticsearch index NOT ready after ${indexSetup.attempts} attempt(s): ${indexSetup.detail}. ` +
          `Tender search is served from PostgreSQL until the index exists; /health reports "degraded".`,
      );
    }

    if (indexSetup.ok) {
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
    }
  } catch (error) {
    console.error(
      'Elasticsearch bootstrap failed; tender search stays on PostgreSQL:',
      error instanceof Error ? error.message : String(error),
    );
  }

  // Start the incremental PostgreSQL -> Elasticsearch worker.
  //
  // Deliberately started AFTER the boot-time full reindex above: that reindex
  // is the reconciliation pass for anything the queue missed while this
  // process was down, so it should settle before incremental jobs drain. It is
  // started even when the reindex failed: queued jobs retry with backoff and
  // the queue stays bounded, instead of accumulating until the next restart.
  try {
    startTenderIndexWorker();
  } catch (error) {
    console.error(
      'Tender index worker failed to start:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function bootstrap() {
  try {
    console.log('Initializing API services...');

    // Say plainly which optional integrations are inert. These never block
    // startup (an absent RAZORPAY_KEY_ID used to crash-loop the whole API),
    // but booting with payments or notifications silently disabled is its own
    // failure mode, so it is reported rather than left to be discovered.
    reportOptionalIntegrationStatus();

    if (env.NODE_ENV === 'production') {
      // Uploaded documents are written to the local filesystem (shared/utils/
      // upload.ts). Hosted platforms give each deploy a fresh, ephemeral disk,
      // so until object storage is wired in, uploads do not survive a deploy.
      console.warn(
        '[config] Document uploads are stored on the local filesystem, which is ephemeral on hosted platforms. ' +
          'Uploaded files will be lost on deploy or restart until object storage is configured.',
      );
    }

    // Verify PostgreSQL connection. The database is essential: there is no
    // request this API can answer without it, so a failure here is fatal and
    // the platform's restart policy applies.
    await prisma.$connect();
    console.log('PostgreSQL connected');

    // Open the port FIRST. Everything after this line is optional or
    // background work and must not delay the listener: the platform only
    // routes traffic (and may time the deploy out) once the port answers.
    const server = app.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });

    // Periodic alert evaluation. `matchTendersToAlerts` previously had no
    // caller at all, so saved alerts were never matched and never notified.
    startAlertScheduler();

    // Search index setup and reconciliation, in the background.
    void bootstrapSearchIndex();

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
