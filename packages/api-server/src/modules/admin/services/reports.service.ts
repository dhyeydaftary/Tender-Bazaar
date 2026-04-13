import { prisma } from '../../../config/database';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: string;
}

export const reportsService = {
  async getRevenueReport(filters: ReportFilters) {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        amount: true,
        planSlug: true,
        billingCycle: true,
        createdAt: true,
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Daily breakdown
    const dailyMap = new Map<string, number>();
    for (const p of payments) {
      const day = p.createdAt.toISOString().split('T')[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + p.amount);
    }

    // Monthly breakdown
    const monthlyMap = new Map<string, number>();
    for (const p of payments) {
      const month = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + p.amount);
    }

    // Plan breakdown
    const planMap = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const plan = p.planSlug || 'unknown';
      const existing = planMap.get(plan) || { amount: 0, count: 0 };
      existing.amount += p.amount;
      existing.count++;
      planMap.set(plan, existing);
    }

    // Billing cycle breakdown
    const cycleMap = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const cycle = p.billingCycle || 'UNKNOWN';
      const existing = cycleMap.get(cycle) || { amount: 0, count: 0 };
      existing.amount += p.amount;
      existing.count++;
      cycleMap.set(cycle, existing);
    }

    // MRR
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

    return {
      totalRevenue,
      transactionCount: payments.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      dailyRevenue: Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount })),
      monthlyRevenue: Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount })),
      planBreakdown: Array.from(planMap.entries()).map(([plan, data]) => ({ plan, ...data })),
      cycleBreakdown: Array.from(cycleMap.entries()).map(([cycle, data]) => ({ cycle, ...data })),
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  },

  async getUserReport(filters: ReportFilters) {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { role: true, isEmailVerified: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // By month
    const monthlyMap = new Map<string, number>();
    for (const u of users) {
      const month = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    }

    // By role
    const roleMap = new Map<string, number>();
    for (const u of users) {
      roleMap.set(u.role, (roleMap.get(u.role) || 0) + 1);
    }

    // Verified vs unverified
    const verified = users.filter((u) => u.isEmailVerified).length;
    const unverified = users.length - verified;

    // Company profile completion
    const [withProfile, withoutProfile] = await Promise.all([
      prisma.companyProfile.count(),
      prisma.user.count({ where: { companyProfile: null } }),
    ]);

    return {
      totalNewUsers: users.length,
      monthlySignups: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
      byRole: Array.from(roleMap.entries()).map(([role, count]) => ({ role, count })),
      verification: { verified, unverified },
      profileCompletion: { withProfile, withoutProfile },
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  },

  async getTenderReport(filters: ReportFilters) {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    const tenders = await prisma.tender.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: {
        category: true,
        status: true,
        state: true,
        sourcePortal: true,
        estimatedValue: true,
        viewCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Monthly
    const monthlyMap = new Map<string, number>();
    for (const t of tenders) {
      const month = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    }

    // By category
    const catMap = new Map<string, number>();
    for (const t of tenders) {
      catMap.set(t.category, (catMap.get(t.category) || 0) + 1);
    }

    // By status
    const statusMap = new Map<string, number>();
    for (const t of tenders) {
      statusMap.set(t.status, (statusMap.get(t.status) || 0) + 1);
    }

    // By portal
    const portalMap = new Map<string, number>();
    for (const t of tenders) {
      portalMap.set(t.sourcePortal, (portalMap.get(t.sourcePortal) || 0) + 1);
    }

    // Total value and views
    const totalValue = tenders.reduce((sum, t) => sum + (t.estimatedValue || 0), 0);
    const totalViews = tenders.reduce((sum, t) => sum + t.viewCount, 0);

    return {
      totalTenders: tenders.length,
      totalEstimatedValue: totalValue,
      totalViews,
      monthlyTenders: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
      byCategory: Array.from(catMap.entries()).map(([category, count]) => ({ category, count })),
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      byPortal: Array.from(portalMap.entries()).map(([portal, count]) => ({ portal, count })),
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  },

  async getSubscriptionReport(filters: ReportFilters) {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    // All subscriptions created in the period
    const subscriptions = await prisma.subscription.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { plan: { select: { name: true, slug: true, monthlyPrice: true, yearlyPrice: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Monthly new subscriptions
    const monthlyMap = new Map<string, number>();
    for (const s of subscriptions) {
      const month = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    }

    // By plan
    const planMap = new Map<string, number>();
    for (const s of subscriptions) {
      planMap.set(s.plan.name, (planMap.get(s.plan.name) || 0) + 1);
    }

    // By status
    const statusMap = new Map<string, number>();
    for (const s of subscriptions) {
      statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
    }

    // Churn rate: cancelled / total in period
    const cancelled = subscriptions.filter((s) => s.status === 'CANCELLED').length;
    const churnRate = subscriptions.length > 0 ? Math.round((cancelled / subscriptions.length) * 100) : 0;

    return {
      totalSubscriptions: subscriptions.length,
      monthlySubscriptions: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
      byPlan: Array.from(planMap.entries()).map(([plan, count]) => ({ plan, count })),
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      churnRate,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    };
  },

  async exportReport(reportType: string, filters: ReportFilters) {
    // Generate CSV-ready data based on report type
    switch (reportType) {
      case 'revenue':
        return this.getRevenueReport(filters);
      case 'users':
        return this.getUserReport(filters);
      case 'tenders':
        return this.getTenderReport(filters);
      case 'subscriptions':
        return this.getSubscriptionReport(filters);
      default:
        return { error: 'Unknown report type' };
    }
  },
};
