/**
 * Scraping Monitor
 *
 * Tracks per-portal scraping statistics in Redis:
 * - Run timestamps (last run, last success, last failure)
 * - Tender counts (found, new, duplicate, failed)
 * - Performance (avg response time, error rate)
 * - Portal status (IDLE, RUNNING, FAILED, DISABLED)
 * - Health checks with alerting
 * - Historical stats with per-run entries
 */

import Redis from 'ioredis';

// ─── Types ──────────────────────────────────────────────────────────────────────

export enum PortalStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FAILED = 'FAILED',
  DISABLED = 'DISABLED',
}

export interface PortalStats {
  portalName: string;
  currentStatus: PortalStatus;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalRuns: number;
  totalTendersFound: number;
  totalTendersNew: number;
  totalTendersDuplicate: number;
  totalTendersFailed: number;
  avgResponseTime: number; // milliseconds
  errorRate: number; // 0-1
  lastError: string | null;
  consecutiveFailures: number;
}

export interface RunStats {
  portalName: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  tendersFound: number;
  tendersNew: number;
  tendersDuplicate: number;
  tendersFailed: number;
  success: boolean;
  error?: string;
}

export interface HealthCheckResult {
  portalName: string;
  isHealthy: boolean;
  status: PortalStatus;
  lastSuccessAt: string | null;
  hoursSinceLastSuccess: number | null;
  expectedIntervalHours: number;
  overdue: boolean;
  consecutiveFailures: number;
  alert: string | null;
}

export interface ScrapingOverview {
  totalPortals: number;
  activePortals: number;
  runningPortals: number;
  failedPortals: number;
  disabledPortals: number;
  totalTendersToday: number;
  totalNewTendersToday: number;
  portals: PortalStats[];
}

// ─── Redis Keys ─────────────────────────────────────────────────────────────────

const REDIS_PREFIX = 'tb:monitor';

function statsKey(portal: string): string {
  return `${REDIS_PREFIX}:stats:${portal}`;
}

function historyKey(portal: string): string {
  return `${REDIS_PREFIX}:history:${portal}`;
}

function statusKey(portal: string): string {
  return `${REDIS_PREFIX}:status:${portal}`;
}

function dailyKey(portal: string, date: string): string {
  return `${REDIS_PREFIX}:daily:${portal}:${date}`;
}

function portalSetKey(): string {
  return `${REDIS_PREFIX}:portals`;
}

// ─── Default Schedule Intervals (hours) ─────────────────────────────────────────

const DEFAULT_INTERVALS: Record<string, number> = {
  gem: 2,
  cppp: 4,
};

/** Default interval for state portals and unknown portals */
const DEFAULT_PORTAL_INTERVAL = 6;

function getExpectedInterval(portalName: string): number {
  return DEFAULT_INTERVALS[portalName] ?? DEFAULT_PORTAL_INTERVAL;
}

// ─── Monitor Class ──────────────────────────────────────────────────────────────

export class ScrapingMonitor {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // ─── Record Operations ────────────────────────────────────────────────────────

  /**
   * Record the start of a scraping run.
   * Sets portal status to RUNNING.
   */
  async recordRunStart(portalName: string): Promise<void> {
    // Register portal
    await this.redis.sadd(portalSetKey(), portalName);

    // Set status to RUNNING
    await this.redis.set(statusKey(portalName), PortalStatus.RUNNING);

    // Update stats
    const key = statsKey(portalName);
    await this.redis.hset(key, {
      lastRunAt: new Date().toISOString(),
      portalName,
    });
  }

  /**
   * Record the completion of a scraping run.
   * Updates stats, status, and appends to history.
   */
  async recordRun(portalName: string, stats: {
    tendersFound: number;
    tendersNew: number;
    tendersDuplicate: number;
    tendersFailed: number;
    duration: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    const now = new Date();
    const key = statsKey(portalName);

    // Register portal
    await this.redis.sadd(portalSetKey(), portalName);

    // Read current stats
    const currentRaw = await this.redis.hgetall(key);
    const totalRuns = parseInt(currentRaw.totalRuns || '0', 10) + 1;
    const totalTendersFound = parseInt(currentRaw.totalTendersFound || '0', 10) + stats.tendersFound;
    const totalTendersNew = parseInt(currentRaw.totalTendersNew || '0', 10) + stats.tendersNew;
    const totalTendersDuplicate = parseInt(currentRaw.totalTendersDuplicate || '0', 10) + stats.tendersDuplicate;
    const totalTendersFailed = parseInt(currentRaw.totalTendersFailed || '0', 10) + stats.tendersFailed;

    // Calculate running average of response time
    const prevAvgResponseTime = parseFloat(currentRaw.avgResponseTime || '0');
    const avgResponseTime =
      totalRuns === 1
        ? stats.duration
        : (prevAvgResponseTime * (totalRuns - 1) + stats.duration) / totalRuns;

    // Calculate error rate (exponential moving average, alpha = 0.3)
    const prevErrorRate = parseFloat(currentRaw.errorRate || '0');
    const alpha = 0.3;
    const errorRate = alpha * (stats.success ? 0 : 1) + (1 - alpha) * prevErrorRate;

    // Consecutive failures
    const consecutiveFailures = stats.success
      ? 0
      : parseInt(currentRaw.consecutiveFailures || '0', 10) + 1;

    // Determine new status
    let newStatus: PortalStatus;
    if (stats.success) {
      newStatus = PortalStatus.IDLE;
    } else if (consecutiveFailures >= 3) {
      newStatus = PortalStatus.FAILED;
    } else {
      newStatus = PortalStatus.IDLE; // Transient failures stay IDLE
    }

    // Update stats hash
    const updates: Record<string, string> = {
      portalName,
      lastRunAt: now.toISOString(),
      totalRuns: totalRuns.toString(),
      totalTendersFound: totalTendersFound.toString(),
      totalTendersNew: totalTendersNew.toString(),
      totalTendersDuplicate: totalTendersDuplicate.toString(),
      totalTendersFailed: totalTendersFailed.toString(),
      avgResponseTime: avgResponseTime.toFixed(2),
      errorRate: errorRate.toFixed(4),
      consecutiveFailures: consecutiveFailures.toString(),
    };

    if (stats.success) {
      updates.lastSuccessAt = now.toISOString();
    } else {
      updates.lastFailureAt = now.toISOString();
      if (stats.error) {
        updates.lastError = stats.error;
      }
    }

    await this.redis.hset(key, updates);
    await this.redis.set(statusKey(portalName), newStatus);

    // Append to history (keep last 100 entries per portal)
    const historyEntry: RunStats = {
      portalName,
      startedAt: new Date(now.getTime() - stats.duration).toISOString(),
      completedAt: now.toISOString(),
      duration: stats.duration,
      tendersFound: stats.tendersFound,
      tendersNew: stats.tendersNew,
      tendersDuplicate: stats.tendersDuplicate,
      tendersFailed: stats.tendersFailed,
      success: stats.success,
      error: stats.error,
    };

    const histKey = historyKey(portalName);
    await this.redis.lpush(histKey, JSON.stringify(historyEntry));
    await this.redis.ltrim(histKey, 0, 99); // Keep last 100

    // Update daily stats
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const dKey = dailyKey(portalName, dateStr);
    await this.redis.hincrby(dKey, 'tendersFound', stats.tendersFound);
    await this.redis.hincrby(dKey, 'tendersNew', stats.tendersNew);
    await this.redis.hincrby(dKey, 'runs', 1);
    await this.redis.expire(dKey, 90 * 24 * 60 * 60); // 90-day TTL
  }

  /**
   * Set a portal's status manually (e.g., to DISABLED).
   */
  async setPortalStatus(portalName: string, status: PortalStatus): Promise<void> {
    await this.redis.set(statusKey(portalName), status);
    await this.redis.sadd(portalSetKey(), portalName);
  }

  // ─── Query Operations ─────────────────────────────────────────────────────────

  /**
   * Get current status and stats for a single portal.
   */
  async getPortalStatus(portalName: string): Promise<PortalStats> {
    const [rawStats, status] = await Promise.all([
      this.redis.hgetall(statsKey(portalName)),
      this.redis.get(statusKey(portalName)),
    ]);

    return {
      portalName,
      currentStatus: (status as PortalStatus) || PortalStatus.IDLE,
      lastRunAt: rawStats.lastRunAt || null,
      lastSuccessAt: rawStats.lastSuccessAt || null,
      lastFailureAt: rawStats.lastFailureAt || null,
      totalRuns: parseInt(rawStats.totalRuns || '0', 10),
      totalTendersFound: parseInt(rawStats.totalTendersFound || '0', 10),
      totalTendersNew: parseInt(rawStats.totalTendersNew || '0', 10),
      totalTendersDuplicate: parseInt(rawStats.totalTendersDuplicate || '0', 10),
      totalTendersFailed: parseInt(rawStats.totalTendersFailed || '0', 10),
      avgResponseTime: parseFloat(rawStats.avgResponseTime || '0'),
      errorRate: parseFloat(rawStats.errorRate || '0'),
      lastError: rawStats.lastError || null,
      consecutiveFailures: parseInt(rawStats.consecutiveFailures || '0', 10),
    };
  }

  /**
   * Get status for all registered portals.
   */
  async getAllPortalStatuses(): Promise<PortalStats[]> {
    const portalNames = await this.redis.smembers(portalSetKey());

    if (portalNames.length === 0) return [];

    const statuses = await Promise.all(
      portalNames.map((name) => this.getPortalStatus(name)),
    );

    // Sort: RUNNING first, then FAILED, then IDLE, then DISABLED
    const statusOrder: Record<string, number> = {
      [PortalStatus.RUNNING]: 0,
      [PortalStatus.FAILED]: 1,
      [PortalStatus.IDLE]: 2,
      [PortalStatus.DISABLED]: 3,
    };

    return statuses.sort(
      (a, b) => (statusOrder[a.currentStatus] ?? 4) - (statusOrder[b.currentStatus] ?? 4),
    );
  }

  /**
   * Get scraping history for a portal.
   *
   * @param portalName Portal name
   * @param days Number of days to look back (default: 7)
   */
  async getScrapingHistory(portalName: string, days: number = 7): Promise<RunStats[]> {
    const histKey = historyKey(portalName);
    const entries = await this.redis.lrange(histKey, 0, -1);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history: RunStats[] = [];

    for (const entry of entries) {
      try {
        const run = JSON.parse(entry) as RunStats;
        const completedAt = new Date(run.completedAt);

        if (completedAt >= cutoffDate) {
          history.push(run);
        }
      } catch {
        // Skip malformed entries
      }
    }

    return history;
  }

  /**
   * Get a high-level overview of all scraping activity.
   */
  async getOverview(): Promise<ScrapingOverview> {
    const portals = await this.getAllPortalStatuses();

    const today = new Date().toISOString().split('T')[0];
    let totalTendersToday = 0;
    let totalNewTendersToday = 0;

    for (const portal of portals) {
      const dKey = dailyKey(portal.portalName, today);
      const dailyStats = await this.redis.hgetall(dKey);
      totalTendersToday += parseInt(dailyStats.tendersFound || '0', 10);
      totalNewTendersToday += parseInt(dailyStats.tendersNew || '0', 10);
    }

    return {
      totalPortals: portals.length,
      activePortals: portals.filter((p) => p.currentStatus !== PortalStatus.DISABLED).length,
      runningPortals: portals.filter((p) => p.currentStatus === PortalStatus.RUNNING).length,
      failedPortals: portals.filter((p) => p.currentStatus === PortalStatus.FAILED).length,
      disabledPortals: portals.filter((p) => p.currentStatus === PortalStatus.DISABLED).length,
      totalTendersToday,
      totalNewTendersToday,
      portals,
    };
  }

  // ─── Health Checks ────────────────────────────────────────────────────────────

  /**
   * Perform a health check on a single portal.
   *
   * A portal is unhealthy if:
   * - It hasn't been scraped in 2x its schedule interval
   * - It has 3+ consecutive failures
   * - Its error rate is above 50%
   */
  async checkPortalHealth(portalName: string): Promise<HealthCheckResult> {
    const stats = await this.getPortalStatus(portalName);
    const expectedIntervalHours = getExpectedInterval(portalName);

    let hoursSinceLastSuccess: number | null = null;
    if (stats.lastSuccessAt) {
      const lastSuccess = new Date(stats.lastSuccessAt);
      hoursSinceLastSuccess =
        (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);
    }

    // Check if portal is overdue (2x expected interval)
    const overdueThreshold = expectedIntervalHours * 2;
    const overdue =
      stats.currentStatus !== PortalStatus.DISABLED &&
      (hoursSinceLastSuccess === null ||
        hoursSinceLastSuccess > overdueThreshold) &&
      stats.totalRuns > 0;

    // Determine health
    const isHealthy =
      stats.currentStatus !== PortalStatus.FAILED &&
      stats.currentStatus !== PortalStatus.DISABLED &&
      !overdue &&
      stats.consecutiveFailures < 3 &&
      stats.errorRate < 0.5;

    // Build alert message
    let alert: string | null = null;
    if (!isHealthy) {
      const reasons: string[] = [];

      if (stats.currentStatus === PortalStatus.FAILED) {
        reasons.push(`Status is FAILED`);
      }
      if (overdue) {
        reasons.push(
          `Overdue: last success ${hoursSinceLastSuccess !== null ? hoursSinceLastSuccess.toFixed(1) : 'never'}h ago (expected every ${expectedIntervalHours}h)`,
        );
      }
      if (stats.consecutiveFailures >= 3) {
        reasons.push(`${stats.consecutiveFailures} consecutive failures`);
      }
      if (stats.errorRate >= 0.5) {
        reasons.push(`Error rate: ${(stats.errorRate * 100).toFixed(1)}%`);
      }
      if (stats.lastError) {
        reasons.push(`Last error: ${stats.lastError}`);
      }

      alert = `[ALERT] ${portalName}: ${reasons.join('; ')}`;
    }

    return {
      portalName,
      isHealthy,
      status: stats.currentStatus,
      lastSuccessAt: stats.lastSuccessAt,
      hoursSinceLastSuccess,
      expectedIntervalHours,
      overdue,
      consecutiveFailures: stats.consecutiveFailures,
      alert,
    };
  }

  /**
   * Perform health checks on all portals.
   * Returns only unhealthy portals' alerts.
   */
  async checkAllPortalHealth(): Promise<HealthCheckResult[]> {
    const portalNames = await this.redis.smembers(portalSetKey());
    const results = await Promise.all(
      portalNames.map((name) => this.checkPortalHealth(name)),
    );

    return results;
  }

  /**
   * Get alerts for unhealthy portals.
   */
  async getAlerts(): Promise<string[]> {
    const checks = await this.checkAllPortalHealth();
    return checks
      .filter((c) => !c.isHealthy && c.alert)
      .map((c) => c.alert!);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  /**
   * Reset stats for a portal (for testing or after fixing issues).
   */
  async resetPortalStats(portalName: string): Promise<void> {
    await Promise.all([
      this.redis.del(statsKey(portalName)),
      this.redis.del(historyKey(portalName)),
      this.redis.set(statusKey(portalName), PortalStatus.IDLE),
    ]);
  }

  /**
   * Remove a portal entirely from monitoring.
   */
  async removePortal(portalName: string): Promise<void> {
    await Promise.all([
      this.redis.del(statsKey(portalName)),
      this.redis.del(historyKey(portalName)),
      this.redis.del(statusKey(portalName)),
      this.redis.srem(portalSetKey(), portalName),
    ]);
  }
}
