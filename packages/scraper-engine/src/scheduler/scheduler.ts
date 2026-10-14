/**
 * Scraping Scheduler
 *
 * Orchestrates scraping jobs using node-cron for scheduling
 * and BullMQ for job queuing with Redis-backed state.
 *
 * Schedules are NOT defined here — they are derived from PORTAL_CONFIGS in
 * ../config, which is the canonical portal registry (see buildDefaultSchedules).
 * As configured there today that gives:
 * - GeM: every 2 hours (high volume)
 * - CPPP / eProcure: every 4 hours
 * - State portals: every 6 hours, staggered by 10-minute offsets
 * - Full re-scrape: daily at 2 AM IST (20:30 UTC previous day)
 *
 * All cron expressions are evaluated in UTC (see CRON_TIMEZONE).
 *
 * BullMQ configuration:
 * - Queue: 'scraper-jobs'
 * - Concurrency: 3
 * - Retry: 3 attempts with exponential backoff
 */

import cron from 'node-cron';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

import { PORTAL_CONFIGS, getPortalConfig, type PortalConfig } from '../config';

// ─── Types ──────────────────────────────────────────────────────────────────────

export enum JobType {
  SCRAPE_PORTAL = 'SCRAPE_PORTAL',
  FULL_SCRAPE = 'FULL_SCRAPE',
  RESCRAPE_FAILED = 'RESCRAPE_FAILED',
}

export interface PortalScheduleConfig {
  portalName: string;
  /** Cron expression (in UTC) */
  cronExpression: string;
  /** Whether this portal is enabled */
  enabled: boolean;
  /** Priority (1 = highest) */
  priority: number;
  /** Portal type for grouping */
  portalType: 'gem' | 'cppp' | 'state' | 'other';
  /** Maximum pages to scrape per run */
  maxPages?: number;
}

export interface ScraperJobData {
  jobType: JobType;
  portalName: string;
  triggeredBy: 'schedule' | 'manual' | 'retry';
  maxPages?: number;
  startedAt?: string;
  retryCount?: number;
  /**
   * Re-fetch and re-save tenders that are already known, instead of the default
   * new-only behaviour. Set by the daily full re-scrape so legitimate updates
   * (deadline extensions, corrigenda, status changes) are still picked up.
   */
  fullRescrape?: boolean;
}

export interface ScraperJobResult {
  portalName: string;
  tendersFound: number;
  tendersNew: number;
  tendersDuplicate: number;
  tendersFailed: number;
  duration: number;
  errors: string[];
}

type PortalScrapeHandler = (
  portalName: string,
  maxPages?: number,
  fullRescrape?: boolean,
  triggeredBy?: 'schedule' | 'manual' | 'retry',
) => Promise<ScraperJobResult>;

// ─── Default Schedules ──────────────────────────────────────────────────────────

/**
 * Portal schedules are derived from PORTAL_CONFIGS (packages/scraper-engine/src/config),
 * which is the canonical configuration for the engine. There is deliberately no second
 * hardcoded schedule table: an earlier one drifted out of sync and used portal names
 * ('maharashtra-eprocurement', 'up-etender', …) that do not exist as scraper registry
 * keys, so 8 of its 10 cron firings resolved to "Unknown portal" at run time.
 *
 * `portalName` here is therefore always a registry key (PortalConfig.key), which is what
 * getPortalConfig() and getAllScraperClasses() are indexed by.
 *
 * Cadences and the staggered state-portal offsets come straight from PORTAL_CONFIGS:
 *   GeM           every 2 hours      '0 *​/2 * * *'
 *   CPPP          every 4 hours      '0 *​/4 * * *'
 *   eProcure      every 4 hours :30  '30 *​/4 * * *'
 *   state portals every 6 hours, staggered '0 *​/6', '10 *​/6', '20 *​/6', …
 * Full re-scrape: daily at 2 AM IST = 20:30 UTC prev day → '30 20 * * *'
 */
function portalTypeFor(portal: PortalConfig): PortalScheduleConfig['portalType'] {
  if (portal.key === 'gem') return 'gem';
  if (portal.key === 'cppp') return 'cppp';
  return portal.type === 'state' ? 'state' : 'other';
}

function scheduleFromPortal(portal: PortalConfig): PortalScheduleConfig {
  return {
    portalName: portal.key,
    cronExpression: portal.cronExpression,
    enabled: portal.enabled,
    priority: portal.priority,
    portalType: portalTypeFor(portal),
    maxPages: portal.maxPages,
  };
}

/** Build the canonical schedule set from the portal registry. */
export function buildDefaultSchedules(): PortalScheduleConfig[] {
  return PORTAL_CONFIGS.map(scheduleFromPortal);
}

// ─── Redis Keys ─────────────────────────────────────────────────────────────────

/**
 * All cron expressions in this file are UTC, as documented on
 * PortalScheduleConfig.cronExpression and in PORTAL_CONFIGS.
 *
 * node-cron evaluates expressions in the *system* timezone unless told otherwise,
 * so every cron.schedule() call below passes this explicitly. Without it the
 * schedules silently shift by the host's UTC offset — on an IST machine
 * (Asia/Kolkata, +05:30) '20 *​/6 * * *' fired at 06:50 UTC instead of 06:20,
 * and the "2 AM IST" full re-scrape would have run at 20:30 IST.
 */
const CRON_TIMEZONE = 'UTC';

const REDIS_PREFIX = 'tb:scheduler';
const SCHEDULES_KEY = `${REDIS_PREFIX}:schedules`;
const LOCK_PREFIX = `${REDIS_PREFIX}:lock`;

// ─── Scheduler Class ────────────────────────────────────────────────────────────

export class ScrapingScheduler {
  private redis: Redis;
  private queue: Queue<ScraperJobData, ScraperJobResult>;
  private worker: Worker<ScraperJobData, ScraperJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private scrapeHandler: PortalScrapeHandler | null = null;
  private running = false;
  private concurrency: number;
  private readonly queueName: string;

  constructor(
    redis: Redis,
    options?: {
      concurrency?: number;
      queueName?: string;
    },
  ) {
    this.redis = redis;
    this.concurrency = options?.concurrency ?? 3;
    this.queueName = options?.queueName ?? 'scraper-jobs';
    this.queue = this.createQueue();
  }

  /**
   * Whether the scheduler is currently running.
   *
   * Exposed as a public getter so the admin API's `SchedulerLike` contract
   * (and therefore GET /api/health's `schedulerRunning`) can read it.
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * BullMQ requires `maxRetriesPerRequest: null` on any connection it uses for
   * blocking commands (Worker, QueueEvents) and refuses to start otherwise. The
   * Redis instance handed to this scheduler is the engine's general-purpose one
   * (created with maxRetriesPerRequest: 3), and ioredis `duplicate()` inherits
   * that, so every duplicate made here overrides it explicitly.
   */
  private bullConnection(): Redis {
    return this.redis.duplicate({ maxRetriesPerRequest: null });
  }

  /**
   * Build the BullMQ queue. Called from the constructor and again by start()
   * after a stop(), because stop() closes the queue and a closed Queue cannot
   * be reused — without this, stop() followed by start() (e.g. via the
   * POST /api/scheduler/stop then /start endpoints) operated on a dead queue.
   */
  private createQueue(): Queue<ScraperJobData, ScraperJobResult> {
    return new Queue<ScraperJobData, ScraperJobResult>(this.queueName, {
      connection: this.bullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute initial, then 2 min, 4 min
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
        },
      },
    });
  }

  /**
   * Register the handler function that actually performs portal scraping.
   * This decouples scheduling from scraping implementation.
   */
  registerScrapeHandler(handler: PortalScrapeHandler): void {
    this.scrapeHandler = handler;
  }

  /**
   * Initialize the scheduler:
   * 1. Load schedule configs from Redis (or use defaults)
   * 2. Set up cron jobs
   * 3. Start the BullMQ worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting...');

    // A previous stop() closed the queue; rebuild it before re-use.
    if (this.queue.closing) {
      this.queue = this.createQueue();
    }

    // Load or initialize schedules
    const schedules = await this.loadSchedules();

    // Set up cron jobs for each enabled portal
    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.setupCronJob(schedule);
      }
    }

    // Set up the full re-scrape daily job (2 AM IST = 20:30 UTC)
    this.setupFullRescrapeCron();

    // Set up retry failed jobs cron (every hour)
    this.setupRetryFailedCron();

    // Start BullMQ worker
    this.startWorker();

    // Start queue events listener
    this.startQueueEvents();

    this.running = true;
    console.log(`[Scheduler] Started with ${schedules.filter((s) => s.enabled).length} active portals`);
  }

  /**
   * Graceful shutdown.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('[Scheduler] Shutting down...');

    // Stop all cron jobs
    for (const [name, task] of this.cronJobs) {
      task.stop();
      console.log(`[Scheduler] Stopped cron for ${name}`);
    }
    this.cronJobs.clear();

    // Close worker (wait for current jobs to complete, 30s timeout)
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    // Close queue events
    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }

    // Close queue
    await this.queue.close();

    this.running = false;
    console.log('[Scheduler] Shutdown complete');
  }

  // ─── Schedule Management ──────────────────────────────────────────────────────

  /**
   * Load schedules from Redis, falling back to defaults.
   */
  private async loadSchedules(): Promise<PortalScheduleConfig[]> {
    const defaults = buildDefaultSchedules();

    const raw = await this.redis.get(SCHEDULES_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw) as PortalScheduleConfig[];
        if (Array.isArray(stored)) {
          return this.reconcileSchedules(stored, defaults);
        }
        console.error('[Scheduler] Stored schedules are not an array, rebuilding from PORTAL_CONFIGS');
      } catch {
        console.error('[Scheduler] Failed to parse schedules from Redis, rebuilding from PORTAL_CONFIGS');
      }
    }

    await this.saveSchedules(defaults);
    return defaults;
  }

  /**
   * Reconcile schedules persisted in Redis against the portal registry.
   *
   * Entries whose portalName is not a known registry key are dropped — they can
   * never be scraped (getPortalConfig / getAllScraperClasses are keyed by
   * PortalConfig.key), so keeping them would just reproduce the "Unknown portal"
   * failures. Registry portals missing from the stored set are added from the
   * defaults. Operator intent that is still meaningful (enabled, cronExpression,
   * maxPages) is preserved for entries that remain valid.
   *
   * Only the scheduler's own SCHEDULES_KEY is rewritten; no other Redis data is
   * touched and nothing is deleted outright.
   */
  private reconcileSchedules(
    stored: PortalScheduleConfig[],
    defaults: PortalScheduleConfig[],
  ): PortalScheduleConfig[] {
    const storedByName = new Map<string, PortalScheduleConfig>();
    const dropped: string[] = [];

    for (const entry of stored) {
      if (!entry || typeof entry.portalName !== 'string') continue;
      if (!getPortalConfig(entry.portalName)) {
        dropped.push(entry.portalName);
        continue;
      }
      storedByName.set(entry.portalName, entry);
    }

    const reconciled = defaults.map((def) => {
      const prev = storedByName.get(def.portalName);
      if (!prev) return def;

      // Keep operator overrides where they are still usable, otherwise fall back
      // to the canonical registry value.
      const cronExpression =
        typeof prev.cronExpression === 'string' && cron.validate(prev.cronExpression)
          ? prev.cronExpression
          : def.cronExpression;

      return {
        ...def,
        cronExpression,
        enabled: typeof prev.enabled === 'boolean' ? prev.enabled : def.enabled,
        maxPages: typeof prev.maxPages === 'number' ? prev.maxPages : def.maxPages,
      };
    });

    const added = reconciled
      .filter((r) => !storedByName.has(r.portalName))
      .map((r) => r.portalName);

    if (dropped.length > 0 || added.length > 0) {
      console.log(
        `[Scheduler] Reconciled schedules against PORTAL_CONFIGS — ` +
        `dropped ${dropped.length} unknown portal(s)${dropped.length ? ` [${dropped.join(', ')}]` : ''}, ` +
        `added ${added.length}${added.length ? ` [${added.join(', ')}]` : ''}`,
      );
      // Persist the repaired set so the stale names do not linger.
      void this.saveSchedules(reconciled).catch((err) =>
        console.error('[Scheduler] Failed to persist reconciled schedules:', err),
      );
    }

    return reconciled;
  }

  /**
   * Persist schedules to Redis.
   */
  private async saveSchedules(schedules: PortalScheduleConfig[]): Promise<void> {
    await this.redis.set(SCHEDULES_KEY, JSON.stringify(schedules));
  }

  /**
   * Get all current schedules.
   */
  async getSchedules(): Promise<PortalScheduleConfig[]> {
    return this.loadSchedules();
  }

  /**
   * Update a portal's schedule configuration.
   */
  async updateSchedule(
    portalName: string,
    updates: Partial<Omit<PortalScheduleConfig, 'portalName'>>,
  ): Promise<PortalScheduleConfig> {
    const schedules = await this.loadSchedules();
    const index = schedules.findIndex((s) => s.portalName === portalName);

    if (index === -1) {
      throw new Error(`Portal '${portalName}' not found in schedules`);
    }

    schedules[index] = { ...schedules[index], ...updates };
    await this.saveSchedules(schedules);

    // Restart the cron job if it exists
    const existingCron = this.cronJobs.get(portalName);
    if (existingCron) {
      existingCron.stop();
      this.cronJobs.delete(portalName);
    }

    if (schedules[index].enabled) {
      this.setupCronJob(schedules[index]);
    }

    return schedules[index];
  }

  /**
   * Add a new portal schedule.
   */
  async addSchedule(config: PortalScheduleConfig): Promise<void> {
    // portalName must be a registry key or the job can never resolve a scraper.
    if (!getPortalConfig(config.portalName)) {
      throw new Error(
        `Portal '${config.portalName}' is not a known registry key. ` +
        `Valid keys: ${PORTAL_CONFIGS.map((p) => p.key).join(', ')}`,
      );
    }

    const schedules = await this.loadSchedules();

    // Check for duplicate
    if (schedules.some((s) => s.portalName === config.portalName)) {
      throw new Error(`Portal '${config.portalName}' already exists in schedules`);
    }

    schedules.push(config);
    await this.saveSchedules(schedules);

    if (config.enabled) {
      this.setupCronJob(config);
    }
  }

  /**
   * Remove a portal schedule.
   */
  async removeSchedule(portalName: string): Promise<void> {
    const schedules = await this.loadSchedules();
    const filtered = schedules.filter((s) => s.portalName !== portalName);

    if (filtered.length === schedules.length) {
      throw new Error(`Portal '${portalName}' not found in schedules`);
    }

    await this.saveSchedules(filtered);

    const existingCron = this.cronJobs.get(portalName);
    if (existingCron) {
      existingCron.stop();
      this.cronJobs.delete(portalName);
    }
  }

  // ─── Job Submission ───────────────────────────────────────────────────────────

  /**
   * Enqueue a scraping job for a specific portal.
   */
  async enqueueScrapeJob(
    portalName: string,
    triggeredBy: 'schedule' | 'manual' | 'retry' = 'manual',
    maxPages?: number,
    fullRescrape = false,
  ): Promise<Job<ScraperJobData, ScraperJobResult>> {
    // Acquire a lock to prevent double-queueing
    const lockKey = `${LOCK_PREFIX}:${portalName}`;
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX'); // 5 min lock

    if (!lockAcquired && triggeredBy === 'schedule') {
      console.log(`[Scheduler] Skipping ${portalName} — already queued or running`);
      // Return the existing active job if possible
      const activeJobs = await this.queue.getActive();
      const existingJob = activeJobs.find((j) => j.data.portalName === portalName);
      if (existingJob) return existingJob;

      const waitingJobs = await this.queue.getWaiting();
      const waitingJob = waitingJobs.find((j) => j.data.portalName === portalName);
      if (waitingJob) return waitingJob;
    }

    const schedules = await this.loadSchedules();
    const schedule = schedules.find((s) => s.portalName === portalName);

    const job = await this.queue.add(
      JobType.SCRAPE_PORTAL,
      {
        jobType: JobType.SCRAPE_PORTAL,
        portalName,
        triggeredBy,
        maxPages: maxPages ?? schedule?.maxPages,
        startedAt: new Date().toISOString(),
        fullRescrape,
      },
      {
        priority: schedule?.priority ?? 5,
        jobId: `scrape-${portalName}-${Date.now()}`,
      },
    );

    console.log(`[Scheduler] Enqueued scrape job for ${portalName} (${triggeredBy})`);
    return job;
  }

  /**
   * Enqueue a full re-scrape of all enabled portals.
   */
  async enqueueFullScrape(): Promise<void> {
    const schedules = await this.loadSchedules();
    const enabled = schedules.filter((s) => s.enabled);

    console.log(`[Scheduler] Enqueuing full scrape for ${enabled.length} portals`);

    for (const schedule of enabled) {
      // fullRescrape = true: refresh already-known tenders too.
      await this.enqueueScrapeJob(schedule.portalName, 'schedule', schedule.maxPages, true);
    }
  }

  /**
   * Retry all recently failed jobs.
   */
  async retryFailedJobs(): Promise<number> {
    const failedJobs = await this.queue.getFailed(0, 100);
    let retryCount = 0;

    for (const job of failedJobs) {
      // Only retry jobs that have been failed for less than 24 hours
      const failedAt = job.finishedOn || Date.now();
      const hoursSinceFail = (Date.now() - failedAt) / (1000 * 60 * 60);

      if (hoursSinceFail < 24) {
        await job.retry();
        retryCount++;
      }
    }

    console.log(`[Scheduler] Retried ${retryCount} failed jobs`);
    return retryCount;
  }

  // ─── Cron Setup ───────────────────────────────────────────────────────────────

  private setupCronJob(schedule: PortalScheduleConfig): void {
    if (!cron.validate(schedule.cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression for ${schedule.portalName}: ${schedule.cronExpression}`);
      return;
    }

    const task = cron.schedule(schedule.cronExpression, async () => {
      console.log(`[Scheduler] Cron triggered for ${schedule.portalName}`);
      try {
        await this.enqueueScrapeJob(schedule.portalName, 'schedule', schedule.maxPages);
      } catch (error) {
        console.error(`[Scheduler] Failed to enqueue ${schedule.portalName}:`, error);
      }
    }, { timezone: CRON_TIMEZONE });

    this.cronJobs.set(schedule.portalName, task);
    console.log(`[Scheduler] Cron set for ${schedule.portalName}: ${schedule.cronExpression} (${CRON_TIMEZONE})`);
  }

  private setupFullRescrapeCron(): void {
    // Daily at 2 AM IST = 20:30 UTC previous day
    const task = cron.schedule('30 20 * * *', async () => {
      console.log('[Scheduler] Full re-scrape triggered (2 AM IST)');
      try {
        await this.enqueueFullScrape();
      } catch (error) {
        console.error('[Scheduler] Failed to enqueue full scrape:', error);
      }
    }, { timezone: CRON_TIMEZONE });

    this.cronJobs.set('__full_rescrape__', task);
    console.log(`[Scheduler] Full re-scrape cron set: 30 20 * * * ${CRON_TIMEZONE} (2 AM IST)`);
  }

  private setupRetryFailedCron(): void {
    // Retry failed jobs every hour
    const task = cron.schedule('0 * * * *', async () => {
      try {
        await this.retryFailedJobs();
      } catch (error) {
        console.error('[Scheduler] Failed to retry jobs:', error);
      }
    }, { timezone: CRON_TIMEZONE });

    this.cronJobs.set('__retry_failed__', task);
  }

  // ─── Worker ───────────────────────────────────────────────────────────────────

  private startWorker(): void {
    this.worker = new Worker<ScraperJobData, ScraperJobResult>(
      this.queue.name,
      async (job: Job<ScraperJobData, ScraperJobResult>) => {
        return this.processJob(job);
      },
      {
        connection: this.bullConnection(),
        concurrency: this.concurrency,
      },
    );

    this.worker.on('completed', (job: Job<ScraperJobData, ScraperJobResult>) => {
      const result = job.returnvalue;
      // Release lock
      this.redis.del(`${LOCK_PREFIX}:${job.data.portalName}`).catch(() => {});

      console.log(
        `[Worker] Completed ${job.data.portalName}: ` +
        `${result.tendersNew} new, ${result.tendersDuplicate} dup, ` +
        `${result.tendersFailed} failed (${result.duration}ms)`,
      );
    });

    this.worker.on('failed', (job: Job<ScraperJobData, ScraperJobResult> | undefined, error: Error) => {
      if (job) {
        // Release lock
        this.redis.del(`${LOCK_PREFIX}:${job.data.portalName}`).catch(() => {});
        console.error(`[Worker] Failed ${job.data.portalName} (attempt ${job.attemptsMade}/${job.opts.attempts}):`, error.message);
      } else {
        console.error('[Worker] Job failed with no job reference:', error.message);
      }
    });

    this.worker.on('error', (error: Error) => {
      console.error('[Worker] Worker error:', error.message);
    });

    console.log(`[Scheduler] Worker started with concurrency ${this.concurrency}`);
  }

  private startQueueEvents(): void {
    this.queueEvents = new QueueEvents(this.queue.name, {
      connection: this.bullConnection(),
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`[Scheduler] Job stalled: ${jobId}`);
    });
  }

  /**
   * Process a scraping job.
   */
  private async processJob(job: Job<ScraperJobData, ScraperJobResult>): Promise<ScraperJobResult> {
    const { portalName, jobType, maxPages, fullRescrape, triggeredBy } = job.data;
    const startTime = Date.now();

    console.log(`[Worker] Processing ${jobType} for ${portalName}`);

    if (!this.scrapeHandler) {
      throw new Error('No scrape handler registered. Call registerScrapeHandler() first.');
    }

    try {
      // Update progress
      await job.updateProgress(0);

      const result = await this.scrapeHandler(portalName, maxPages, fullRescrape, triggeredBy);

      await job.updateProgress(100);

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        portalName,
        tendersFound: 0,
        tendersNew: 0,
        tendersDuplicate: 0,
        tendersFailed: 0,
        duration: Date.now() - startTime,
        errors: [errorMessage],
      };
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────────

  /**
   * Get queue status information.
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get active jobs.
   */
  async getActiveJobs(): Promise<Job<ScraperJobData, ScraperJobResult>[]> {
    return this.queue.getActive();
  }

  /**
   * Drain the queue (remove all waiting jobs).
   */
  async drainQueue(): Promise<void> {
    await this.queue.drain();
    console.log('[Scheduler] Queue drained');
  }

  /**
   * Pause the queue.
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('[Scheduler] Queue paused');
  }

  /**
   * Resume the queue.
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('[Scheduler] Queue resumed');
  }
}
