import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import app from './app';
import { env } from './config/env';
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

const PORT = env.PORT || 4000;

async function bootstrap() {
  try {
    console.log('Initializing API services...');

    // Verify PostgreSQL connection
    await prisma.$connect();
    console.log('PostgreSQL connected');

    // Create Elasticsearch index if it doesn't exist
    await createTenderIndex();
    console.log('Elasticsearch index ready');

    // Sync existing PostgreSQL tenders into Elasticsearch
    const tenders = await prisma.tender.findMany();

    if (tenders.length > 0) {
      await bulkIndexTenders(tenders);
      console.log(`Synced ${tenders.length} tenders to Elasticsearch`);
    } else {
      console.log('No tenders found in PostgreSQL');
    }

    // Start the incremental PostgreSQL -> Elasticsearch worker.
    //
    // Deliberately started AFTER the boot-time full reindex above: that reindex
    // is the reconciliation pass for anything the queue missed while this
    // process was down, so it should settle before incremental jobs drain.
    startTenderIndexWorker();

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