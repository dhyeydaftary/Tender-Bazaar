import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import {
  createTenderIndex,
  bulkIndexTenders,
} from './config/elasticsearch-setup';

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

    // Start API server
    app.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to initialize API:', error);
    process.exit(1);
  }
}

bootstrap();