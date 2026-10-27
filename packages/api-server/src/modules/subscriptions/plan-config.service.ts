import { prisma } from '../../config/database';
import redis from '../../config/redis';
import type { SubscriptionPlan } from '@prisma/client';

// ─── Redis cache keys ───
const PLAN_CACHE_PREFIX = 'plan:user:';
const PLAN_CACHE_TTL = 300; // 5 minutes
const ALL_PLANS_CACHE_KEY = 'plans:all:active';

// ─── Default free plan (fallback if DB is empty) ───
const FREE_PLAN_DEFAULTS: Partial<SubscriptionPlan> = {
  name: 'Free',
  slug: 'free',
  description: 'Get started with basic tender discovery',
  monthlyPrice: 0,
  yearlyPrice: 0,
  currency: 'INR',
  tenderViewsPerPage: 20,
  paginationAllowed: false,
  advancedFilters: false,
  maxAlerts: 0,
  emailAlerts: false,
  pushAlerts: false,
  whatsappAlerts: false,
  corrigendumAlerts: false,
  maxAiChecks: 1,
  aiChecksResetMonthly: true,
  aiTenderSummary: false,
  aiBidAssistant: 'none',
  tenderComparison: false,
  maxComparisonTenders: 0,
  aiMatching: 'none',
  competitorAnalysis: false,
  maxSavedTenders: 0,
  documentDownload: false,
  bulkDownload: false,
  exportEnabled: false,
  tenderCalendar: false,
  multiLanguage: false,
  maxTeamMembers: 1,
  eTenderingSupport: false,
  dedicatedManager: false,
  supportLevel: 'help_center',
  isPopular: false,
  displayOrder: 0,
  isActive: true,
};

/** First instant of the calendar month (UTC) containing `now`. */
function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const planConfigService = {
  /**
   * Get the user's current plan from subscription.
   * Falls back to Free plan if no active subscription.
   * Caches in Redis for 5 minutes.
   */
  async getUserPlan(userId: string): Promise<SubscriptionPlan> {
    // Check Redis cache first
    const cached = await redis.get(`${PLAN_CACHE_PREFIX}${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    let plan: SubscriptionPlan;

    if (subscription && subscription.status === 'ACTIVE' && subscription.endDate > new Date()) {
      plan = subscription.plan;
    } else {
      // No active subscription → free plan
      const freePlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'free' } });
      plan = (freePlan || FREE_PLAN_DEFAULTS) as SubscriptionPlan;
    }

    // Cache the plan
    await redis.setex(`${PLAN_CACHE_PREFIX}${userId}`, PLAN_CACHE_TTL, JSON.stringify(plan));

    return plan;
  },

  /**
   * Check if a boolean feature is enabled on the plan.
   */
  hasFeature(plan: SubscriptionPlan, feature: string): boolean {
    const value = (plan as any)[feature];
    return value === true;
  },

  /**
   * Check if a numeric limit allows more usage.
   * Returns { allowed, used, limit, remaining }.
   */
  async checkLimit(userId: string, limitName: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
  }> {
    const plan = await this.getUserPlan(userId);
    const limit = (plan as any)[limitName] as number;

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, used: 0, limit: -1, remaining: -1 };
    }

    const used = await this.getUsageCount(userId, limitName, plan);
    const allowed = used < limit;
    const remaining = Math.max(0, limit - used);

    return { allowed, used, limit, remaining };
  },

  /**
   * Get current usage count for a specific limit.
   */
  async getUsageCount(userId: string, limitName: string, plan?: SubscriptionPlan): Promise<number> {
    if (!plan) {
      plan = await this.getUserPlan(userId);
    }

    switch (limitName) {
      case 'maxAiChecks': {
        return this.getAiCheckUsage(userId, plan);
      }

      case 'maxSavedTenders': {
        return await prisma.savedTender.count({ where: { userId } });
      }

      case 'maxAlerts': {
        return await prisma.alert.count({ where: { userId } });
      }

      case 'maxComparisonTenders': {
        // Comparison is per-request, not tracked cumulatively
        return 0;
      }

      case 'maxTeamMembers': {
        // Future: count team members
        return 1;
      }

      case 'tenderViewsPerPage': {
        // Not a cumulative limit — handled by tenderPagination middleware
        return 0;
      }

      default:
        return 0;
    }
  },

  /**
   * AI eligibility checks used against the plan's allowance — the single count
   * that checkLimit (requireAiCheck and the eligibility service), the usage API
   * behind the dashboard's AI Checks card, and incrementUsage all agree on.
   *
   * Monthly plans count within the current calendar month (UTC):
   *   - with an active subscription, `aiChecksUsed`, which only counts while
   *     `aiChecksResetDate` falls in this month. The counter rolls over lazily
   *     here and in incrementUsage — nothing schedules resetMonthlyCounters, so
   *     a counter that waited for it would never renew;
   *   - otherwise (no subscription row, or an expired one — the user is on the
   *     Free plan), the checks recorded for the user this month.
   * Lifetime plans count subscription.lifetimeAiChecksUsed, or all recorded
   * checks when there is no subscription row.
   */
  async getAiCheckUsage(userId: string, plan: SubscriptionPlan, now = new Date()): Promise<number> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (plan.aiChecksResetMonthly) {
      const monthStart = startOfUtcMonth(now);
      const subscriptionCounts = !!sub && sub.status === 'ACTIVE' && sub.endDate > now;
      if (subscriptionCounts) {
        return sub.aiChecksResetDate && sub.aiChecksResetDate >= monthStart ? sub.aiChecksUsed : 0;
      }
      return prisma.eligibilityCheck.count({ where: { userId, updatedAt: { gte: monthStart } } });
    }
    if (sub) return sub.lifetimeAiChecksUsed;
    return prisma.eligibilityCheck.count({ where: { userId } });
  },

  /**
   * Increment usage after a successful action.
   */
  async incrementUsage(userId: string, limitName: string): Promise<void> {
    switch (limitName) {
      case 'maxAiChecks': {
        // updateMany throughout: a user without a subscription row has no
        // counter (their recorded checks are counted instead — see
        // getAiCheckUsage), and must not make the check fail after it ran.
        const plan = await this.getUserPlan(userId);
        if (plan.aiChecksResetMonthly) {
          // Count within this month's window; a counter from an earlier month
          // restarts at 1 with a new window.
          const now = new Date();
          const thisMonth = await prisma.subscription.updateMany({
            where: { userId, aiChecksResetDate: { gte: startOfUtcMonth(now) } },
            data: {
              aiChecksUsed: { increment: 1 },
              lifetimeAiChecksUsed: { increment: 1 },
            },
          });
          if (thisMonth.count === 0) {
            await prisma.subscription.updateMany({
              where: { userId },
              data: {
                aiChecksUsed: 1,
                aiChecksResetDate: now,
                lifetimeAiChecksUsed: { increment: 1 },
              },
            });
          }
        } else {
          await prisma.subscription.updateMany({
            where: { userId },
            data: {
              lifetimeAiChecksUsed: { increment: 1 },
              aiChecksUsed: { increment: 1 },
            },
          });
        }
        break;
      }

      case 'maxSavedTenders': {
        await prisma.subscription.updateMany({
          where: { userId },
          data: { savedTendersCount: { increment: 1 } },
        });
        break;
      }

      case 'maxAlerts': {
        await prisma.subscription.updateMany({
          where: { userId },
          data: { alertsCreatedCount: { increment: 1 } },
        });
        break;
      }
    }
  },

  /**
   * Decrement usage after removing something (unsave, delete alert).
   */
  async decrementUsage(userId: string, limitName: string): Promise<void> {
    switch (limitName) {
      case 'maxSavedTenders': {
        const sub = await prisma.subscription.findUnique({ where: { userId } });
        if (sub && sub.savedTendersCount > 0) {
          await prisma.subscription.update({
            where: { userId },
            data: { savedTendersCount: { decrement: 1 } },
          });
        }
        break;
      }

      case 'maxAlerts': {
        const sub = await prisma.subscription.findUnique({ where: { userId } });
        if (sub && sub.alertsCreatedCount > 0) {
          await prisma.subscription.update({
            where: { userId },
            data: { alertsCreatedCount: { decrement: 1 } },
          });
        }
        break;
      }
    }
  },

  /**
   * Reset monthly AI check counters for all subscriptions on monthly plans.
   *
   * Not scheduled anywhere, and not required: monthly counters roll over by
   * date in getAiCheckUsage/incrementUsage. Running it is still consistent —
   * it zeroes the counters and starts a new window now.
   */
  async resetMonthlyCounters(): Promise<number> {
    const result = await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        plan: { aiChecksResetMonthly: true },
      },
      data: {
        aiChecksUsed: 0,
        aiChecksResetDate: new Date(),
      },
    });

    return result.count;
  },

  /**
   * Expire subscriptions that have passed their end date.
   */
  async expireSubscriptions(): Promise<number> {
    const result = await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: new Date() },
        autoRenew: false,
      },
      data: { status: 'EXPIRED' },
    });

    return result.count;
  },

  /**
   * Invalidate cached plan for a user (call after plan change/upgrade).
   */
  async invalidateCache(userId: string): Promise<void> {
    await redis.del(`${PLAN_CACHE_PREFIX}${userId}`);
  },

  /**
   * Invalidate all plan caches (call after admin changes a plan).
   */
  async invalidateAllCaches(): Promise<void> {
    const keys = await redis.keys(`${PLAN_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del(ALL_PLANS_CACHE_KEY);
  },

  /**
   * Get all active plans (cached).
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    const cached = await redis.get(ALL_PLANS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    await redis.setex(ALL_PLANS_CACHE_KEY, 600, JSON.stringify(plans)); // 10 min cache
    return plans;
  },

  /**
   * Get full usage stats for a user (for the subscription/usage API).
   */
  async getUsageStats(userId: string) {
    const plan = await this.getUserPlan(userId);

    const [savedCount, alertCount, aiChecksUsed] = await Promise.all([
      prisma.savedTender.count({ where: { userId } }),
      prisma.alert.count({ where: { userId } }),
      this.getAiCheckUsage(userId, plan),
    ]);

    return [
      {
        feature: 'maxAiChecks',
        label: 'AI Eligibility Checks',
        used: aiChecksUsed,
        limit: plan.maxAiChecks,
        resetType: plan.aiChecksResetMonthly ? 'monthly' : 'lifetime',
        percentage: plan.maxAiChecks === -1 ? 0 : plan.maxAiChecks === 0 ? 100 : Math.round((aiChecksUsed / plan.maxAiChecks) * 100),
      },
      {
        feature: 'maxAlerts',
        label: 'Tender Alerts',
        used: alertCount,
        limit: plan.maxAlerts,
        resetType: 'cumulative',
        percentage: plan.maxAlerts === -1 ? 0 : plan.maxAlerts === 0 ? 100 : Math.round((alertCount / plan.maxAlerts) * 100),
      },
      {
        feature: 'maxSavedTenders',
        label: 'Saved Tenders',
        used: savedCount,
        limit: plan.maxSavedTenders,
        resetType: 'cumulative',
        percentage: plan.maxSavedTenders === -1 ? 0 : plan.maxSavedTenders === 0 ? 100 : Math.round((savedCount / plan.maxSavedTenders) * 100),
      },
      {
        feature: 'maxComparisonTenders',
        label: 'Comparison Tenders (per session)',
        used: 0,
        limit: plan.maxComparisonTenders,
        resetType: 'per_request',
        percentage: 0,
      },
    ];
  },
};
