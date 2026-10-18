/**
 * Storage Writer
 *
 * Handles all database write operations for scraped tenders.
 * Separated from BaseScraper for modularity and testability.
 *
 * Features:
 * - Prisma upsert with composite unique (sourceId, sourcePortal)
 * - Batch upsert support for bulk operations
 * - Document attachment handling
 * - Scraping run tracking (ScrapingRun model)
 * - Portal health updates (ScraperHealth model)
 */

import { PrismaClient } from '@prisma/client';
import type { ScrapedTender } from '../scrapers/base-scraper';
import { createLogger, Logger } from '../utils/logger';
import { scraperEvents } from '../utils/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteResult {
  isNew: boolean;
  tenderId: string;
  sourceId: string;
  sourcePortal: string;
}

export interface BatchWriteResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  results: WriteResult[];
  failures: Array<{ sourceId: string; error: string }>;
}

export interface RunRecord {
  id: string;
  portalName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

// ---------------------------------------------------------------------------
// Storage Writer
// ---------------------------------------------------------------------------

export class StorageWriter {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
    this.logger = createLogger('StorageWriter');
  }

  // -----------------------------------------------------------------------
  // Tender write operations
  // -----------------------------------------------------------------------

  /**
   * Upsert a single tender into the database.
   */
  async writeTender(data: ScrapedTender): Promise<WriteResult> {
    try {
      const existing = await this.prisma.tender.findUnique({
        where: {
          sourceId_sourcePortal: {
            sourceId: data.sourceId,
            sourcePortal: data.sourcePortal,
          },
        },
        select: { id: true },
      });

      const tenderData = this.mapTenderData(data);

      const result = await this.prisma.tender.upsert({
        where: {
          sourceId_sourcePortal: {
            sourceId: data.sourceId,
            sourcePortal: data.sourcePortal,
          },
        },
        create: tenderData,
        update: tenderData,
      });

      // Handle documents
      if (data.documents && data.documents.length > 0) {
        await this.writeDocuments(result.id, data.documents);
      }

      const isNew = !existing;

      // Emit event
      const eventData = {
        portalName: data.sourcePortal,
        tenderId: result.id,
        sourceId: data.sourceId,
        title: data.title,
        referenceNumber: data.referenceNumber,
        estimatedValue: data.estimatedValue,
        state: data.state,
        category: data.category,
        timestamp: new Date(),
      };

      if (isNew) {
        scraperEvents.emit('tender:new', eventData);
      } else {
        scraperEvents.emit('tender:updated', eventData);
      }

      return { isNew, tenderId: result.id, sourceId: data.sourceId, sourcePortal: data.sourcePortal };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to write tender ${data.sourceId}`, {
        sourcePortal: data.sourcePortal,
        error: error.message,
      });

      scraperEvents.emit('tender:error', {
        portalName: data.sourcePortal,
        sourceId: data.sourceId,
        error,
        stage: 'save',
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Batch upsert multiple tenders. Each is processed independently
   * so one failure doesn't block others.
   */
  async writeBatch(tenders: ScrapedTender[]): Promise<BatchWriteResult> {
    const results: WriteResult[] = [];
    const failures: Array<{ sourceId: string; error: string }> = [];
    let created = 0;
    let updated = 0;

    for (const tender of tenders) {
      try {
        const result = await this.writeTender(tender);
        results.push(result);
        if (result.isNew) created++;
        else updated++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        failures.push({ sourceId: tender.sourceId, error: errMsg });
      }
    }

    return {
      total: tenders.length,
      created,
      updated,
      errors: failures.length,
      results,
      failures,
    };
  }

  // -----------------------------------------------------------------------
  // Scraping Run tracking
  // -----------------------------------------------------------------------

  /**
   * Create a new scraping run record.
   */
  async createRun(portalName: string, triggeredBy: string, maxPages?: number): Promise<RunRecord> {
    const run = await this.prisma.scrapingRun.create({
      data: {
        portalName,
        status: 'PENDING',
        triggeredBy,
        maxPages: maxPages ?? null,
      },
    });

    return { id: run.id, portalName: run.portalName, status: 'PENDING' };
  }

  /**
   * Mark a run as started.
   */
  async startRun(runId: string): Promise<void> {
    await this.prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  /**
   * Mark a run as completed with stats.
   */
  async completeRun(
    runId: string,
    stats: {
      totalFound: number;
      newTenders: number;
      updatedTenders: number;
      duplicates: number;
      errors: number;
      pagesScraped: number;
    },
  ): Promise<void> {
    const now = new Date();
    const run = await this.prisma.scrapingRun.findUnique({
      where: { id: runId },
      select: { startedAt: true, portalName: true },
    });

    const duration = run?.startedAt ? now.getTime() - run.startedAt.getTime() : 0;

    await this.prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        duration,
        ...stats,
      },
    });

    // Update portal health
    if (run) {
      await this.updateHealthOnSuccess(run.portalName, duration, stats.totalFound, stats.newTenders);
    }
  }

  /**
   * Mark a run as failed.
   */
  async failRun(runId: string, error: Error): Promise<void> {
    const now = new Date();
    const run = await this.prisma.scrapingRun.findUnique({
      where: { id: runId },
      select: { startedAt: true, portalName: true },
    });

    const duration = run?.startedAt ? now.getTime() - run.startedAt.getTime() : 0;

    await this.prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: now,
        duration,
        errorMessage: error.message,
        errorStack: error.stack?.substring(0, 2000),
      },
    });

    // Update portal health
    if (run) {
      await this.updateHealthOnFailure(run.portalName, error.message);
    }
  }

  // -----------------------------------------------------------------------
  // Portal Health
  // -----------------------------------------------------------------------

  /**
   * Ensure a ScraperHealth record exists for a portal.
   */
  async ensureHealthRecord(portalName: string, cronExpression?: string): Promise<void> {
    await this.prisma.scraperHealth.upsert({
      where: { portalName },
      create: {
        portalName,
        cronExpression: cronExpression ?? null,
        status: 'HEALTHY',
      },
      // Deliberately empty: the registry value seeds the row when it is first
      // created and must NOT be written again.
      //
      // This used to set `cronExpression` on every boot, and main() calls it
      // for all 13 portals at startup — so an administrator's edited cadence
      // was silently reverted to the registry default by the next container
      // restart. ScraperHealth is the authoritative schedule source, so
      // clobbering it here undid the operator's change everywhere.
      update: {},
    });
  }

  /**
   * Get health status for all portals.
   */
  async getAllHealth(): Promise<Array<{
    portalName: string;
    status: string;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    consecutiveFailures: number;
    errorRate: number;
    totalRuns: number;
    enabled: boolean;
  }>> {
    return this.prisma.scraperHealth.findMany({
      select: {
        portalName: true,
        status: true,
        lastRunAt: true,
        lastSuccessAt: true,
        consecutiveFailures: true,
        errorRate: true,
        totalRuns: true,
        enabled: true,
      },
      orderBy: { portalName: 'asc' },
    });
  }

  /**
   * Get recent runs for a portal.
   */
  async getRecentRuns(portalName?: string, limit = 20): Promise<unknown[]> {
    return this.prisma.scrapingRun.findMany({
      where: portalName ? { portalName } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Operator scheduling overrides, read from PostgreSQL.
   *
   * ScraperHealth is where the admin dashboard writes `enabled` and
   * `cronExpression`, but the scheduler used to read both exclusively from the
   * Redis key tb:scheduler:schedules, so disabling a portal or editing its cron
   * in the admin UI reported success and changed nothing: the old cadence kept
   * firing. PostgreSQL is now authoritative for operator intent and Redis is
   * only a cache of the resolved set.
   *
   * Keyed by ScraperHealth.portalName (the human-readable name); the scheduler
   * maps those onto registry keys.
   */
  async getScheduleOverrides(): Promise<
    Array<{ portalName: string; enabled: boolean; cronExpression: string | null }>
  > {
    return this.prisma.scraperHealth.findMany({
      select: { portalName: true, enabled: true, cronExpression: true },
    });
  }

  /**
   * Whether an administrator has paused automatic scheduling.
   *
   * Stored in AdminSetting so the decision survives a container restart —
   * POST /api/scheduler/stop previously only flipped an in-memory boolean, so
   * scheduling silently resumed on the next deploy or restart.
   */
  async getSchedulerPaused(): Promise<boolean> {
    const row = await this.prisma.adminSetting.findUnique({
      where: { category_key: { category: 'scraper', key: 'schedulerPaused' } },
      select: { value: true },
    });
    return row?.value === true;
  }

  /** Persist the administrator's pause/resume decision. */
  async setSchedulerPaused(paused: boolean, updatedBy?: string): Promise<void> {
    await this.prisma.adminSetting.upsert({
      where: { category_key: { category: 'scraper', key: 'schedulerPaused' } },
      create: {
        category: 'scraper',
        key: 'schedulerPaused',
        value: paused,
        description: 'When true, the scraper engine registers no cron schedules.',
        updatedBy,
      },
      update: { value: paused, updatedBy },
    });
  }

  /**
   * Fail ScrapingRun rows still marked RUNNING from a previous process.
   *
   * A container that is killed mid-scrape leaves its run row RUNNING forever.
   * The only cleanup used to live inside the admin dashboard's LIST handler, so
   * it ran only if a human happened to open that page — and it mutated data on
   * a GET. This runs at startup instead, and is also safe to call periodically.
   *
   * Returns the number of rows recovered.
   */
  async recoverStaleRuns(olderThanMinutes = 15): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const result = await this.prisma.scrapingRun.updateMany({
      where: {
        status: 'RUNNING',
        OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, createdAt: { lt: cutoff } }],
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Run interrupted: the scraper process stopped before completion',
        completedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Toggle portal enabled/disabled.
   */
  async togglePortal(portalName: string, enabled: boolean): Promise<void> {
    await this.prisma.scraperHealth.update({
      where: { portalName },
      data: {
        enabled,
        status: enabled ? 'HEALTHY' : 'DISABLED',
      },
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private mapTenderData(data: ScrapedTender) {
    return {
      title: data.title,
      description: data.description ?? null,
      referenceNumber: data.referenceNumber,
      organization: data.organization,
      department: data.department ?? null,
      tenderType: (data.tenderType ?? 'OPEN') as any,
      category: (data.category ?? 'WORKS') as any,
      status: (data.status ?? 'ACTIVE') as any,
      state: data.state,
      district: data.district ?? null,
      city: data.city ?? null,
      estimatedValue: data.estimatedValue ?? null,
      emdAmount: data.emdAmount ?? null,
      publishedDate: data.publishedDate,
      bidSubmissionDeadline: data.bidSubmissionDeadline,
      bidOpeningDate: data.bidOpeningDate ?? null,
      preBidMeetingDate: data.preBidMeetingDate ?? null,
      sourcePortal: data.sourcePortal,
      sourceUrl: data.sourceUrl,
      sourceId: data.sourceId,
      aiKeywords: data.aiKeywords ?? [],
      reservedForMSME: data.reservedForMSME ?? false,
      reservedForStartups: data.reservedForStartups ?? false,
      emdExemptMSME: data.emdExemptMSME ?? false,
    };
  }

  private async writeDocuments(
    tenderId: string,
    documents: NonNullable<ScrapedTender['documents']>,
  ): Promise<void> {
    for (const doc of documents) {
      try {
        // Try to find existing document by tender + url
        const existing = await this.prisma.tenderDocument.findFirst({
          where: {
            tenderId,
            fileUrl: doc.fileUrl,
          },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.tenderDocument.update({
            where: { id: existing.id },
            data: {
              name: doc.name,
              fileType: doc.fileType ?? null,
              fileSize: doc.fileSize ?? null,
            },
          });
        } else {
          await this.prisma.tenderDocument.create({
            data: {
              tenderId,
              name: doc.name,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType ?? null,
              fileSize: doc.fileSize ?? null,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to write document for tender ${tenderId}`, {
          docName: doc.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async updateHealthOnSuccess(
    portalName: string,
    duration: number,
    tendersFound: number,
    tendersNew: number,
  ): Promise<void> {
    try {
      const health = await this.prisma.scraperHealth.findUnique({
        where: { portalName },
      });

      if (!health) {
        await this.ensureHealthRecord(portalName);
        return;
      }

      const totalRuns = health.totalRuns + 1;
      const totalSuccessRuns = health.totalSuccessRuns + 1;
      const avgDurationMs = ((health.avgDurationMs * health.totalRuns) + duration) / totalRuns;
      const errorRate = health.totalFailedRuns / totalRuns;

      await this.prisma.scraperHealth.update({
        where: { portalName },
        data: {
          status: 'HEALTHY',
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          totalRuns,
          totalSuccessRuns,
          consecutiveFailures: 0,
          totalTendersFound: health.totalTendersFound + tendersFound,
          totalTendersNew: health.totalTendersNew + tendersNew,
          avgDurationMs,
          errorRate,
          lastError: null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to update health for ${portalName}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async updateHealthOnFailure(portalName: string, errorMessage: string): Promise<void> {
    try {
      const health = await this.prisma.scraperHealth.findUnique({
        where: { portalName },
      });

      if (!health) {
        await this.ensureHealthRecord(portalName);
        return;
      }

      const totalRuns = health.totalRuns + 1;
      const totalFailedRuns = health.totalFailedRuns + 1;
      const consecutiveFailures = health.consecutiveFailures + 1;
      const errorRate = totalFailedRuns / totalRuns;

      // Determine health status
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DISABLED' = 'DEGRADED';
      if (consecutiveFailures >= 5 || errorRate > 0.5) {
        status = 'UNHEALTHY';
      }

      await this.prisma.scraperHealth.update({
        where: { portalName },
        data: {
          status,
          lastRunAt: new Date(),
          lastFailureAt: new Date(),
          totalRuns,
          totalFailedRuns,
          consecutiveFailures,
          errorRate,
          lastError: errorMessage.substring(0, 500),
        },
      });

      // Emit health events
      if (status === 'UNHEALTHY' && health.status !== 'UNHEALTHY') {
        scraperEvents.emit('health:unhealthy', {
          portalName,
          previousStatus: health.status,
          newStatus: status,
          consecutiveFailures,
          errorRate,
          lastError: errorMessage,
          timestamp: new Date(),
        });
      } else if (status === 'DEGRADED' && health.status === 'HEALTHY') {
        scraperEvents.emit('health:degraded', {
          portalName,
          previousStatus: health.status,
          newStatus: status,
          consecutiveFailures,
          errorRate,
          lastError: errorMessage,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to update health for ${portalName}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Disconnect Prisma.
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
