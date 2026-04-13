import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';

export const scrapersService = {
  async getScraperList() {
    const scrapers = await prisma.scraperHealth.findMany({
      orderBy: { portalName: 'asc' },
    });

    // Get latest run for each scraper
    const latestRuns = await prisma.scrapingRun.findMany({
      where: {
        portalName: { in: scrapers.map((s) => s.portalName) },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['portalName'],
      select: {
        portalName: true,
        status: true,
        totalFound: true,
        newTenders: true,
        updatedTenders: true,
        errors: true,
        duration: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const runMap = new Map(latestRuns.map((r) => [r.portalName, r]));

    return scrapers.map((s) => ({
      id: s.id,
      portalName: s.portalName,
      status: s.status,
      enabled: s.enabled,
      cronExpression: s.cronExpression,
      lastRunAt: s.lastRunAt,
      lastSuccessAt: s.lastSuccessAt,
      lastFailureAt: s.lastFailureAt,
      totalRuns: s.totalRuns,
      totalSuccessRuns: s.totalSuccessRuns,
      totalFailedRuns: s.totalFailedRuns,
      consecutiveFailures: s.consecutiveFailures,
      totalTendersFound: s.totalTendersFound,
      totalTendersNew: s.totalTendersNew,
      avgDurationMs: s.avgDurationMs,
      errorRate: s.errorRate,
      lastError: s.lastError,
      latestRun: runMap.get(s.portalName) || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  },

  async getScraperRuns(portalName: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const health = await prisma.scraperHealth.findUnique({ where: { portalName } });
    if (!health) {
      throw new AppError('Scraper not found', 404, 'SCRAPER_NOT_FOUND');
    }

    const [runs, total] = await Promise.all([
      prisma.scrapingRun.findMany({
        where: { portalName },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scrapingRun.count({ where: { portalName } }),
    ]);

    return { runs, total, page, limit, scraper: health };
  },

  async triggerScraper(portalName: string, adminId: string) {
    const health = await prisma.scraperHealth.findUnique({ where: { portalName } });
    if (!health) {
      throw new AppError('Scraper not found', 404, 'SCRAPER_NOT_FOUND');
    }

    if (!health.enabled) {
      throw new AppError('Scraper is disabled', 400, 'SCRAPER_DISABLED');
    }

    // Create a new scraping run entry
    const run = await prisma.scrapingRun.create({
      data: {
        portalName,
        status: 'PENDING',
        triggeredBy: 'manual',
        priority: 10,
        metadata: { triggeredByAdmin: adminId },
      },
    });

    // In production, this would enqueue a BullMQ job
    // For now, simulate by setting the run as "queued"

    return {
      message: `Scraper for "${portalName}" triggered successfully`,
      runId: run.id,
      portalName,
      triggeredAt: run.createdAt,
    };
  },

  async updateScraper(portalName: string, data: { enabled?: boolean; cronExpression?: string }) {
    const health = await prisma.scraperHealth.findUnique({ where: { portalName } });
    if (!health) {
      throw new AppError('Scraper not found', 404, 'SCRAPER_NOT_FOUND');
    }

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (data.enabled !== undefined && data.enabled !== health.enabled) {
      changes.enabled = { old: health.enabled, new: data.enabled };
      updateData.enabled = data.enabled;
      if (!data.enabled) {
        updateData.status = 'DISABLED';
      } else if (health.status === 'DISABLED') {
        updateData.status = 'HEALTHY';
      }
    }

    if (data.cronExpression !== undefined && data.cronExpression !== health.cronExpression) {
      changes.cronExpression = { old: health.cronExpression, new: data.cronExpression };
      updateData.cronExpression = data.cronExpression;
    }

    const updated = await prisma.scraperHealth.update({
      where: { portalName },
      data: updateData,
    });

    return { scraper: updated, changes };
  },
};
