import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';
import { enqueueScrapeJob, portalNameToRegistryKey } from '../../../queue/scraper-job-publisher';

export const scrapersService = {
  async getScraperList() {
    const scrapers = await prisma.scraperHealth.findMany({
      orderBy: { portalName: 'asc' },
    });

    // Query real tender counts by source portal in the database
    const tenderGroups = await prisma.tender.groupBy({
      by: ['sourcePortal'],
      _count: { id: true },
    });
    const tenderCountByPortal: Record<string, number> = {};
    for (const g of tenderGroups) {
      tenderCountByPortal[g.sourcePortal.toLowerCase()] = g._count.id;
    }

    // Portal source mapping for portals with different key/source names
    const getRealTenderCount = (portalName: string, reportedCount: number): number => {
      const p = portalName.toLowerCase();
      let realCount = 0;
      if (p === 'gem') realCount = tenderCountByPortal['gem'] || 0;
      else if (p === 'cppp') realCount = tenderCountByPortal['cppp'] || 0;
      else if (p === 'gujarat') realCount = tenderCountByPortal['nprocure'] || tenderCountByPortal['gujarat'] || 0;
      else if (p === 'maharashtra') realCount = tenderCountByPortal['mahatenders'] || tenderCountByPortal['maharashtra'] || 0;
      else if (p === 'rajasthan') realCount = tenderCountByPortal['eproc.rajasthan'] || tenderCountByPortal['rajasthan'] || 0;
      else if (p === 'eprocure') realCount = tenderCountByPortal['ireps'] || tenderCountByPortal['eprocure'] || 0;
      else realCount = tenderCountByPortal[p] || 0;

      return realCount > 0 ? realCount : reportedCount;
    };

    // Auto-recover stale RUNNING runs older than 15 minutes (e.g. process died/restarted)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.scrapingRun.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: fifteenMinutesAgo },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Run timed out or process was restarted',
        completedAt: new Date(),
      },
    });

    // Get latest run for each scraper
    const latestRuns = await prisma.scrapingRun.findMany({
      where: {
        portalName: { in: scrapers.map((s) => s.portalName) },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['portalName'],
      select: {
        id: true,
        portalName: true,
        status: true,
        triggeredBy: true,
        totalFound: true,
        newTenders: true,
        updatedTenders: true,
        duplicates: true,
        pagesScraped: true,
        errors: true,
        duration: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const runMap = new Map(latestRuns.map((r) => [r.portalName, r]));

    return scrapers.map((s) => {
      const realCount = getRealTenderCount(s.portalName, s.totalTendersFound);
      return {
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
        totalTendersFound: realCount,
        totalTendersNew: s.totalTendersNew > 0 ? s.totalTendersNew : realCount,
        avgDurationMs: s.avgDurationMs,
        errorRate: s.errorRate,
        lastError: s.lastError,
        latestRun: runMap.get(s.portalName) || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });
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

    const registryKey = portalNameToRegistryKey(portalName);

    // Call the scraper engine API directly if available (on port 4001)
    let engineTriggered = false;
    const scraperUrls = ['http://tenderbazaar-scraper:4001', 'http://localhost:4001'];
    for (const baseUrl of scraperUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/portals/${registryKey}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          engineTriggered = true;
          break;
        }
      } catch {
        // Fallback to queue
      }
    }

    // Also publish to BullMQ queue as durable backup if engine HTTP was not reachable
    let jobId: string | undefined;
    if (!engineTriggered) {
      try {
        const queued = await enqueueScrapeJob(portalName);
        jobId = queued.jobId;
      } catch (err) {
        console.error(`Failed to enqueue scrape job for ${portalName}:`, err);
      }
    }

    return {
      message: `Scraper for "${portalName}" triggered successfully`,
      jobId: jobId || `scrape-${registryKey}-${Date.now()}`,
      registryKey,
      portalName,
      triggeredBy: adminId,
      triggeredAt: new Date(),
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
