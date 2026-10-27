import { prisma } from '../../config/database';
import esClient, { isElasticsearchAlive, markElasticsearchDown, checkElasticsearch } from '../../config/elasticsearch';
import redis from '../../config/redis';
import { TENDER_INDEX, indexTender } from '../../config/elasticsearch-setup';
import { AppError } from '../../shared/middleware/error-handler';
import { enrichTenderDetails } from './tender-enricher';
import {
  OPEN_TENDER_STATUSES,
  expiredOpenTendersWhere,
  pickUnambiguous,
  summarizeStatusCounts,
} from './status-groups';

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

    // Fast-path: if Elasticsearch is down, immediately query PostgreSQL without stalling
    if (!isElasticsearchAlive()) {
      checkElasticsearch().catch(() => {});
      return this.searchTendersFallback(filters, page, limit);
    }

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
          // Highlighting is the dominant cost of a text search, because the
          // highlighter re-matches the query against each hit's text. Combined
          // with `fuzziness: 'AUTO'` above it has to do that for every fuzzy
          // term expansion, measured on this index at ~1950ms of ES time
          // versus ~100ms for the same query with highlighting off and ~23ms
          // with a non-fuzzy highlighter.
          //
          // `highlight_query` lets the hits stay fuzzy — recall, ordering and
          // totals are unchanged — while the highlighter runs the cheap exact
          // form. The only visible difference is that a word matched purely by
          // fuzzy correction is no longer wrapped in <mark>.
          ...(textQuery
            ? {
                highlight: {
                  fields: {
                    title: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
                    description: { pre_tags: ['<mark>'], post_tags: ['</mark>'], fragment_size: 200 },
                  },
                  highlight_query: {
                    multi_match: {
                      query: textQuery,
                      fields: ['title^3', 'description', 'organization^2', 'aiKeywords^2', 'aiSummary'],
                      type: 'best_fields',
                    },
                  },
                },
              }
            : {}),
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
      markElasticsearchDown();
      return this.searchTendersFallback(filters, page, limit);
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

    // These five were accepted by the API and honoured by the Elasticsearch
    // path but dropped here, so whenever a search fell back to PostgreSQL the
    // tender-type, organisation, source-portal and date filters were silently
    // ignored and the response claimed to be filtered when it was not.
    if (filters.tenderTypes?.length) where.tenderType = { in: filters.tenderTypes };
    if (filters.organizations?.length) where.organization = { in: filters.organizations };
    if (filters.sourcePortals?.length) where.sourcePortal = { in: filters.sourcePortals };

    if (filters.publishedFrom || filters.publishedTo) {
      where.publishedDate = {
        ...(filters.publishedFrom ? { gte: new Date(filters.publishedFrom) } : {}),
        ...(filters.publishedTo ? { lte: new Date(filters.publishedTo) } : {}),
      };
    }
    if (filters.deadlineFrom || filters.deadlineTo) {
      where.bidSubmissionDeadline = {
        ...(filters.deadlineFrom ? { gte: new Date(filters.deadlineFrom) } : {}),
        ...(filters.deadlineTo ? { lte: new Date(filters.deadlineTo) } : {}),
      };
    }

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
    let tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        documents: true,
        results: true,
      },
    });

    if (!tender) {
      tender = await prisma.tender.findFirst({
        where: { OR: [{ sourceId: id }, { referenceNumber: id }] },
        include: {
          documents: true,
          results: true,
        },
      });
    }

    if (!tender) {
      // Partial ids are accepted only when they identify exactly one tender.
      const partial = await prisma.tender.findMany({
        where: {
          OR: [{ sourceId: { contains: id } }, { referenceNumber: { contains: id } }],
        },
        include: {
          documents: true,
          results: true,
        },
        take: 2,
      });
      tender = pickUnambiguous(partial);
    }

    if (!tender) {
      // Previously an unknown id returned the first ACTIVE tender, so a stale
      // or mistyped link silently showed an unrelated tender.
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Increment view count in background
    prisma.tender.update({ where: { id: tender.id }, data: { viewCount: { increment: 1 } } }).catch(() => { });

    // Track trending in Redis (sorted set by views in last 7 days)
    redis.zincrby('trending:tenders:7d', 1, tender.id).catch(() => { });

    // Dynamically enrich all requirements, dates, organization type, district, and documents for UI display
    // Keep in-memory only to preserve original scraped database record integrity
    const enriched = enrichTenderDetails(tender as any);

    return enriched;
  },

  async getSimilarTenders(tenderId: string) {
    if (!isElasticsearchAlive()) {
      return this.getSimilarTendersFallback(tenderId);
    }

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
      markElasticsearchDown();
      return this.getSimilarTendersFallback(tenderId);
    }
  },

  async getSimilarTendersFallback(tenderId: string) {
    const current = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: { category: true, state: true },
    });
    if (!current) return [];

    return prisma.tender.findMany({
      where: {
        id: { not: tenderId },
        status: 'ACTIVE',
        OR: [{ category: current.category }, { state: current.state }],
      },
      take: 6,
    });
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

  async getTenderStats(stateFilter?: string) {
    // Dynamically update tender statuses based on deadline expiration
    try {
      const now = new Date();
      const expired = await prisma.tender.updateMany({
        where: expiredOpenTendersWhere(now),
        data: {
          status: 'CLOSED',
        },
      });

      if (expired.count > 0 && isElasticsearchAlive()) {
        esClient
          .updateByQuery({
            index: TENDER_INDEX,
            conflicts: 'proceed',
            body: {
              script: {
                source: "ctx._source.status = 'CLOSED'",
                lang: 'painless',
              },
              query: {
                bool: {
                  must: [
                    { terms: { status: [...OPEN_TENDER_STATUSES] } },
                    { range: { bidSubmissionDeadline: { lt: now.toISOString() } } },
                  ],
                },
              },
            },
          })
          .catch(() => {});
      }
    } catch {}

    // "Active" = open for bidding (ACTIVE + CORRIGENDUM); see status-groups.ts.
    const activeWhere: any = { status: { in: [...OPEN_TENDER_STATUSES] } };
    const baseWhere: any = {};
    const todayWhere: any = {
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { in: [...OPEN_TENDER_STATUSES] },
    };

    if (stateFilter) {
      activeWhere.state = { equals: stateFilter, mode: 'insensitive' };
      baseWhere.state = { equals: stateFilter, mode: 'insensitive' };
      todayWhere.state = { equals: stateFilter, mode: 'insensitive' };
    }

    const [byStatus, newToday, byCategory, byState] = await Promise.all([
      prisma.tender.groupBy({
        by: ['status'],
        _count: true,
        where: Object.keys(baseWhere).length > 0 ? baseWhere : undefined,
      }),
      prisma.tender.count({ where: todayWhere }),
      prisma.tender.groupBy({
        by: ['category'],
        _count: true,
        where: activeWhere,
      }),
      prisma.tender.groupBy({
        by: ['state'],
        _count: true,
        where: { status: { in: [...OPEN_TENDER_STATUSES] } },
        orderBy: { _count: { state: 'desc' } },
      }),
    ]);

    const counts = summarizeStatusCounts(byStatus);
    const stateCountMap: Record<string, number> = {};
    for (const s of byState) {
      if (s.state) stateCountMap[s.state] = s._count;
    }

    return {
      total: counts.total,
      active: counts.active,
      closed: counts.closed,
      newToday,
      byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
      byState: stateCountMap,
      topStates: byState.slice(0, 10).map((s) => ({ state: s.state, count: s._count })),
      allStates: byState.map((s) => ({ state: s.state, count: s._count })),
    };
  },

  async getAutocompleteSuggestions(query: string) {
    if (!query || query.length < 2) return [];

    if (!isElasticsearchAlive()) {
      return prisma.tender.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' },
        },
        select: { title: true, organization: true, category: true },
        take: 5,
      });
    }

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
      markElasticsearchDown();
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
