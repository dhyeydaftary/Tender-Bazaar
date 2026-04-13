import { prisma } from '../../../config/database';
import redis from '../../../config/redis';

export const dashboardService = {
  async getDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalUsers,
      newUsersThisWeek,
      newUsersLastWeek,
      activeSubscriptions,
      revenueThisMonth,
      revenueLastMonth,
      revenueThisYear,
      totalTenders,
      tendersToday,
      tendersYesterday,
      tendersThisWeek,
      totalPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000), lt: startOfWeek } },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      prisma.tender.count(),
      prisma.tender.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.tender.count({ where: { createdAt: { gte: startOfYesterday, lt: startOfToday } } }),
      prisma.tender.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.payment.count({ where: { status: 'SUCCESS' } }),
    ]);

    // Subscription distribution by plan
    const subscriptionsByPlanRaw = await prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: true,
    });

    let subscriptionsByPlan: { plan: string; slug: string; count: number }[] = [];
    if (subscriptionsByPlanRaw.length > 0) {
      const planIds = subscriptionsByPlanRaw.map((s) => s.planId);
      const plans = await prisma.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true, slug: true },
      });
      const planMap = new Map(plans.map((p) => [p.id, p]));
      subscriptionsByPlan = subscriptionsByPlanRaw.map((s) => ({
        plan: planMap.get(s.planId)?.name || 'Unknown',
        slug: planMap.get(s.planId)?.slug || 'unknown',
        count: s._count,
      }));
    }

    // MRR calculation
    const [activeMonthly, activeYearly] = await Promise.all([
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', billingCycle: 'MONTHLY' },
        include: { plan: { select: { monthlyPrice: true } } },
      }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', billingCycle: 'YEARLY' },
        include: { plan: { select: { yearlyPrice: true } } },
      }),
    ]);
    const mrr =
      activeMonthly.reduce((sum, s) => sum + s.plan.monthlyPrice, 0) +
      activeYearly.reduce((sum, s) => sum + s.plan.yearlyPrice / 12, 0);

    // Top keywords from Redis
    let topKeywords: { keyword: string; score: number }[] = [];
    try {
      const raw = await redis.zrevrange('search:keywords', 0, 9, 'WITHSCORES');
      for (let i = 0; i < raw.length; i += 2) {
        topKeywords.push({ keyword: raw[i], score: parseFloat(raw[i + 1]) });
      }
    } catch {
      /* Redis unavailable */
    }

    return {
      users: {
        total: totalUsers,
        newThisWeek: newUsersThisWeek,
        weekOverWeekChange: newUsersLastWeek > 0
          ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
          : 100,
      },
      subscriptions: {
        active: activeSubscriptions,
        byPlan: subscriptionsByPlan,
      },
      revenue: {
        thisMonth: revenueThisMonth._sum.amount || 0,
        lastMonth: revenueLastMonth._sum.amount || 0,
        thisYear: revenueThisYear._sum.amount || 0,
        mrr: Math.round(mrr * 100) / 100,
        monthOverMonthChange:
          (revenueLastMonth._sum.amount || 0) > 0
            ? Math.round(
                (((revenueThisMonth._sum.amount || 0) - (revenueLastMonth._sum.amount || 0)) /
                  (revenueLastMonth._sum.amount || 1)) *
                  100,
              )
            : 0,
      },
      tenders: {
        total: totalTenders,
        addedToday: tendersToday,
        addedYesterday: tendersYesterday,
        addedThisWeek: tendersThisWeek,
        todayVsYesterday: tendersToday - tendersYesterday,
      },
      totalPayments,
      topKeywords,
    };
  },

  async getChartData(period: string) {
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

    // Revenue over time — aggregate payments by date
    const payments = await prisma.payment.findMany({
      where: { status: 'SUCCESS', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const revenueByDate = new Map<string, number>();
    for (const p of payments) {
      const date = p.createdAt.toISOString().split('T')[0];
      revenueByDate.set(date, (revenueByDate.get(date) || 0) + p.amount);
    }

    // User signups over time
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const usersByDate = new Map<string, number>();
    for (const u of users) {
      const date = u.createdAt.toISOString().split('T')[0];
      usersByDate.set(date, (usersByDate.get(date) || 0) + 1);
    }

    // Tenders added over time
    const tenders = await prisma.tender.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const tendersByDate = new Map<string, number>();
    for (const t of tenders) {
      const date = t.createdAt.toISOString().split('T')[0];
      tendersByDate.set(date, (tendersByDate.get(date) || 0) + 1);
    }

    // Build all dates in range for a complete chart
    const allDates: string[] = [];
    const d = new Date(startDate);
    while (d <= now) {
      allDates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    return {
      revenue: allDates.map((date) => ({ date, amount: revenueByDate.get(date) || 0 })),
      users: allDates.map((date) => ({ date, count: usersByDate.get(date) || 0 })),
      tenders: allDates.map((date) => ({ date, count: tendersByDate.get(date) || 0 })),
    };
  },

  async getRecentSignups(limit: number = 10) {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        subscription: {
          select: {
            plan: { select: { name: true, slug: true } },
          },
        },
        companyProfile: {
          select: { companyName: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.subscription?.plan?.name || 'Free',
      company: u.companyProfile?.companyName || null,
      joined: u.createdAt,
    }));
  },
};
