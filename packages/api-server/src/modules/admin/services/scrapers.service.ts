import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/middleware/error-handler';
import { enqueueScrapeJob, portalNameToRegistryKey } from '../../../queue/scraper-job-publisher';
import { engineBaseUrls, fetchEngineStatus, requestEngineRun } from './scraper-engine-client';
import { buildRunStats, emptyRunStats } from './scraper-run-stats';
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

    // Run outcomes from the run history itself (see scraper-run-stats.ts for why
    // the ScraperHealth counters are not used for KPIs).
    const portalNames = scrapers.map((s) => s.portalName);
    const [runsByStatus, runsWithErrors] = await Promise.all([
      prisma.scrapingRun.groupBy({
        by: ['portalName', 'status'],
        where: { portalName: { in: portalNames } },
        _count: true,
      }),
      prisma.scrapingRun.groupBy({
        by: ['portalName'],
        where: { portalName: { in: portalNames }, status: 'COMPLETED', errors: { gt: 0 } },
        _count: true,
      }),
    ]);
    const runStats = buildRunStats(runsByStatus, runsWithErrors);

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
        runStats: runStats.get(s.portalName) ?? emptyRunStats(),
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
    const outcome = await requestEngineRun({
      baseUrls: engineBaseUrls(env.SCRAPER_API_URL),
      registryKey,
      token: env.SCRAPER_API_TOKEN,
    });

    // 409: the engine REFUSED because a run for this portal is already
    // queued or in progress.
    //
    // This must not fall through to the durable-queue fallback below. That
    // fallback exists for an unreachable engine; using it here would publish
    // a second job for a portal the engine is deliberately protecting with
    // its per-portal lock — turning a correct refusal into the duplicate
    // run the lock exists to prevent. Surface it to the operator instead.
    if (outcome.kind === 'refused') {
      throw new AppError(
        `A scraping run for "${portalName}" is already queued or in progress. ` +
          'No new job was queued.',
        409,
        'RUN_ALREADY_IN_PROGRESS',
      );
    }

    if (outcome.kind === 'triggered') {
      return {
        message: outcome.simulated
          ? `Simulated demo run started for "${portalName}". No external portal is contacted.`
          : `Scraper for "${portalName}" triggered successfully`,
        jobId: outcome.jobId ?? null,
        registryKey,
        portalName,
        simulated: outcome.simulated,
        dispatch: 'engine' as const,
        triggeredBy: adminId,
        triggeredAt: new Date(),
      };
    }

    if (outcome.kind === 'unauthorized') {
      console.error(
        '[scrapers] Scraper control API rejected our token (401). ' +
          'Check that SCRAPER_API_TOKEN matches on api-server and scraper.',
      );
    }

    // The engine was not reachable (or rejected our token). The durable BullMQ
    // queue is the fallback, unless this deployment has no queue consumer —
    // the demo configuration sets SCRAPER_QUEUE_FALLBACK=false, because a job
    // published there would never run and the admin would be told otherwise.
    if (env.SCRAPER_QUEUE_FALLBACK !== 'true') {
      throw new AppError(
        outcome.kind === 'unauthorized'
          ? 'The scraper engine rejected the API token. No run was started.'
          : 'The scraper engine is unreachable. No run was started.',
        503,
        'SCRAPER_ENGINE_UNAVAILABLE',
      );
    }

    let queued: { jobId: string };
    try {
      queued = await enqueueScrapeJob(portalName);
    } catch (err) {
      // Previously this was swallowed and the endpoint still answered
      // "triggered successfully" with a fabricated job id.
      console.error(`Failed to enqueue scrape job for ${portalName}:`, err);
      throw new AppError(
        'The scraper engine is unreachable and the job could not be queued. No run was started.',
        503,
        'SCRAPER_ENGINE_UNAVAILABLE',
      );
    }

    return {
      message: `Scraper for "${portalName}" queued; it will run when the scraper engine picks it up`,
      jobId: queued.jobId,
      registryKey,
      portalName,
      simulated: false,
      dispatch: 'queue' as const,
      triggeredBy: adminId,
      triggeredAt: new Date(),
    };
  },

  /** Which engine answers on SCRAPER_API_URL, and whether it is a demo engine. */
  async getEngineStatus() {
    return fetchEngineStatus({ baseUrl: env.SCRAPER_API_URL });
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
