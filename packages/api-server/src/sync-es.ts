import { prisma } from './config/database';
import esClient from './config/elasticsearch';
import { TENDER_INDEX, toTenderDocument } from './config/elasticsearch-setup';

async function sync() {
  console.log('Reindexing Elasticsearch from PostgreSQL to ensure 100% exact match...');

  const tenders = await prisma.tender.findMany({
    take: 2000,
  });

  console.log(`Found ${tenders.length} tenders in PostgreSQL.`);

  // Bulk index all tenders
  const body = tenders.flatMap((tender) => [
    { index: { _index: TENDER_INDEX, _id: tender.id } },
    toTenderDocument(tender),
  ]);

  const bulkRes = await esClient.bulk({ body, refresh: true });
  console.log('Bulk indexed successfully. Errors:', bulkRes.errors);

  const pgActive = await prisma.tender.count({ where: { status: 'ACTIVE' } });
  const pgClosed = await prisma.tender.count({ where: { status: { in: ['CLOSED', 'AWARDED', 'CANCELLED'] } } });
  const pgTotal = await prisma.tender.count();

  const esActive = await esClient.count({
    index: TENDER_INDEX,
    body: { query: { term: { status: 'ACTIVE' } } },
  });
  const esTotal = await esClient.count({
    index: TENDER_INDEX,
  });

  console.log(`PostgreSQL: Total=${pgTotal}, Active=${pgActive}, Closed=${pgClosed}`);
  console.log(`Elasticsearch: Total=${esTotal.count}, Active=${esActive.count}`);
}

sync().catch(console.error).finally(() => process.exit(0));
