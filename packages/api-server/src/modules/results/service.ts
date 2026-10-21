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

let isSyncingResults = false;

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

    // Ensure tender results are dynamic and continuously updated up to today
    await this.syncDynamicResults();

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
    const validCategories = (categories || []).filter(
      (cat): cat is 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY' =>
        ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'].includes(cat as any)
    );
    if (validCategories.length > 0) {
      tenderWhere.category = { in: validCategories };
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

  async syncDynamicResults() {
    // Production safeguard: Never simulate or fabricate award results in production.
    // In development/test, require explicit opt-in via ENABLE_SYNTHETIC_RESULTS === 'true'.
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SYNTHETIC_RESULTS !== 'true') {
      return;
    }

    if (isSyncingResults) return;
    isSyncingResults = true;

    try {
      const totalInDb = await prisma.tenderResult.count();
      if (totalInDb === 0) {
        await this.ensureSeedResults();
      }

      const latest = await prisma.tenderResult.findFirst({
        orderBy: { awardedDate: 'desc' },
        select: { awardedDate: true },
      });

      const now = new Date();
      // Check if latest result is older than 6 hours
      const isStale = !latest || !latest.awardedDate || (now.getTime() - latest.awardedDate.getTime() > 6 * 60 * 60 * 1000);
      if (!isStale) return;

      // Find closed tenders or tenders whose deadline has passed without results
      const eligibleTenders = await prisma.tender.findMany({
        where: {
          bidSubmissionDeadline: { lt: now },
          results: { none: {} },
        },
        take: 50,
        orderBy: { bidSubmissionDeadline: 'desc' },
      });

      if (eligibleTenders.length === 0) return;

      const companies = [
        { company: 'Larsen & Toubro Limited', rep: 'Rajesh Sharma' },
        { company: 'Tata Projects Limited', rep: 'Vikram Malhotra' },
        { company: 'Dilip Buildcon Limited', rep: 'Devendra Jain' },
        { company: 'NCC Limited', rep: 'Alluri Ranga Raju' },
        { company: 'Bharat Electronics Limited', rep: 'Sunil Verma' },
        { company: 'Infosys Public Services', rep: 'Anand Kulkarni' },
        { company: 'Afcons Infrastructure Limited', rep: 'K. Subramanian' },
        { company: 'Kalpataru Projects International', rep: 'Manish Mohnot' },
        { company: 'KEC International Limited', rep: 'Vimal Kejriwal' },
        { company: 'Ahluwalia Contracts (India) Ltd', rep: 'Bikramjit Ahluwalia' },
        { company: 'HCL Technologies Limited', rep: 'Pradeep Nair' },
        { company: 'Wipro Technologies India', rep: 'Sanjay Gupta' },
        { company: 'Sterling and Wilson Renewable Energy', rep: 'Amit Jain' },
        { company: 'Patel Engineering Limited', rep: 'Kavita Shirvaikar' },
        { company: 'Siemens India Infrastructure', rep: 'Ramesh Sundaram' },
        { company: 'Medanta Healthcare Solutions', rep: 'Dr. Naresh Trehan' },
        { company: 'Trivitron Healthcare Pvt Ltd', rep: 'G. S. K. Velu' },
        { company: 'Polymedicure Limited', rep: 'Rishi Baid' },
        { company: 'Voltas Limited', rep: 'Pradeep Bakshi' },
        { company: 'Blue Star Limited', rep: 'B. Thiagarajan' },
      ];

      const startDate = latest?.awardedDate
        ? new Date(latest.awardedDate.getTime() + 60 * 60 * 1000)
        : new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      const span = Math.max(1000 * 60 * 60 * 24, now.getTime() - startDate.getTime());

      for (let i = 0; i < eligibleTenders.length; i++) {
        const t = eligibleTenders[i];
        const w = companies[i % companies.length];
        const baseValue =
          t.estimatedValue && t.estimatedValue > 100000
            ? t.estimatedValue
            : 2500000 + ((i * 3700000) % 95000000);
        const discount = 0.91 + ((i * 7) % 8) * 0.01;
        const awardedValue = Math.round(baseValue * discount);

        // Distribute from startDate to now (up to today's date)
        const progress = (i + 1) / eligibleTenders.length;
        const awardedTimestamp = startDate.getTime() + progress * span - (i % 4) * 3600 * 1000;
        const awardedDate = new Date(Math.min(now.getTime(), Math.max(startDate.getTime(), awardedTimestamp)));

        await prisma.tenderResult
          .create({
            data: {
              tenderId: t.id,
              winnerName: w.rep,
              winnerCompany: w.company,
              awardedValue,
              awardedDate,
            },
          })
          .catch(() => {});

        await prisma.tender
          .update({
            where: { id: t.id },
            data: { status: 'AWARDED' },
          })
          .catch(() => {});
      }
    } finally {
      isSyncingResults = false;
    }
  },

  async ensureSeedResults() {
    // Production safeguard: Never seed synthetic results in production.
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SYNTHETIC_RESULTS !== 'true') {
      return;
    }

    const tenders = await prisma.tender.findMany({
      take: 40,
      orderBy: { createdAt: 'desc' },
    });
    if (tenders.length === 0) return;

    const companies = [
      { company: 'Larsen & Toubro Limited', rep: 'Rajesh Sharma' },
      { company: 'Tata Projects Limited', rep: 'Vikram Malhotra' },
      { company: 'Dilip Buildcon Limited', rep: 'Devendra Jain' },
      { company: 'NCC Limited', rep: 'Alluri Ranga Raju' },
      { company: 'Bharat Electronics Limited', rep: 'Sunil Verma' },
      { company: 'Infosys Public Services', rep: 'Anand Kulkarni' },
      { company: 'Afcons Infrastructure Limited', rep: 'K. Subramanian' },
      { company: 'Kalpataru Projects International', rep: 'Manish Mohnot' },
      { company: 'KEC International Limited', rep: 'Vimal Kejriwal' },
      { company: 'Ahluwalia Contracts (India) Ltd', rep: 'Bikramjit Ahluwalia' },
      { company: 'HCL Technologies Limited', rep: 'Pradeep Nair' },
      { company: 'Wipro Technologies India', rep: 'Sanjay Gupta' },
      { company: 'Sterling and Wilson Renewable Energy', rep: 'Amit Jain' },
      { company: 'Patel Engineering Limited', rep: 'Kavita Shirvaikar' },
      { company: 'Siemens India Infrastructure', rep: 'Ramesh Sundaram' },
    ];

    for (let i = 0; i < tenders.length; i++) {
      const t = tenders[i];
      const w = companies[i % companies.length];
      const baseValue =
        t.estimatedValue && t.estimatedValue > 100000
          ? t.estimatedValue
          : 5000000 + ((i * 12500000) % 80000000);
      const discount = 0.91 + ((i * 7) % 8) * 0.01;
      const awardedValue = Math.round(baseValue * discount);
      const daysAgo = 3 + ((i * 4) % 85);
      const awardedDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      await prisma.tenderResult
        .create({
          data: {
            tenderId: t.id,
            winnerName: w.rep,
            winnerCompany: w.company,
            awardedValue,
            awardedDate,
          },
        })
        .catch(() => {});

      await prisma.tender
        .update({
          where: { id: t.id },
          data: { status: 'AWARDED' },
        })
        .catch(() => {});
    }
  },
};
