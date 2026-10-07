import esClient from './elasticsearch';

const TENDER_INDEX = 'tenders';

const tenderMapping = {
  properties: {
    title: {
      type: 'text' as const,
      analyzer: 'standard',
      fields: { keyword: { type: 'keyword' as const } },
    },
    description: { type: 'text' as const, analyzer: 'standard' },
    organization: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const } },
    },
    department: { type: 'text' as const, fields: { keyword: { type: 'keyword' as const } } },
    state: { type: 'keyword' as const },
    district: { type: 'keyword' as const },
    city: { type: 'keyword' as const },
    category: { type: 'keyword' as const },
    tenderType: { type: 'keyword' as const },
    status: { type: 'keyword' as const },
    sourcePortal: { type: 'keyword' as const },
    referenceNumber: { type: 'keyword' as const },
    // Portal's own identifier for the tender. NOT the Elasticsearch _id — the
    // Prisma Tender.id remains the _id (see toTenderDocument / indexTender).
    // keyword: exact-match/filter only, never analysed.
    sourceId: { type: 'keyword' as const },
    // Deep link back to the tender on its source portal. Indexed so search
    // results carry it: the web app's Tender interface declares sourceUrl as
    // non-optional, but it was previously absent from the ES document.
    sourceUrl: { type: 'keyword' as const },
    estimatedValue: { type: 'float' as const },
    emdAmount: { type: 'float' as const },
    publishedDate: { type: 'date' as const },
    bidSubmissionDeadline: { type: 'date' as const },
    bidOpeningDate: { type: 'date' as const },
    aiKeywords: { type: 'keyword' as const },
    aiSummary: { type: 'text' as const },
    reservedForMSME: { type: 'boolean' as const },
    reservedForStartups: { type: 'boolean' as const },
    viewCount: { type: 'integer' as const },
    createdAt: { type: 'date' as const },
  },
};

/**
 * Build the Elasticsearch document for a Prisma Tender row.
 *
 * This is the SINGLE source of truth for the PostgreSQL -> Elasticsearch
 * projection. Both indexTender() (incremental, queue-driven) and
 * bulkIndexTenders() (boot-time full reindex) go through it, so the two paths
 * cannot drift apart.
 *
 * The document deliberately omits Tender.id: it is passed separately as the
 * Elasticsearch _id, which is what makes re-indexing idempotent.
 *
 * Every key here must also exist in tenderMapping above.
 */
export function toTenderDocument(tender: any) {
  return {
    title: tender.title,
    description: tender.description,
    organization: tender.organization,
    department: tender.department,
    state: tender.state,
    district: tender.district,
    city: tender.city,
    category: tender.category,
    tenderType: tender.tenderType,
    status: tender.status,
    sourcePortal: tender.sourcePortal,
    referenceNumber: tender.referenceNumber,
    sourceId: tender.sourceId,
    sourceUrl: tender.sourceUrl,
    estimatedValue: tender.estimatedValue,
    emdAmount: tender.emdAmount,
    publishedDate: tender.publishedDate,
    bidSubmissionDeadline: tender.bidSubmissionDeadline,
    bidOpeningDate: tender.bidOpeningDate,
    aiKeywords: tender.aiKeywords,
    aiSummary: tender.aiSummary,
    reservedForMSME: tender.reservedForMSME,
    reservedForStartups: tender.reservedForStartups,
    viewCount: tender.viewCount,
    createdAt: tender.createdAt,
  };
}

export async function createTenderIndex() {
  try {
    const exists = await esClient.indices.exists({ index: TENDER_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: TENDER_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: tenderMapping,
        },
      });
      console.log('✅ Tender index created');
      return;
    }

    // The index already exists (the common case). Creating it is skipped, so any
    // field added to tenderMapping since the index was first built would never be
    // declared — Elasticsearch would dynamic-map it instead (a string becomes
    // text + .keyword rather than the intended keyword).
    //
    // Adding fields to an existing mapping is an additive, non-destructive
    // operation: it cannot change or remove existing fields and needs no reindex.
    // Anything beyond adding fields (changing a field's type) still requires a
    // real reindex and is deliberately NOT attempted here.
    await esClient.indices.putMapping({
      index: TENDER_INDEX,
      body: tenderMapping,
    });
    console.log('✅ Tender index mapping up to date');
  } catch (error) {
    console.error('Failed to create or update tender index:', error);
  }
}

/**
 * Index (or re-index) a single tender.
 *
 * Errors are intentionally PROPAGATED rather than logged and swallowed: this is
 * called by the tender-index BullMQ worker, which can only retry a job if the
 * failure actually surfaces. Callers that want best-effort behaviour must catch.
 */
export async function indexTender(tender: any): Promise<void> {
  await esClient.index({
    index: TENDER_INDEX,
    // Prisma Tender.id as _id => repeated indexing updates in place, never
    // creating a duplicate document.
    id: tender.id,
    body: toTenderDocument(tender),
  });
}

/**
 * Bulk index many tenders.
 *
 * Used by the boot-time full reindex, which is also the recovery mechanism when
 * an incremental sync event is lost. Its existing fault tolerance is kept on
 * purpose: a failure here must not prevent the API server from starting.
 */
export async function bulkIndexTenders(tenders: any[]) {
  if (tenders.length === 0) return;
  try {
    const body = tenders.flatMap((tender) => [
      { index: { _index: TENDER_INDEX, _id: tender.id } },
      toTenderDocument(tender),
    ]);
    const result = await esClient.bulk({ body });
    if ((result as any).errors) {
      const failed = ((result as any).items ?? []).filter((i: any) => i.index?.error);
      console.error(`Bulk index completed with ${failed.length} failed item(s)`, failed.slice(0, 3));
    }
    console.log(`✅ Bulk indexed ${tenders.length} tenders`);
  } catch (error) {
    console.error('Failed to bulk index tenders:', error);
  }
}

/**
 * Remove a tender from the index.
 *
 * A missing document is treated as success (the desired end state is "absent").
 * Any other failure propagates so the tender-index worker can retry.
 */
export async function deleteTenderFromIndex(id: string): Promise<void> {
  try {
    await esClient.delete({ index: TENDER_INDEX, id });
  } catch (error: any) {
    const status = error?.meta?.statusCode;
    if (status === 404) return; // already absent
    throw error;
  }
}

export { TENDER_INDEX };
