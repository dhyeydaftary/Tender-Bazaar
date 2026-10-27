/**
 * Demo run store
 *
 * Persists simulated runs into the SAME tables the admin dashboard already reads
 * (ScrapingRun, ScraperHealth), because api-server serves scraper status and
 * run history straight from PostgreSQL — a simulation kept only in memory would
 * be invisible to the existing UI.
 *
 * Isolation is enforced here rather than trusted to callers:
 *
 *   - The database handle is typed as DemoDb, which exposes ONLY the two scraper
 *     tables. Tender, TenderDocument and every other model are unreachable from
 *     this module at compile time.
 *   - Every write asserts the portal name carries the `-Demo` suffix, so a
 *     simulated run can never land on, or alter the counters of, a real portal.
 *   - Every run is created with triggeredBy 'demo' and metadata marking it as
 *     simulated, so the database can always answer "was this real?" truthfully.
 */

import { DEMO_PORTAL_SUFFIX, isDemoPortalName } from './demo-portals';

export const DEMO_TRIGGERED_BY = 'demo';
export const DEMO_GENERATOR = 'demo-scraper';

/** Stored on every simulated ScrapingRun.metadata. */
export function simulatedRunMetadata(trigger: 'manual' | 'schedule') {
  return {
    simulated: true,
    generator: DEMO_GENERATOR,
    trigger,
    note: 'Simulated demo run. No external portal was contacted and no tenders were written.',
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The only database surface the demo scraper may use. PrismaClient satisfies it
 * structurally; tests pass an in-memory fake.
 */
export interface DemoDb {
  scrapingRun: {
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
    findUnique(args: any): Promise<any>;
  };
  scraperHealth: {
    upsert(args: any): Promise<any>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface RunProgress {
  pagesScraped: number;
  totalFound: number;
  duplicates: number;
  /** Simulated page errors so far. */
  errors: number;
}

export interface RunTotals extends RunProgress {
  newTenders: number;
  updatedTenders: number;
}

function assertDemoPortal(portalName: string): void {
  if (!isDemoPortalName(portalName)) {
    throw new Error(
      `Demo scraper refused to write for "${portalName}": demo portals must end in "${DEMO_PORTAL_SUFFIX}".`,
    );
  }
}

export class DemoRunStore {
  constructor(private readonly db: DemoDb) {}

  /** Liveness of the database connection, for /api/ready. */
  async ping(): Promise<void> {
    await this.db.$queryRaw`SELECT 1`;
  }

  /**
   * Create the portal's ScraperHealth row if missing. The cron expression is
   * re-applied on every boot because these rows belong to the demo scraper
   * alone; real portal rows are never touched.
   */
  async ensurePortal(portalName: string, cronExpression: string | null): Promise<void> {
    assertDemoPortal(portalName);
    await this.db.scraperHealth.upsert({
      where: { portalName },
      create: { portalName, cronExpression, status: 'HEALTHY', enabled: true },
      update: { cronExpression },
    });
  }

  async isPortalEnabled(portalName: string): Promise<boolean> {
    assertDemoPortal(portalName);
    const row = await this.db.scraperHealth.findUnique({
      where: { portalName },
      select: { enabled: true },
    });
    return row?.enabled ?? false;
  }

  async createRun(
    portalName: string,
    trigger: 'manual' | 'schedule',
    maxPages: number,
  ): Promise<string> {
    assertDemoPortal(portalName);
    const run = await this.db.scrapingRun.create({
      data: {
        portalName,
        status: 'PENDING',
        triggeredBy: DEMO_TRIGGERED_BY,
        maxPages,
        metadata: simulatedRunMetadata(trigger),
      },
      select: { id: true },
    });
    return run.id as string;
  }

  async startRun(runId: string): Promise<void> {
    await this.db.scrapingRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  /** Persist intermediate counters so the dashboard shows progress while RUNNING. */
  async recordProgress(runId: string, progress: RunProgress): Promise<void> {
    await this.db.scrapingRun.update({
      where: { id: runId },
      data: {
        pagesScraped: progress.pagesScraped,
        totalFound: progress.totalFound,
        duplicates: progress.duplicates,
        errors: progress.errors,
      },
    });
  }

  private async durationOf(runId: string, now: Date): Promise<number> {
    const run = await this.db.scrapingRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });
    return run?.startedAt ? now.getTime() - new Date(run.startedAt).getTime() : 0;
  }

  /** `note` (a [Simulated] page-error summary) is stored as the run's errorMessage. */
  async completeRun(runId: string, portalName: string, totals: RunTotals, note: string | null = null): Promise<void> {
    assertDemoPortal(portalName);
    const now = new Date();
    const duration = await this.durationOf(runId, now);

    await this.db.scrapingRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completedAt: now, duration, ...totals, errorMessage: note },
    });

    // Same health arithmetic as StorageWriter.updateHealthOnSuccess, applied
    // to the demo portal's own row only.
    const health = await this.db.scraperHealth.findUnique({ where: { portalName } });
    if (!health) return;
    const totalRuns = health.totalRuns + 1;
    await this.db.scraperHealth.update({
      where: { portalName },
      data: {
        status: 'HEALTHY',
        lastRunAt: now,
        lastSuccessAt: now,
        totalRuns,
        totalSuccessRuns: health.totalSuccessRuns + 1,
        consecutiveFailures: 0,
        totalTendersFound: health.totalTendersFound + totals.totalFound,
        totalTendersNew: health.totalTendersNew + totals.newTenders,
        avgDurationMs: (health.avgDurationMs * health.totalRuns + duration) / totalRuns,
        errorRate: health.totalFailedRuns / totalRuns,
        lastError: null,
      },
    });
  }

  /**
   * Record a simulated failed run. Health is updated with the same arithmetic
   * and thresholds as StorageWriter.updateHealthOnFailure (DEGRADED, or
   * UNHEALTHY after 5 consecutive failures or an error rate above 50%), on the
   * demo portal's own row only.
   */
  async failRun(runId: string, portalName: string, message: string, progress: RunProgress): Promise<void> {
    assertDemoPortal(portalName);
    const now = new Date();
    const duration = await this.durationOf(runId, now);

    await this.db.scrapingRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: now,
        duration,
        pagesScraped: progress.pagesScraped,
        totalFound: progress.totalFound,
        duplicates: progress.duplicates,
        errors: progress.errors + 1,
        newTenders: 0,
        updatedTenders: 0,
        errorMessage: message,
      },
    });

    const health = await this.db.scraperHealth.findUnique({ where: { portalName } });
    if (!health) return;
    const totalRuns = health.totalRuns + 1;
    const totalFailedRuns = health.totalFailedRuns + 1;
    const consecutiveFailures = health.consecutiveFailures + 1;
    const errorRate = totalFailedRuns / totalRuns;
    await this.db.scraperHealth.update({
      where: { portalName },
      data: {
        status: consecutiveFailures >= 5 || errorRate > 0.5 ? 'UNHEALTHY' : 'DEGRADED',
        lastRunAt: now,
        lastFailureAt: now,
        totalRuns,
        totalFailedRuns,
        consecutiveFailures,
        errorRate,
        lastError: message.substring(0, 500),
      },
    });
  }

  /**
   * End a run that will not complete (shutdown or an internal error). CANCELLED
   * rather than FAILED: nothing about a portal failed, the simulation stopped.
   */
  async cancelRun(runId: string, reason: string): Promise<void> {
    await this.db.scrapingRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', completedAt: new Date(), errorMessage: reason },
    });
  }

  /** Close demo runs left PENDING/RUNNING by a previous demo process. */
  async recoverInterruptedRuns(portalNames: string[]): Promise<number> {
    portalNames.forEach(assertDemoPortal);
    const result = await this.db.scrapingRun.updateMany({
      where: {
        portalName: { in: portalNames },
        triggeredBy: DEMO_TRIGGERED_BY,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: 'Simulated run interrupted: the demo scraper restarted before it finished.',
      },
    });
    return result.count;
  }
}
