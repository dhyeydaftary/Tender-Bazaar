import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';
import { planConfigService } from '../../subscriptions/plan-config.service';

interface SubscriptionListFilters {
  page: number;
  limit: number;
  search?: string;
  plan?: string;
  status?: string;
  billingCycle?: string;
  sortBy: string;
  sortOrder: string;
}

export const subscriptionsService = {
  async getSubscriptionList(filters: SubscriptionListFilters) {
    const { page, limit, search, plan, status, billingCycle, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (billingCycle) where.billingCycle = billingCycle;
    if (plan) where.plan = { slug: plan };

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          plan: {
            select: { id: true, name: true, slug: true, monthlyPrice: true, yearlyPrice: true },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return {
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: s.user.name,
        userEmail: s.user.email,
        userPhone: s.user.phone,
        plan: s.plan.name,
        planSlug: s.plan.slug,
        status: s.status,
        billingCycle: s.billingCycle,
        startDate: s.startDate,
        endDate: s.endDate,
        autoRenew: s.autoRenew,
        aiChecksUsed: s.aiChecksUsed,
        lifetimeAiChecksUsed: s.lifetimeAiChecksUsed,
        savedTendersCount: s.savedTendersCount,
        alertsCreatedCount: s.alertsCreatedCount,
        amount: s.billingCycle === 'MONTHLY' ? s.plan.monthlyPrice : s.plan.yearlyPrice,
        createdAt: s.createdAt,
      })),
      total,
      page,
      limit,
    };
  },

  async getSubscriptionStats() {
    const [
      totalActive,
      totalExpired,
      totalCancelled,
      byPlan,
      byBillingCycle,
      expiringNext7Days,
      recentCancellations,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { status: 'CANCELLED' } }),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      prisma.subscription.groupBy({
        by: ['billingCycle'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.subscription.findMany({
        where: { status: 'CANCELLED' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);

    // Resolve plan names
    let planDistribution: { plan: string; slug: string; count: number }[] = [];
    if (byPlan.length > 0) {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { id: { in: byPlan.map((p) => p.planId) } },
        select: { id: true, name: true, slug: true },
      });
      const planMap = new Map(plans.map((p) => [p.id, p]));
      planDistribution = byPlan.map((p) => ({
        plan: planMap.get(p.planId)?.name || 'Unknown',
        slug: planMap.get(p.planId)?.slug || 'unknown',
        count: p._count,
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

    const arr = mrr * 12;

    return {
      active: totalActive,
      expired: totalExpired,
      cancelled: totalCancelled,
      total: totalActive + totalExpired + totalCancelled,
      planDistribution,
      billingCycleDistribution: byBillingCycle.map((b) => ({
        cycle: b.billingCycle,
        count: b._count,
      })),
      expiringNext7Days,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      recentCancellations: recentCancellations.map((s) => ({
        id: s.id,
        userName: s.user.name,
        userEmail: s.user.email,
        plan: s.plan.name,
        cancelledAt: s.updatedAt,
      })),
    };
  },

  async getPlans() {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    return plans.map((p) => ({
      ...p,
      activeSubscriptions: p._count.subscriptions,
    }));
  },

  async updatePlan(planId: string, data: Record<string, any>) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    // All updatable fields on SubscriptionPlan
    const fields = [
      'name', 'description', 'monthlyPrice', 'yearlyPrice',
      'tenderViewsPerPage', 'paginationAllowed', 'advancedFilters',
      'maxAlerts', 'emailAlerts', 'pushAlerts', 'whatsappAlerts', 'corrigendumAlerts',
      'maxAiChecks', 'aiChecksResetMonthly', 'aiTenderSummary', 'aiBidAssistant',
      'tenderComparison', 'maxComparisonTenders', 'aiMatching', 'competitorAnalysis',
      'maxSavedTenders', 'documentDownload', 'bulkDownload', 'exportEnabled',
      'tenderCalendar', 'multiLanguage',
      'maxTeamMembers', 'eTenderingSupport', 'dedicatedManager', 'supportLevel',
      'isPopular', 'displayOrder', 'isActive',
    ];

    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== (plan as any)[field]) {
        changes[field] = { old: (plan as any)[field], new: data[field] };
        updateData[field] = data[field];
      }
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    });

    // Invalidate all user plan caches since a plan was modified
    await planConfigService.invalidateAllCaches();

    return { plan: updated, changes };
  },

  async updateSubscription(subscriptionId: string, data: { status?: string; autoRenew?: boolean }) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
    });
    if (!sub) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.autoRenew !== undefined) updateData.autoRenew = data.autoRenew;

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });

    // Invalidate the user's plan cache
    await planConfigService.invalidateCache(sub.userId);

    return updated;
  },

  async cancelSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', autoRenew: false },
    });

    // Invalidate the user's plan cache
    await planConfigService.invalidateCache(sub.userId);

    return { message: 'Subscription cancelled', subscription: updated };
  },
};
