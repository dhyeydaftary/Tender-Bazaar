import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

interface SearchResultsFilters {
  query?: string;
  organization?: string;
  state?: string;
  category?: string;
  winnerName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const resultsService = {
  async getTenderResults(tenderId: string) {
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, title: true },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    const results = await prisma.tenderResult.findMany({
      where: { tenderId },
      orderBy: { awardedDate: 'desc' },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            organization: true,
            state: true,
            category: true,
          },
        },
      },
    });

    return { tender, results };
  },

  async searchResults(filters: SearchResultsFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    const tenderWhere: any = {};

    // Filter by winner name
    if (filters.winnerName) {
      where.winnerName = { contains: filters.winnerName, mode: 'insensitive' };
    }

    // Filter by date range
    if (filters.dateFrom || filters.dateTo) {
      where.awardedDate = {};
      if (filters.dateFrom) where.awardedDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.awardedDate.lte = new Date(filters.dateTo);
    }

    // Tender-level filters
    if (filters.organization) {
      tenderWhere.organization = { contains: filters.organization, mode: 'insensitive' };
    }
    if (filters.state) {
      tenderWhere.state = { equals: filters.state, mode: 'insensitive' };
    }
    if (filters.category) {
      tenderWhere.category = filters.category;
    }

    // General query search across winner and tender fields
    if (filters.query) {
      where.OR = [
        { winnerName: { contains: filters.query, mode: 'insensitive' } },
        { winnerCompany: { contains: filters.query, mode: 'insensitive' } },
        { tender: { title: { contains: filters.query, mode: 'insensitive' } } },
        { tender: { organization: { contains: filters.query, mode: 'insensitive' } } },
        { tender: { state: { contains: filters.query, mode: 'insensitive' } } },
      ];
    }

    // Combine tender filters
    if (Object.keys(tenderWhere).length > 0) {
      where.tender = tenderWhere;
    }

    const [results, total] = await Promise.all([
      prisma.tenderResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { awardedDate: 'desc' },
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              organization: true,
              state: true,
              category: true,
              referenceNumber: true,
            },
          },
        },
      }),
      prisma.tenderResult.count({ where }),
    ]);

    return {
      results,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getCompetitorAnalysis(userId: string) {
    // Get user's company profile to determine categories and states
    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
      select: {
        workCategories: true,
        statesOperated: true,
        companyName: true,
      },
    });

    if (!profile) {
      throw new AppError('Company profile required for competitor analysis', 400, 'COMPANY_PROFILE_REQUIRED');
    }

    const categories = profile.workCategories;
    const states = profile.statesOperated;

    // Build filter for tenders in matching categories/states
    const tenderWhere: any = {};
    if (categories.length > 0) {
      tenderWhere.category = { in: categories };
    }
    if (states.length > 0) {
      tenderWhere.state = { in: states };
    }

    // Find results for tenders in matching categories/states
    const results = await prisma.tenderResult.findMany({
      where: {
        tender: Object.keys(tenderWhere).length > 0 ? tenderWhere : undefined,
        awardedValue: { not: null },
      },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            organization: true,
            state: true,
            category: true,
          },
        },
      },
      orderBy: { awardedDate: 'desc' },
      take: 200,
    });

    // Group by winner company
    const competitorMap = new Map<string, {
      companyName: string;
      wins: number;
      totalValue: number;
      categories: Set<string>;
      states: Set<string>;
      recentWins: Array<{
        tenderTitle: string;
        awardedValue: number | null;
        awardedDate: Date | null;
      }>;
    }>();

    for (const result of results) {
      const company = result.winnerCompany || result.winnerName;
      if (!competitorMap.has(company)) {
        competitorMap.set(company, {
          companyName: company,
          wins: 0,
          totalValue: 0,
          categories: new Set(),
          states: new Set(),
          recentWins: [],
        });
      }

      const competitor = competitorMap.get(company)!;
      competitor.wins += 1;
      competitor.totalValue += result.awardedValue || 0;
      competitor.categories.add(result.tender.category);
      competitor.states.add(result.tender.state);

      if (competitor.recentWins.length < 3) {
        competitor.recentWins.push({
          tenderTitle: result.tender.title,
          awardedValue: result.awardedValue,
          awardedDate: result.awardedDate,
        });
      }
    }

    // Convert to array, sort by wins descending
    const competitors = Array.from(competitorMap.values())
      .map((c) => ({
        ...c,
        categories: Array.from(c.categories),
        states: Array.from(c.states),
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 20);

    return {
      userCompany: profile.companyName,
      matchedCategories: categories,
      matchedStates: states,
      competitors,
    };
  },

  async getWinnerProfile(companyName: string) {
    const decodedName = decodeURIComponent(companyName);

    const results = await prisma.tenderResult.findMany({
      where: {
        OR: [
          { winnerName: { equals: decodedName, mode: 'insensitive' } },
          { winnerCompany: { equals: decodedName, mode: 'insensitive' } },
        ],
      },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            organization: true,
            state: true,
            category: true,
            estimatedValue: true,
          },
        },
      },
      orderBy: { awardedDate: 'desc' },
    });

    if (results.length === 0) {
      throw new AppError('No results found for this company', 404, 'WINNER_NOT_FOUND');
    }

    const totalWins = results.length;
    const totalValue = results.reduce((sum, r) => sum + (r.awardedValue || 0), 0);

    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const organizationsSet = new Set<string>();

    for (const result of results) {
      categoriesSet.add(result.tender.category);
      statesSet.add(result.tender.state);
      organizationsSet.add(result.tender.organization);
    }

    return {
      companyName: decodedName,
      totalWins,
      totalValue,
      categories: Array.from(categoriesSet),
      states: Array.from(statesSet),
      organizations: Array.from(organizationsSet),
      recentWins: results.slice(0, 10).map((r) => ({
        id: r.id,
        tenderId: r.tender.id,
        tenderTitle: r.tender.title,
        organization: r.tender.organization,
        state: r.tender.state,
        category: r.tender.category,
        awardedValue: r.awardedValue,
        awardedDate: r.awardedDate,
      })),
    };
  },
};
