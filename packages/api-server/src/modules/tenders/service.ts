import { prisma } from '../../config/database';
import esClient from '../../config/elasticsearch';
import redis from '../../config/redis';
import { TENDER_INDEX, indexTender } from '../../config/elasticsearch-setup';
import { AppError } from '../../shared/middleware/error-handler';

interface SearchFilters {
  query?: string;
  categories?: string[];
  states?: string[];
  tenderTypes?: string[];
  status?: string[];
  organizations?: string[];
  sourcePortals?: string[];
  minValue?: number;
  maxValue?: number;
  publishedFrom?: string;
  publishedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  reservedForMSME?: boolean;
  reservedForStartups?: boolean;
  emdExemptMSME?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export const tenderService = {
  async searchTenders(filters: SearchFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const from = (page - 1) * limit;

    const must: any[] = [];
    const filter: any[] = [];

    // Full-text search
    const STATES = [
      'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
      'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
      'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
      'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
      'Delhi','Jammu and Kashmir','Ladakh','Chandigarh','Puducherry',
    ];

    let textQuery = filters.query?.trim();
    const matchedState = textQuery
      ? STATES.find((s) => s.toLowerCase() === textQuery!.toLowerCase())
      : undefined;

    if (matchedState) {
      filters.states = [...new Set([...(filters.states || []), matchedState])];
      textQuery = undefined;
    }

    if (textQuery) {
      must.push({
        multi_match: {
          query: textQuery,
          fields: [
            'title^3',
            'description',
            'organization^2',
            'department',
            'state',
            'district',
            'city',
            'category',
            'tenderType',
            'status',
            'sourcePortal',
            'referenceNumber',
            'aiKeywords^2',
            'aiSummary',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Keyword filters
    if (filters.categories?.length) filter.push({ terms: { category: filters.categories } });
    if (filters.states?.length) filter.push({ terms: { state: filters.states } });
    if (filters.tenderTypes?.length) filter.push({ terms: { tenderType: filters.tenderTypes } });
    if (filters.status?.length) filter.push({ terms: { status: filters.status } });
    if (filters.organizations?.length) filter.push({ terms: { 'organization.keyword': filters.organizations } });
    if (filters.sourcePortals?.length) filter.push({ terms: { sourcePortal: filters.sourcePortals } });
    if (filters.reservedForMSME) filter.push({ term: { reservedForMSME: true } });
    if (filters.reservedForStartups) filter.push({ term: { reservedForStartups: true } });
    if (filters.emdExemptMSME) filter.push({ term: { emdExemptMSME: true } });

    // Range filters
    if (filters.minValue || filters.maxValue) {
      const range: any = {};
      if (filters.minValue) range.gte = filters.minValue;
      if (filters.maxValue) range.lte = filters.maxValue;
      filter.push({ range: { estimatedValue: range } });
    }

    if (filters.publishedFrom || filters.publishedTo) {
      const range: any = {};
      if (filters.publishedFrom) range.gte = filters.publishedFrom;
      if (filters.publishedTo) range.lte = filters.publishedTo;
      filter.push({ range: { publishedDate: range } });
    }

    if (filters.deadlineFrom || filters.deadlineTo) {
      const range: any = {};
      if (filters.deadlineFrom) range.gte = filters.deadlineFrom;
      if (filters.deadlineTo) range.lte = filters.deadlineTo;
      filter.push({ range: { bidSubmissionDeadline: range } });
    }

    // Sort
    let sort: any[] = [];
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    switch (filters.sortBy) {
      case 'estimatedValue':
        sort = [{ estimatedValue: { order: sortOrder, missing: '_last' } }];
        break;
      case 'bidSubmissionDeadline':
        sort = [{ bidSubmissionDeadline: { order: 'asc' } }];
        break;
      case 'relevance':
        sort = filters.query ? [{ _score: { order: 'desc' } }] : [{ publishedDate: { order: 'desc' } }];
        break;
      default:
        sort = [{ publishedDate: { order: 'desc' } }];
    }

    try {
      const result = await esClient.search({
        index: TENDER_INDEX,
        body: {
          from,
          size: limit,
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              filter,
            },
          },
          sort,
          highlight: {
            fields: {
              title: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
              description: { pre_tags: ['<mark>'], post_tags: ['</mark>'], fragment_size: 200 },
            },
          },
          aggs: {
            categories: { terms: { field: 'category', size: 10 } },
            states: { terms: { field: 'state', size: 36 } },
            valueRanges: {
              range: {
                field: 'estimatedValue',
                ranges: [
                  { key: 'Under 10L', to: 1000000 },
                  { key: '10L - 1Cr', from: 1000000, to: 10000000 },
                  { key: '1Cr - 10Cr', from: 10000000, to: 100000000 },
                  { key: '10Cr - 100Cr', from: 100000000, to: 1000000000 },
                  { key: 'Above 100Cr', from: 1000000000 },
                ],
              },
            },
            organizations: { terms: { field: 'organization.keyword', size: 20 } },
          },
        },
      });

      const hits = result.hits.hits;
      const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
      const aggs = result.aggregations as any;

      const tenders = hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
        _score: hit._score,
        highlight: hit.highlight,
      }));

      const aggregations = {
        categories: Object.fromEntries(
          (aggs?.categories?.buckets || []).map((b: any) => [b.key, b.doc_count])
        ),
        states: Object.fromEntries(
          (aggs?.states?.buckets || []).map((b: any) => [b.key, b.doc_count])
        ),
        valueRanges: Object.fromEntries(
          (aggs?.valueRanges?.buckets || []).map((b: any) => [b.key, b.doc_count])
        ),
        organizations: Object.fromEntries(
          (aggs?.organizations?.buckets || []).map((b: any) => [b.key, b.doc_count])
        ),
      };

      return { tenders, total, page, limit, aggregations };
    } catch (error: any) {
      // If Elasticsearch never produced a response — refused, unreachable, or
      // timed out — fall back to PostgreSQL. Timeouts surface as statusCode 0
      // rather than undefined, so check for any falsy status instead.
      const esStatus = error.meta?.statusCode;
      if (!esStatus || error.name === 'TimeoutError' || error.name === 'ConnectionError') {
        return this.searchTendersFallback(filters, page, limit);
      }
      throw error;
    }
  },

  async searchTendersFallback(filters: SearchFilters, page: number, limit: number) {
    const where: any = {};

    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { organization: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.categories?.length) where.category = { in: filters.categories };
    if (filters.states?.length) where.state = { in: filters.states };
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.minValue) where.estimatedValue = { ...where.estimatedValue, gte: filters.minValue };
    if (filters.maxValue) where.estimatedValue = { ...where.estimatedValue, lte: filters.maxValue };
    if (filters.reservedForMSME) where.reservedForMSME = true;
    if (filters.reservedForStartups) where.reservedForStartups = true;
    if (filters.emdExemptMSME) where.emdExemptMSME = true;

    const orderBy: any = {};
    if (filters.sortBy === 'estimatedValue') orderBy.estimatedValue = filters.sortOrder || 'desc';
    else if (filters.sortBy === 'bidSubmissionDeadline') orderBy.bidSubmissionDeadline = 'asc';
    else orderBy.publishedDate = 'desc';

    const [tenders, total] = await Promise.all([
      prisma.tender.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tender.count({ where }),
    ]);

    return { tenders, total, page, limit, aggregations: { categories: {}, states: {}, valueRanges: {}, organizations: {} } };
  },

  async getTenderById(id: string) {
    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        documents: true,
        results: true,
      },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Increment view count in background
    prisma.tender.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => { });

    // Track trending in Redis (sorted set by views in last 7 days)
    redis.zincrby('trending:tenders:7d', 1, id).catch(() => { });

    return tender;
  },

  async getSimilarTenders(tenderId: string) {
    try {
      const result = await esClient.search({
        index: TENDER_INDEX,
        body: {
          size: 6,
          query: {
            more_like_this: {
              fields: ['title', 'description', 'organization', 'aiKeywords'],
              like: [{ _index: TENDER_INDEX, _id: tenderId }],
              min_term_freq: 1,
              min_doc_freq: 1,
              max_query_terms: 12,
            },
          },
        },
      });

      return result.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
        _score: hit._score,
      }));
    } catch {
      return [];
    }
  },

  async getTrendingTenders() {
    try {
      const tenderIds = await redis.zrevrange('trending:tenders:7d', 0, 9);
      if (tenderIds.length === 0) {
        return prisma.tender.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { viewCount: 'desc' },
          take: 10,
        });
      }

      const tenders = await prisma.tender.findMany({
        where: { id: { in: tenderIds } },
      });

      // Maintain Redis order
      return tenderIds
        .map((id) => tenders.find((t) => t.id === id))
        .filter(Boolean);
    } catch {
      return prisma.tender.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { viewCount: 'desc' },
        take: 10,
      });
    }
  },

  async getTenderStats() {
    const [total, activeCount, newToday, byCategory, byState] = await Promise.all([
      prisma.tender.count(),
      prisma.tender.count({ where: { status: 'ACTIVE' } }),
      prisma.tender.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.tender.groupBy({
        by: ['category'],
        _count: true,
        where: { status: 'ACTIVE' },
      }),
      prisma.tender.groupBy({
        by: ['state'],
        _count: true,
        where: { status: 'ACTIVE' },
        orderBy: { _count: { state: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      active: activeCount,
      newToday,
      byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
      topStates: byState.map((s) => ({ state: s.state, count: s._count })),
    };
  },

  async getAutocompleteSuggestions(query: string) {
    if (!query || query.length < 2) return [];

    try {
      const result = await esClient.search({
        index: TENDER_INDEX,
        body: {
          size: 0,
          suggest: {
            title_suggest: {
              prefix: query,
              completion: {
                field: 'title.keyword',
                size: 5,
                skip_duplicates: true,
              },
            },
          },
        },
      });

      // Fallback: use regular search for suggestions
      const searchResult = await esClient.search({
        index: TENDER_INDEX,
        body: {
          size: 5,
          _source: ['title', 'organization', 'category'],
          query: {
            multi_match: {
              query,
              fields: ['title^3', 'organization'],
              type: 'phrase_prefix',
            },
          },
        },
      });

      return searchResult.hits.hits.map((hit: any) => ({
        title: hit._source.title,
        organization: hit._source.organization,
        category: hit._source.category,
      }));
    } catch {
      // Fallback to Prisma
      const tenders = await prisma.tender.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' },
        },
        select: { title: true, organization: true, category: true },
        take: 5,
      });
      return tenders;
    }
  },
};
