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

/**
 * The outcome of one `createTenderIndex()` call.
 *
 * It used to return nothing and swallow every error into a `console.error`, so
 * the caller could not tell success from failure — and `bootstrap()` went on to
 * print "Elasticsearch index ready" unconditionally. A timed-out index creation
 * therefore produced a log that said the index was ready and, immediately
 * after, that creating it had failed. Returning a status is what lets the
 * caller tell the truth.
 */
export interface IndexSetupResult {
  ok: boolean;
  /** 'created' | 'mapping-updated' when ok; otherwise a short failure reason. */
  detail: string;
  /** How many attempts were made (>1 means a transient failure was retried). */
  attempts: number;
}

/** Attempts for a transient failure. A cold/loaded cluster times out easily. */
const INDEX_SETUP_ATTEMPTS = 3;
/** Base backoff; doubles per attempt. Kept short so boot is not delayed much. */
const INDEX_SETUP_BACKOFF_MS = 2000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Create the tender index, or bring its mapping up to date.
 *
 * Deliberately NOT fatal: the API still starts without a usable index, because
 * `/health` already reports `index "<name>" missing` and returns 503, which the
 * container healthcheck acts on. What changed is that failure is now **reported
 * to the caller and retried**, instead of being logged once and forgotten —
 * previously a single transient timeout left the index missing until somebody
 * restarted the container, because nothing ever re-attempted creation.
 */
export async function createTenderIndex(
  attempts = INDEX_SETUP_ATTEMPTS,
): Promise<IndexSetupResult> {
  return createTenderIndexWith(esClient.indices as TenderIndicesClient, attempts);
}

/**
 * The slice of the Elasticsearch client this module actually uses.
 *
 * Declared so the retry behaviour can be driven directly in tests with a stub,
 * instead of intercepting module resolution to replace the client — the setup
 * module builds a real client at import time, and swapping that out through the
 * require cache proved both fragile and easy to get silently wrong.
 */
export interface TenderIndicesClient {
  exists(args: { index: string }): Promise<boolean>;
  create(args: unknown): Promise<unknown>;
  putMapping(args: unknown): Promise<unknown>;
}

/** `createTenderIndex` against an explicit client. See TenderIndicesClient. */
export async function createTenderIndexWith(
  indices: TenderIndicesClient,
  attempts = INDEX_SETUP_ATTEMPTS,
): Promise<IndexSetupResult> {
  let lastError = '';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await attemptTenderIndexSetup(indices);
    if (result.ok) return { ...result, attempts: attempt };

    lastError = result.detail;
    if (attempt < attempts) {
      const wait = INDEX_SETUP_BACKOFF_MS * 2 ** (attempt - 1);
      console.error(
        `Tender index setup attempt ${attempt}/${attempts} failed (${result.detail}) — retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }

  console.error(
    `Failed to create or update tender index after ${attempts} attempt(s): ${lastError}. ` +
      `Tender search will be DEGRADED until the index exists — /health reports this and returns 503.`,
  );
  return { ok: false, detail: lastError, attempts };
}

async function attemptTenderIndexSetup(
  indices: TenderIndicesClient,
): Promise<Omit<IndexSetupResult, 'attempts'>> {
  try {
    const exists = await indices.exists({ index: TENDER_INDEX });
    if (!exists) {
      await indices.create({
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
      return { ok: true, detail: 'created' };
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
    await indices.putMapping({
      index: TENDER_INDEX,
      body: tenderMapping,
    });
    console.log('✅ Tender index mapping up to date');
    return { ok: true, detail: 'mapping-updated' };
  } catch (error) {
    // Only the reason is kept, never the whole error object: Elasticsearch
    // client errors carry the request (including headers) in `meta`.
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
    return { ok: false, detail };
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
