import { prisma } from '../../config/database';
import { planConfigService } from '../subscriptions/plan-config.service';
import { eligibilityService } from '../eligibility/service';
import { tenderService, TENDER_CARD_SELECT } from '../tenders/service';
import { expiringSoonWhere, openForBiddingWhere } from '../tenders/status-groups';

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

/** Number of recommendations the dashboard and the mobile home page preview. */
const RECOMMENDED_PREVIEW_LIMIT = 5;

type CardTender = { [K in keyof typeof TENDER_CARD_SELECT]: unknown };

/** Keep only the card fields of a full tender row (matches TENDER_CARD_SELECT). */
const toCardFields = (tender: CardTender) =>
  Object.fromEntries(
    Object.keys(TENDER_CARD_SELECT).map((key) => [key, tender[key as keyof CardTender]]),
  );

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
        where: { userId, tender: expiringSoonWhere(new Date()) },
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
        closedTenders: tenderStats.closed,
        totalTenders: tenderStats.total,
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
    const { personalised, tenders } = await dashboardService.listRecommendedTenders(userId, {
      page: 1,
      limit: RECOMMENDED_PREVIEW_LIMIT,
    });
    return { personalised, tenders };
  },

  /**
   * Paginated recommendations: the dashboard preview is page 1 of this list and
   * GET /tenders/recommended serves the full "See all" listing, so both apply the
   * same relevance ranking and the same open-for-bidding filter.
   */
  async listRecommendedTenders(userId: string, { page, limit }: { page: number; limit: number }) {
    const matches = await eligibilityService.getMatchingTenders(userId);

    if (matches.length > 0) {
      return {
        personalised: true,
        total: matches.length,
        page,
        limit,
        tenders: matches
          .slice((page - 1) * limit, page * limit)
          .map(({ tender, matchScore, matchReasons }) => ({
            ...toCardFields(tender),
            aiScore: matchScore,
            matchReasons,
          })),
      };
    }

    const where = openForBiddingWhere(new Date());
    const [fallback, total] = await Promise.all([
      prisma.tender.findMany({
        where,
        orderBy: [{ publishedDate: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: TENDER_CARD_SELECT,
      }),
      prisma.tender.count({ where }),
    ]);

    return {
      personalised: false,
      total,
      page,
      limit,
      tenders: fallback.map((tender) => ({
        ...tender,
        aiScore: null,
        matchReasons: [] as string[],
      })),
    };
  },
};
