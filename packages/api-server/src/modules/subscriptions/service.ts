import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { planConfigService } from './plan-config.service';

export const subscriptionService = {
  /**
   * Get all active plans, ordered by displayOrder.
   */
  async getPlans() {
    return planConfigService.getAllPlans();
  },

  /**
   * Get the current subscription + plan info for a user.
   */
  async getCurrentSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE' || subscription.endDate < new Date()) {
      // Return Free plan info
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { slug: 'free' },
      });

      return {
        subscription: null,
        plan: freePlan || {
          name: 'Free',
          slug: 'free',
          description: 'Get started with basic tender discovery',
          monthlyPrice: 0,
          yearlyPrice: 0,
          tenderViewsPerPage: 20,
          paginationAllowed: false,
          advancedFilters: false,
          maxAlerts: 0,
          maxAiChecks: 1,
          aiChecksResetMonthly: true,
          maxSavedTenders: 0,
          documentDownload: false,
        },
        isFreePlan: true,
      };
    }

    return {
      subscription,
      plan: subscription.plan,
      isFreePlan: false,
    };
  },

  /**
   * Get usage stats for a user — delegates to planConfigService.
   */
  async getUsageStats(userId: string) {
    return planConfigService.getUsageStats(userId);
  },

  /**
   * Check if user can perform a specific action based on their plan.
   */
  async checkPlanLimit(userId: string, feature: string) {
    return planConfigService.checkLimit(userId, feature);
  },
};
