import { prisma } from '../../config/database';
import { planConfigService } from '../subscriptions/plan-config.service';
import { eligibilityService } from '../eligibility/service';
import { tenderService } from '../tenders/service';

/**
 * Dashboard aggregation.
 *
 * The web dashboard previously rendered hard-coded constants. Every panel here
 * is backed by a real query.
 *
 * This is deliberately a *single* endpoint rather than letting the page fan out
 * to /tenders/stats + /saved + /alerts + /subscription/usage + /eligibility/match
 * + /search/history. One round trip keeps the dashboard cheap against the API
 * rate limit and avoids six separate loading states.
 */

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Expiring-soon window for saved tenders, in days. */
const EXPIRING_SOON_DAYS = 7;

export const dashboardService = {
  async getDashboard(userId: string) {
    const todayStart = startOfToday();
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const [
      tenderStats,
      newYesterday,
      newThisWeek,
      savedCount,
      savedExpiringSoon,
      aiScoreAgg,
      alerts,
      planUsage,
      plan,
      recentSearches,
      recommendedTenders,
    ] = await Promise.all([
      tenderService.getTenderStats(),

      // Yesterday's intake, so "new today" can report a real day-over-day
      // delta instead of an invented percentage.
      prisma.tender.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),

      prisma.tender.count({
        where: { status: 'ACTIVE', createdAt: { gte: daysFromNow(-7) } },
      }),

      prisma.savedTender.count({ where: { userId } }),

      prisma.savedTender.count({
        where: {
          userId,
          tender: {
            status: 'ACTIVE',
            bidSubmissionDeadline: { gte: new Date(), lte: daysFromNow(EXPIRING_SOON_DAYS) },
          },
        },
      }),

      prisma.eligibilityCheck.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: { _all: true },
      }),

      prisma.alert.findMany({
        where: { userId },
        orderBy: [{ isActive: 'desc' }, { matchCount: 'desc' }],
        take: 6,
        select: {
          id: true,
          name: true,
          matchCount: true,
          isActive: true,
          lastMatchedAt: true,
        },
      }),

      planConfigService.getUsageStats(userId),
      planConfigService.getUserPlan(userId),

      prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, query: true, resultCount: true, createdAt: true },
      }),

      dashboardService.getRecommendedTenders(userId),
    ]);

    const newToday = tenderStats.newToday;
    // Guard the division: with no tenders yesterday any percentage would be
    // meaningless (or Infinity), so report null and let the UI fall back to the
    // absolute count.
    const newTodayChangePct =
      newYesterday > 0 ? Math.round(((newToday - newYesterday) / newYesterday) * 100) : null;

    const aiChecksCount = aiScoreAgg._count._all;
    const avgAiScore = aiScoreAgg._avg.score !== null ? Math.round(aiScoreAgg._avg.score) : null;

    return {
      stats: {
        newToday,
        newTodayChangePct,
        activeTenders: tenderStats.active,
        activeAddedThisWeek: newThisWeek,
        savedCount,
        savedExpiringSoon,
        avgAiScore,
        aiChecksCount,
      },
      recommendedTenders,
      alerts,
      planUsage: {
        planName: plan.name,
        usage: planUsage,
      },
      recentSearches,
    };
  },

  /**
   * Personalised recommendations derived from the user's company profile. A
   * user who has not filled in a profile yet still gets something useful — the
   * newest active tenders — rather than an empty panel, flagged with
   * `personalised: false` so the UI can invite them to complete their profile.
   */
  async getRecommendedTenders(userId: string) {
    const matches = await eligibilityService.getMatchingTenders(userId);

    if (matches.length > 0) {
      return {
        personalised: true,
        tenders: matches.slice(0, 5).map(({ tender, matchScore, matchReasons }) => ({
          id: tender.id,
          title: tender.title,
          organization: tender.organization,
          category: tender.category,
          state: tender.state,
          estimatedValue: tender.estimatedValue,
          bidSubmissionDeadline: tender.bidSubmissionDeadline,
          aiScore: matchScore,
          matchReasons,
        })),
      };
    }

    const fallback = await prisma.tender.findMany({
      where: { status: 'ACTIVE', bidSubmissionDeadline: { gte: new Date() } },
      orderBy: { publishedDate: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        organization: true,
        category: true,
        state: true,
        estimatedValue: true,
        bidSubmissionDeadline: true,
      },
    });

    return {
      personalised: false,
      tenders: fallback.map((tender) => ({
        ...tender,
        aiScore: null,
        matchReasons: [] as string[],
      })),
    };
  },
};
