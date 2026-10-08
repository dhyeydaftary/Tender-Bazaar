import { prisma } from '../../../config/database';
import redis from '../../../config/redis';

export const analyticsService = {
  async getPlatformAnalytics() {
    const [
      mostViewedTenders,
      mostSavedTenders,
      tendersByCategory,
      tendersByState,
      tendersByPortal,
    ] = await Promise.all([
      prisma.tender.findMany({
        orderBy: { viewCount: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          organization: true,
          viewCount: true,
          category: true,
          state: true,
          estimatedValue: true,
        },
      }),
      prisma.tender.findMany({
        orderBy: { savedBy: { _count: 'desc' } },
        take: 10,
        select: {
          id: true,
          title: true,
          organization: true,
          category: true,
          state: true,
          _count: { select: { savedBy: true } },
        },
      }),
      prisma.tender.groupBy({
        by: ['category'],
        _count: true,
        _avg: { estimatedValue: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      prisma.tender.groupBy({
        by: ['state'],
        _count: true,
        orderBy: { _count: { state: 'desc' } },
        take: 20,
      }),
      prisma.tender.groupBy({
        by: ['sourcePortal'],
        _count: true,
        orderBy: { _count: { sourcePortal: 'desc' } },
      }),
    ]);

    // User state distribution from company profiles
    let usersByState: { state: string; count: number }[] = [];
    try {
      const profiles = await prisma.companyProfile.findMany({
        select: { statesOperated: true },
      });
      const stateMap = new Map<string, number>();
      for (const p of profiles) {
        for (const s of p.statesOperated) {
          stateMap.set(s, (stateMap.get(s) || 0) + 1);
        }
      }
      usersByState = Array.from(stateMap.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    } catch {
      /* ignore */
    }

    return {
      mostViewedTenders,
      mostSavedTenders: mostSavedTenders.map((t) => ({
        ...t,
        savedCount: t._count.savedBy,
      })),
      tendersByCategory: tendersByCategory.map((c) => ({
        category: c.category,
        count: (c._count as any)?._all ?? (c._count as any)?.category ?? (typeof c._count === 'number' ? c._count : 0),
        avgValue: Math.round(c._avg.estimatedValue || 0),
      })),
      tendersByState: tendersByState.map((s) => ({
        state: s.state,
        count: (s._count as any)?._all ?? (s._count as any)?.state ?? (typeof s._count === 'number' ? s._count : 0),
      })),
      tendersByPortal: tendersByPortal.map((p) => ({
        portal: p.sourcePortal,
        count: (p._count as any)?._all ?? (p._count as any)?.sourcePortal ?? (typeof p._count === 'number' ? p._count : 0),
      })),
      usersByState,
    };
  },

  async getUserGrowth(period: string) {
    const now = new Date();
    let startDate: Date;
    let groupBy: 'day' | 'week' | 'month' = 'day';

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
        break;
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, role: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = new Map<string, { total: number; users: number; admins: number }>();

    for (const u of users) {
      let key: string;
      if (groupBy === 'day') {
        key = u.createdAt.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const d = new Date(u.createdAt);
        d.setDate(d.getDate() - d.getDay());
        key = d.toISOString().split('T')[0];
      } else {
        key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = grouped.get(key) || { total: 0, users: 0, admins: 0 };
      existing.total++;
      if (u.role === 'USER') existing.users++;
      else existing.admins++;
      grouped.set(key, existing);
    }

    const growth = Array.from(grouped.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // Cumulative total
    const totalBefore = await prisma.user.count({ where: { createdAt: { lt: startDate } } });
    let cumulative = totalBefore;
    const cumulativeGrowth = growth.map((g) => {
      cumulative += g.total;
      return { ...g, cumulative };
    });

    return {
      growth: cumulativeGrowth,
      totalUsers: await prisma.user.count(),
      newInPeriod: users.length,
      groupedBy: groupBy,
    };
  },

  async getRevenueAnalytics(period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const payments = await prisma.payment.findMany({
      where: { status: 'SUCCESS', createdAt: { gte: startDate } },
      select: { amount: true, planSlug: true, billingCycle: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Daily revenue
    const dailyMap = new Map<string, number>();
    for (const p of payments) {
      const date = p.createdAt.toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + p.amount);
    }

    // Revenue by plan
    const planMap = new Map<string, number>();
    for (const p of payments) {
      const plan = p.planSlug || 'unknown';
      planMap.set(plan, (planMap.get(plan) || 0) + p.amount);
    }

    // Revenue by billing cycle
    const cycleMap = new Map<string, number>();
    for (const p of payments) {
      const cycle = p.billingCycle || 'UNKNOWN';
      cycleMap.set(cycle, (cycleMap.get(cycle) || 0) + p.amount);
    }

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalRevenue,
      transactionCount: payments.length,
      avgTransactionValue: payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0,
      dailyRevenue: Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount })),
      revenueByPlan: Array.from(planMap.entries()).map(([plan, amount]) => ({ plan, amount })),
      revenueByBillingCycle: Array.from(cycleMap.entries()).map(([cycle, amount]) => ({ cycle, amount })),
    };
  },

  async getTenderAnalytics(period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const tenders = await prisma.tender.findMany({
      where: { createdAt: { gte: startDate } },
      select: { category: true, state: true, sourcePortal: true, estimatedValue: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Daily tenders added
    const dailyMap = new Map<string, number>();
    for (const t of tenders) {
      const date = t.createdAt.toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    }

    // By category in period
    const catMap = new Map<string, number>();
    for (const t of tenders) {
      catMap.set(t.category, (catMap.get(t.category) || 0) + 1);
    }

    // By state in period
    const stateMap = new Map<string, number>();
    for (const t of tenders) {
      stateMap.set(t.state, (stateMap.get(t.state) || 0) + 1);
    }

    // By portal in period
    const portalMap = new Map<string, number>();
    for (const t of tenders) {
      portalMap.set(t.sourcePortal, (portalMap.get(t.sourcePortal) || 0) + 1);
    }

    // Total value
    const totalValue = tenders.reduce((sum, t) => sum + (t.estimatedValue || 0), 0);

    return {
      totalAdded: tenders.length,
      totalValue,
      dailyTenders: Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })),
      byCategory: Array.from(catMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      byState: Array.from(stateMap.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      byPortal: Array.from(portalMap.entries())
        .map(([portal, count]) => ({ portal, count }))
        .sort((a, b) => b.count - a.count),
    };
  },

  async getSearchTrends() {
    // Top search queries
    const topSearches = await prisma.searchHistory.groupBy({
      by: ['query'],
      _count: true,
      orderBy: { _count: { query: 'desc' } },
      take: 20,
    });

    // Recent searches (last 7 days)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSearches = await prisma.searchHistory.groupBy({
      by: ['query'],
      where: { createdAt: { gte: last7d } },
      _count: true,
      orderBy: { _count: { query: 'desc' } },
      take: 20,
    });

    // Search volume over time
    const searchVolume = await prisma.searchHistory.findMany({
      where: { createdAt: { gte: last7d } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyVolume = new Map<string, number>();
    for (const s of searchVolume) {
      const date = s.createdAt.toISOString().split('T')[0];
      dailyVolume.set(date, (dailyVolume.get(date) || 0) + 1);
    }

    // Top keywords from Redis
    let redisKeywords: { keyword: string; score: number }[] = [];
    try {
      const raw = await redis.zrevrange('search:keywords', 0, 19, 'WITHSCORES');
      for (let i = 0; i < raw.length; i += 2) {
        redisKeywords.push({ keyword: raw[i], score: parseFloat(raw[i + 1]) });
      }
    } catch {
      /* Redis unavailable */
    }

    return {
      topSearches: topSearches.map((s) => ({
        query: s.query,
        count: (s._count as any)?._all ?? (s._count as any)?.query ?? (typeof s._count === 'number' ? s._count : 0),
      })),
      trendingSearches: recentSearches.map((s) => ({
        query: s.query,
        count: (s._count as any)?._all ?? (s._count as any)?.query ?? (typeof s._count === 'number' ? s._count : 0),
      })),
      dailyVolume: Array.from(dailyVolume.entries()).map(([date, count]) => ({ date, count })),
      totalSearches: await prisma.searchHistory.count(),
      redisKeywords,
    };
  },
};
