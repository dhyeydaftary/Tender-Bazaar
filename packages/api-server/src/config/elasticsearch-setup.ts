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
    }
  } catch (error) {
    console.error('Failed to create tender index:', error);
  }
}

export async function indexTender(tender: any) {
  try {
    await esClient.index({
      index: TENDER_INDEX,
      id: tender.id,
      body: {
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
      },
    });
  } catch (error) {
    console.error('Failed to index tender:', error);
  }
}

export async function bulkIndexTenders(tenders: any[]) {
  if (tenders.length === 0) return;
  try {
    const body = tenders.flatMap((tender) => [
      { index: { _index: TENDER_INDEX, _id: tender.id } },
      {
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
      },
    ]);
    await esClient.bulk({ body });
    console.log(`✅ Bulk indexed ${tenders.length} tenders`);
  } catch (error) {
    console.error('Failed to bulk index tenders:', error);
  }
}

export async function deleteTenderFromIndex(id: string) {
  try {
    await esClient.delete({ index: TENDER_INDEX, id });
  } catch (error) {
    // Ignore if not found
  }
}

export { TENDER_INDEX };
