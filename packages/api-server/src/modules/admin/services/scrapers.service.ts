import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/middleware/error-handler';
import { enqueueScrapeJob, portalNameToRegistryKey } from '../../../queue/scraper-job-publisher';
import {
  isValidCronExpression,
  nextCronRun,
  hasMissedSchedule,
} from '../../../shared/utils/cron-schedule';

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

    // NOTE: this handler used to fail stale RUNNING rows here, i.e. an ordinary
    // GET mutated data, and recovery happened only if a human opened this page.
    // The scraper engine now recovers interrupted runs at startup and on a
    // timer (StorageWriter.recoverStaleRuns), so listing is read-only.

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
    const now = new Date();

    return scrapers.map((s) => {
      const realCount = getRealTenderCount(s.portalName, s.totalTendersFound);

      // Derived rather than stored: no schema change, and it cannot go stale.
      // All cron expressions are evaluated in UTC, matching the scraper engine.
      const cronValid = s.cronExpression ? isValidCronExpression(s.cronExpression) : false;
      const nextRunAt =
        s.enabled && cronValid ? nextCronRun(s.cronExpression as string, now) : null;
      const missedSchedule =
        s.enabled && cronValid
          ? hasMissedSchedule(s.cronExpression, s.lastRunAt, now)
          : false;

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
        // Scheduling visibility (previously absent entirely):
        cronValid,
        nextRunAt,
        missedSchedule,
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

    // Call the scraper engine's control API if it is reachable.
    //
    // POST /api/portals/:key/run now requires the shared secret
    // SCRAPER_API_TOKEN; without it the engine answers 401 and we fall through
    // to the durable queue below, which is the same path used when the engine
    // is simply down.
    let engineTriggered = false;
    const scraperUrls = [
      env.SCRAPER_API_URL,
      'http://tenderbazaar-scraper:4001',
      'http://localhost:4001',
    ].filter((url, index, all) => url && all.indexOf(url) === index);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SCRAPER_API_TOKEN) {
      headers.Authorization = `Bearer ${env.SCRAPER_API_TOKEN}`;
    }

    for (const baseUrl of scraperUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/portals/${registryKey}/run`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          engineTriggered = true;
          break;
        }
        // 409: the engine REFUSED because a run for this portal is already
        // queued or in progress.
        //
        // This must not fall through to the durable-queue fallback below. That
        // fallback exists for an unreachable engine; using it here would publish
        // a second job for a portal the engine is deliberately protecting with
        // its per-portal lock — turning a correct refusal into the duplicate
        // run the lock exists to prevent. Surface it to the operator instead.
        if (response.status === 409) {
          throw new AppError(
            `A scraping run for "${portalName}" is already queued or in progress. ` +
              'No new job was queued.',
            409,
            'RUN_ALREADY_IN_PROGRESS',
          );
        }
        if (response.status === 401) {
          console.error(
            '[scrapers] Scraper control API rejected our token (401). ' +
              'Check that SCRAPER_API_TOKEN matches on api-server and scraper. ' +
              'Falling back to the job queue.',
          );
          break;
        }
      } catch (err) {
        // A 409 is a real answer from the engine, not a connectivity problem,
        // so it propagates instead of being retried against the next URL.
        if (err instanceof AppError) throw err;
        // Unreachable on this URL — try the next, then fall back to the queue.
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
      // Reject unparseable expressions instead of storing them and reporting
      // success: the scheduler would discard such a value and keep the old
      // cadence, so the UI would show a schedule that never takes effect.
      if (data.cronExpression !== null && data.cronExpression !== '') {
        if (!isValidCronExpression(data.cronExpression)) {
          throw new AppError(
            'Invalid cron expression. Use 5 space-separated fields, for example "0 */4 * * *" ' +
              '(minute hour day-of-month month day-of-week, evaluated in UTC).',
            400,
            'INVALID_CRON_EXPRESSION',
          );
        }
      }
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
