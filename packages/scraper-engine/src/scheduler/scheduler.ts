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

import { detectMissedWindows, type MissedWindowReport } from './missed-windows';
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
  triggeredBy: 'schedule' | 'manual' | 'retry' | 'catchup';
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

/**
 * Outcome of an enqueue attempt.
 *
 * `enqueueScrapeJob()` returns the EXISTING job when the per-portal lock
 * refuses a new one, so a non-null return cannot distinguish "queued" from
 * "already running". Phase 8 saw the consequence in the control API, which
 * answered `200 {"message":"Scraping job queued"}` for a run it had actually
 * skipped. Callers that need to tell the two apart use
 * `enqueueScrapeJobDetailed()` and switch on `status`.
 */
export type EnqueueOutcome =
  | { status: 'queued'; job: Job<ScraperJobData, ScraperJobResult> }
  | {
      status: 'already-running';
      /** The in-flight job, when it could be located in the active/waiting sets. */
      job: Job<ScraperJobData, ScraperJobResult> | null;
    };

export interface ScraperJobResult {
  portalName: string;
  tendersFound: number;
  tendersNew: number;
  tendersDuplicate: number;
  tendersFailed: number;
  duration: number;
  errors: string[];
  /**
   * True when the handler deliberately did NOT run a scrape (for example the
   * portal was disabled while the job sat in the queue).
   *
   * A skip previously returned an all-zero result that was indistinguishable
   * from a successful scrape of an empty portal: BullMQ marked the job
   * completed, the failure vanished from the failed set, and no ScrapingRun row
   * existed to say otherwise. Phase 8 observed exactly that — a retried job
   * reported "0 new, 0 dup, 0 failed" having made no HTTP request at all.
   */
  skipped?: boolean;
  /** Why the scrape was skipped. Set whenever `skipped` is true. */
  skippedReason?: string;
}

/**
 * Operator overrides, as stored in PostgreSQL (ScraperHealth). Supplied by
 * main.ts; omitted in unit tests, where the registry defaults are used.
 */
export interface ScheduleSource {
  /** Keyed by ScraperHealth.portalName (human-readable). */
  getScheduleOverrides(): Promise<
    Array<{ portalName: string; enabled: boolean; cronExpression: string | null }>
  >;
  getSchedulerPaused(): Promise<boolean>;
  setSchedulerPaused(paused: boolean): Promise<void>;
  /**
   * Last ATTEMPTED run per portal, keyed by the human-readable portal name
   * (ScraperHealth.lastRunAt, written on both the success and failure paths).
   *
   * Optional: a source without it simply disables missed-window detection,
   * which keeps existing unit tests and any reduced deployment working.
   */
  getPortalLastRuns?(): Promise<Array<{ portalName: string; lastRunAt: Date | null }>>;
}

type PortalScrapeHandler = (
  portalName: string,
  maxPages?: number,
  fullRescrape?: boolean,
  triggeredBy?: 'schedule' | 'manual' | 'retry' | 'catchup',
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

/**
 * Per-portal execution lock.
 *
 * The lock used to be taken for a flat 300 s at enqueue time while schedules
 * run every 2-6 hours and a run has no time limit. Any run longer than five
 * minutes - the normal case for 10-20 paginated listing pages at a 2.5-3 s
 * request delay - left no guard at all, so the next cron firing enqueued a
 * second job for the same portal and the worker (concurrency 3) ran them
 * concurrently against the same portal.
 *
 * It is now short-lived but RENEWED for as long as the job actually runs, and
 * released only when the job reaches a terminal state. A crashed worker stops
 * renewing, so the lock expires on its own within LOCK_TTL_SECONDS instead of
 * wedging the portal forever.
 */
const LOCK_TTL_SECONDS = 120;
const LOCK_RENEW_INTERVAL_MS = 40_000;

/**
 * Failures that re-running cannot fix: the portal key is not in the registry,
 * or no scraper class is bound to it. Retrying these just burns attempts and
 * fills the failed set, so they are discarded instead.
 */
export function isPermanentScrapeFailure(message: string): boolean {
  return /^(Unknown portal|No scraper class)/i.test(message.trim());
}

// ─── Scheduler Class ────────────────────────────────────────────────────────────

export class ScrapingScheduler {
  private redis: Redis;
  private queue: Queue<ScraperJobData, ScraperJobResult>;
  private worker: Worker<ScraperJobData, ScraperJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  /** Cron expression each task was registered with, keyed by portal. */
  private registeredCron: Map<string, string> = new Map();
  /** Authoritative operator overrides (PostgreSQL), when wired. */
  private scheduleSource: ScheduleSource | null = null;
  /** Periodic re-read of the authoritative config. */
  private reconcileTimer: NodeJS.Timeout | null = null;
  /** True when an administrator has paused scheduling. */
  private paused = false;
  /** Active lock-renewal timers, keyed by portal. */
  private lockRenewals: Map<string, NodeJS.Timeout> = new Map();
  /** Redis connections handed to BullMQ, which we own and must close. */
  private bullConnections: Redis[] = [];
  private scrapeHandler: PortalScrapeHandler | null = null;
  private running = false;
  private concurrency: number;
  private readonly attempts: number;
  private readonly backoffMs: number;
  private readonly missedWindowSweepMs: number;
  private readonly missedWindowGraceMs: number;
  private readonly maxCatchUpPerSweep: number;
  private missedWindowTimer: NodeJS.Timeout | null = null;
  private readonly queueName: string;
  private readonly reconcileIntervalMs: number;

  constructor(
    redis: Redis,
    options?: {
      concurrency?: number;
      queueName?: string;
      /**
       * BullMQ attempt limit and exponential-backoff base for scrape jobs.
       *
       * These were hardcoded as 3 / 60000 here while config/index.ts exposed
       * QUEUE_RETRY_ATTEMPTS and QUEUE_RETRY_BACKOFF_MS — so both documented
       * environment variables did nothing. main.ts now passes the configured
       * values through; the defaults below preserve the previous behaviour
       * exactly when neither variable is set.
       */
      attempts?: number;
      backoffMs?: number;
      /**
       * Missed-window sweep: how often to run it, how long a closed window is
       * forgiven, and the per-portal catch-up cap. `missedWindowSweepMs: 0`
       * disables the sweep entirely (used by unit tests that drive it by hand).
       */
      missedWindowSweepMs?: number;
      missedWindowGraceMs?: number;
      maxCatchUpPerSweep?: number;
      /**
       * Authoritative operator overrides. Without it the scheduler falls back
       * to the portal registry plus whatever is cached in Redis.
       */
      scheduleSource?: ScheduleSource;
      /** How often to re-read the authoritative config (ms). */
      reconcileIntervalMs?: number;
    },
  ) {
    this.redis = redis;
    this.concurrency = options?.concurrency ?? 3;
    this.attempts = options?.attempts ?? 3;
    this.backoffMs = options?.backoffMs ?? 60000;
    // Five minutes: frequent enough that a gap is noticed well inside the
    // shortest production cadence (2 hours), cheap enough to be irrelevant.
    this.missedWindowSweepMs = options?.missedWindowSweepMs ?? 300_000;
    // A scrape plus queue latency; comfortably longer than any observed run.
    this.missedWindowGraceMs = options?.missedWindowGraceMs ?? 90_000;
    this.maxCatchUpPerSweep = options?.maxCatchUpPerSweep ?? 1;
    this.queueName = options?.queueName ?? 'scraper-jobs';
    this.scheduleSource = options?.scheduleSource ?? null;
    this.reconcileIntervalMs = options?.reconcileIntervalMs ?? 60_000;
    this.queue = this.createQueue();
  }

  /** Expose the pause state for the readiness probe. */
  get isPaused(): boolean {
    return this.paused;
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
   * How many cron tasks this process currently has registered.
   *
   * Read by GET /api/ready: a "running" scheduler with zero registered crons
   * would never enqueue anything, which is exactly the silent failure the old
   * always-200 health endpoint hid.
   */
  get registeredCronCount(): number {
    return this.cronJobs.size;
  }

  /**
   * Registered PORTAL crons, excluding internal maintenance tasks.
   *
   * The readiness probe used to count `registeredCronCount`, which includes
   * `__full_rescrape__` and `__retry_failed__`. Those two are registered
   * unconditionally by start(), so the count was never below 2 and the
   * "no cron schedules are registered" branch was unreachable: a scheduler that
   * had lost every portal cron still reported itself ready. Phase 8 saw exactly
   * that state — `registeredCronCount: 2` with zero portals scheduled, and
   * `ready: true`.
   */
  get portalCronCount(): number {
    let count = 0;
    for (const name of this.cronJobs.keys()) if (!name.startsWith('__')) count++;
    return count;
  }

  /** Registered internal maintenance crons (full re-scrape, failed-job retry). */
  get internalCronCount(): number {
    let count = 0;
    for (const name of this.cronJobs.keys()) if (name.startsWith('__')) count++;
    return count;
  }

  /**
   * How many portals SHOULD have a cron right now, per the authoritative
   * schedule set. Readiness compares this against portalCronCount: zero enabled
   * portals is a deliberate operator state, whereas enabled portals with no
   * registered cron is a fault.
   */
  async enabledPortalCount(): Promise<number> {
    const schedules = await this.loadSchedules();
    return schedules.filter((schedule) => schedule.enabled).length;
  }

  /**
   * The cron expression a portal's task is currently registered with, or
   * undefined when it has none. Used by the admin API and by tests to prove an
   * operator's edit actually reached the running scheduler.
   */
  registeredCronFor(portalName: string): string | undefined {
    return this.registeredCron.get(portalName);
  }

  /**
   * BullMQ requires `maxRetriesPerRequest: null` on any connection it uses for
   * blocking commands (Worker, QueueEvents) and refuses to start otherwise. The
   * Redis instance handed to this scheduler is the engine's general-purpose one
   * (created with maxRetriesPerRequest: 3), and ioredis `duplicate()` inherits
   * that, so every duplicate made here overrides it explicitly.
   */
  private bullConnection(): Redis {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    // BullMQ does not close connections it was handed, so stop() must. Without
    // this, every stop/start cycle (the API exposes both) leaked three Redis
    // connections and kept the event loop alive after shutdown.
    this.bullConnections.push(connection);
    return connection;
  }

  /**
   * Build the BullMQ queue. Called from the constructor and again by start()
   * after a stop(), because stop() closes the queue and a closed Queue cannot
   * be reused — without this, stop() followed by start() (e.g. via the
   * POST /api/scheduler/stop then /start endpoints) operated on a dead queue.
   */
  private createQueue(): Queue<ScraperJobData, ScraperJobResult> {
    const queue = new Queue<ScraperJobData, ScraperJobResult>(this.queueName, {
      connection: this.bullConnection(),
      defaultJobOptions: {
        attempts: this.attempts,
        backoff: {
          type: 'exponential',
          // Default 60000: 1 minute initial, then 2 min, 4 min.
          delay: this.backoffMs,
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
        },
      },
    });

    // An 'error' event with no listener is FATAL in Node — it is rethrown and
    // takes the process down. Only `worker` had a handler, so BullMQ's Queue
    // connection emitting (for example) "Connection is closed." during a Redis
    // blip or an orderly shutdown killed the scraper container outright. The
    // queue is recreated on the next start(), so logging is the right response.
    queue.on('error', (error: Error) => {
      console.error('[Scheduler] Queue connection error:', error.message);
    });

    return queue;
  }

  // ─── Per-portal execution lock ──────────────────────────────────────────────

  private lockKey(portalName: string): string {
    return `${LOCK_PREFIX}:${portalName}`;
  }

  /** Take the lock, or report that someone else holds it. */
  private async acquirePortalLock(portalName: string, holder: string): Promise<boolean> {
    const result = await this.redis.set(
      this.lockKey(portalName),
      holder,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  /** Take over an already-held lock (enqueue -> worker hand-off). */
  private async takePortalLock(portalName: string, holder: string): Promise<void> {
    await this.redis.set(this.lockKey(portalName), holder, 'EX', LOCK_TTL_SECONDS);
  }

  /** Release the lock only if we still own it, so we cannot free someone else's. */
  private async releasePortalLock(portalName: string, holder: string): Promise<void> {
    this.stopLockRenewal(portalName);
    const current = await this.redis.get(this.lockKey(portalName)).catch(() => null);
    if (current === null || current === holder) {
      await this.redis.del(this.lockKey(portalName)).catch(() => {});
    }
  }

  /** Keep the lock alive while the job runs. */
  private startLockRenewal(portalName: string, holder: string): void {
    this.stopLockRenewal(portalName);
    const timer = setInterval(() => {
      void (async () => {
        try {
          const current = await this.redis.get(this.lockKey(portalName));
          if (current !== holder) {
            // Lost ownership (expired and retaken): stop renewing.
            this.stopLockRenewal(portalName);
            return;
          }
          await this.redis.expire(this.lockKey(portalName), LOCK_TTL_SECONDS);
        } catch {
          // Transient Redis error: the next tick retries, and the lock expires
          // on its own if Redis stays unavailable.
        }
      })();
    }, LOCK_RENEW_INTERVAL_MS);

    // Never hold the event loop open on account of a renewal timer.
    if (typeof timer.unref === 'function') timer.unref();
    this.lockRenewals.set(portalName, timer);
  }

  private stopLockRenewal(portalName: string): void {
    const timer = this.lockRenewals.get(portalName);
    if (timer) {
      clearInterval(timer);
      this.lockRenewals.delete(portalName);
    }
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

    // Restore the operator's pause decision. POST /api/scheduler/stop used to
    // flip an in-memory flag only, so a restart silently resumed scraping.
    this.paused = await this.readPausedState();
    if (this.paused) {
      console.log(
        '[Scheduler] Scheduling is PAUSED by an administrator (persisted) — no portal crons will be registered.',
      );
    }

    // Load or initialize schedules
    const schedules = await this.loadSchedules();

    // Set up cron jobs for each enabled portal
    for (const schedule of schedules) {
      if (schedule.enabled && !this.paused) {
        this.setupCronJob(schedule);
      }
    }

    const disabled = schedules.filter((s) => !s.enabled).map((s) => s.portalName);
    if (disabled.length > 0) {
      console.log(
        `[Scheduler] ${disabled.length} portal(s) disabled by operator: ${disabled.join(', ')}`,
      );
    }

    // Set up the full re-scrape daily job (2 AM IST = 20:30 UTC)
    this.setupFullRescrapeCron();

    // Set up retry failed jobs cron (every hour)
    this.setupRetryFailedCron();

    // Start BullMQ worker
    this.startWorker();

    // Start queue events listener
    this.startQueueEvents();

    // Re-read the authoritative config periodically so admin changes apply
    // without a restart.
    if (
      this.scheduleSource?.getPortalLastRuns &&
      this.missedWindowSweepMs > 0
    ) {
      this.missedWindowTimer = setInterval(() => {
        void this.sweepMissedWindows().catch((err) =>
          console.error(
            '[Scheduler] Missed-window sweep failed:',
            err instanceof Error ? err.message : err,
          ),
        );
      }, this.missedWindowSweepMs);
      this.missedWindowTimer.unref?.();
      console.log(
        `[Scheduler] Missed-window sweep every ${this.missedWindowSweepMs}ms ` +
          `(grace ${this.missedWindowGraceMs}ms, max ${this.maxCatchUpPerSweep} catch-up/portal)`,
      );
    }

    if (this.scheduleSource && this.reconcileIntervalMs > 0) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcileSchedulesFromSource().catch((err) =>
          console.error(
            '[Scheduler] Reconciliation failed:',
            err instanceof Error ? err.message : err,
          ),
        );
      }, this.reconcileIntervalMs);
      if (typeof this.reconcileTimer.unref === 'function') this.reconcileTimer.unref();
    }

    this.running = true;
    console.log(
      `[Scheduler] Started with ${
        this.paused ? 0 : schedules.filter((s) => s.enabled).length
      } active portals${this.paused ? ' (PAUSED)' : ''}`,
    );
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
    this.registeredCron.clear();

    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }


    if (this.missedWindowTimer) {

      clearInterval(this.missedWindowTimer);

      this.missedWindowTimer = null;

    }

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

    // Stop any lock renewals still ticking for in-flight portals.
    for (const portalName of [...this.lockRenewals.keys()]) {
      this.stopLockRenewal(portalName);
    }

    // Close the connections we duplicated for BullMQ (it does not own them).
    await Promise.all(
      this.bullConnections.map((connection) =>
        connection.quit().catch(() => connection.disconnect()),
      ),
    );
    this.bullConnections = [];

    this.running = false;
    console.log('[Scheduler] Shutdown complete');
  }

  // ─── Schedule Management ──────────────────────────────────────────────────────

  /**
   * Load schedules from Redis, falling back to defaults.
   */
  private async loadSchedules(): Promise<PortalScheduleConfig[]> {
    const defaults = buildDefaultSchedules();

    // Preferred path: PostgreSQL is authoritative for operator intent.
    if (this.scheduleSource) {
      const resolved = await this.applyOverrides(defaults);
      // Keep Redis as a cache so the resolved set stays observable, but it is
      // no longer consulted as a source of truth.
      await this.saveSchedules(resolved);
      return resolved;
    }

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
   * Merge the portal registry with the operator's PostgreSQL overrides.
   *
   * ScraperHealth rows are keyed by the human-readable portal name, while
   * schedules are keyed by registry key, so they are matched case-insensitively
   * on the registry's `name`.
   */
  private async applyOverrides(
    defaults: PortalScheduleConfig[],
  ): Promise<PortalScheduleConfig[]> {
    if (!this.scheduleSource) return defaults;

    let overrides: Awaited<ReturnType<ScheduleSource['getScheduleOverrides']>> = [];
    try {
      overrides = await this.scheduleSource.getScheduleOverrides();
    } catch (err) {
      // A database blip must not silently revert everything to the registry
      // defaults (which would re-enable a portal an operator disabled), so keep
      // the last resolved set from the Redis cache if there is one.
      console.error(
        '[Scheduler] Could not read schedule overrides from PostgreSQL:',
        err instanceof Error ? err.message : err,
      );
      const cached = await this.redis.get(SCHEDULES_KEY).catch(() => null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as PortalScheduleConfig[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.error('[Scheduler] Falling back to the last cached schedule set.');
            return parsed;
          }
        } catch {
          /* fall through to defaults */
        }
      }
      return defaults;
    }

    const byName = new Map(
      overrides.map((row) => [row.portalName.toLowerCase(), row]),
    );

    return defaults.map((schedule) => {
      const portal = getPortalConfig(schedule.portalName);
      const override = portal ? byName.get(portal.name.toLowerCase()) : undefined;
      if (!override) return schedule;

      const cronExpression =
        typeof override.cronExpression === 'string' &&
        override.cronExpression.trim() !== '' &&
        cron.validate(override.cronExpression)
          ? override.cronExpression
          : schedule.cronExpression;

      if (
        override.cronExpression &&
        override.cronExpression.trim() !== '' &&
        !cron.validate(override.cronExpression)
      ) {
        console.error(
          `[Scheduler] Ignoring invalid cron expression stored for ${portal?.name}: ` +
            `"${override.cronExpression}" — keeping ${schedule.cronExpression}`,
        );
      }

      // AND, not replace: PORTAL_*_ENABLED is a hard kill switch applied at
      // container start, while the database row is the operator's toggle. If
      // the database value simply replaced the registry value, a portal turned
      // off by environment would be silently re-enabled by the default
      // ScraperHealth row (enabled defaults to true), removing the only
      // deploy-time way to keep a portal from ever being contacted.
      return {
        ...schedule,
        enabled: schedule.enabled && override.enabled,
        cronExpression,
      };
    });
  }

  /**
   * Re-read the authoritative config and bring the registered crons in line.
   *
   * Called on a timer so an admin enabling/disabling a portal or editing its
   * cron takes effect WITHOUT a container restart.
   */
  async reconcileSchedulesFromSource(): Promise<void> {
    if (!this.running) return;

    const paused = await this.readPausedState();
    if (paused !== this.paused) {
      this.paused = paused;
      console.log(
        `[Scheduler] Pause state changed: scheduling is now ${paused ? 'PAUSED' : 'ACTIVE'}`,
      );
    }

    const schedules = await this.loadSchedules();

    if (this.paused) {
      for (const [name, task] of [...this.cronJobs]) {
        if (name.startsWith('__')) continue;
        task.stop();
        this.cronJobs.delete(name);
        this.registeredCron.delete(name);
      }
      return;
    }

    for (const schedule of schedules) {
      const existing = this.cronJobs.get(schedule.portalName);
      const desired = schedule.enabled;

      if (!desired && existing) {
        existing.stop();
        this.cronJobs.delete(schedule.portalName);
        this.registeredCron.delete(schedule.portalName);
        console.log(`[Scheduler] Portal disabled by operator — cron removed: ${schedule.portalName}`);
        continue;
      }

      if (desired && !existing) {
        this.setupCronJob(schedule);
        console.log(`[Scheduler] Portal enabled by operator — cron added: ${schedule.portalName}`);
        continue;
      }

      if (desired && existing) {
        const registered = this.registeredCron.get(schedule.portalName);
        if (registered !== schedule.cronExpression) {
          existing.stop();
          this.cronJobs.delete(schedule.portalName);
          this.registeredCron.delete(schedule.portalName);
          this.setupCronJob(schedule);
          console.log(
            `[Scheduler] Cron changed by operator for ${schedule.portalName}: ` +
              `${registered} -> ${schedule.cronExpression}`,
          );
        }
      }
    }
  }

  /**
   * Detect scheduled windows that never fired, and enqueue a bounded catch-up.
   *
   * `node-cron` does not replay a missed tick. Phase 8 lost the 09:16 and 09:18
   * firings to a host freeze with no error and no catch-up, so this sweep
   * reconstructs the gap from persisted state (ScraperHealth.lastRunAt) instead
   * of from in-process timers — which means it also covers a gap that spanned a
   * restart.
   *
   * Safety properties, in order of importance:
   *   * respects the persisted administrator pause and per-portal enable flag;
   *   * goes through enqueueScrapeJob(), so the per-portal lock prevents a
   *     catch-up from running concurrently with a normal firing, and prevents
   *     duplicates when normal scheduling resumes;
   *   * enqueues at most `maxCatchUpPerSweep` runs per portal, so a long outage
   *     cannot produce an unbounded backlog;
   *   * tags the job `catchup`, so the ScrapingRun row says what it was;
   *   * reports windows it will NOT recover, rather than dropping them quietly.
   */
  async sweepMissedWindows(now: Date = new Date()): Promise<{
    checked: number;
    caughtUp: number;
    reports: Array<{ portalName: string; report: MissedWindowReport }>;
  }> {
    const reports: Array<{ portalName: string; report: MissedWindowReport }> = [];

    if (!this.scheduleSource?.getPortalLastRuns) {
      return { checked: 0, caughtUp: 0, reports };
    }

    // An administrator pause outranks catch-up: resuming must not unleash a
    // backlog accumulated while scheduling was intentionally stopped.
    if (await this.readPausedState()) {
      console.log('[Scheduler] Missed-window sweep skipped — scheduling is paused');
      return { checked: 0, caughtUp: 0, reports };
    }

    let lastRuns: Array<{ portalName: string; lastRunAt: Date | null }>;
    try {
      lastRuns = await this.scheduleSource.getPortalLastRuns();
    } catch (err) {
      console.error(
        '[Scheduler] Missed-window sweep could not read last-run times:',
        err instanceof Error ? err.message : err,
      );
      return { checked: 0, caughtUp: 0, reports };
    }

    // ScraperHealth is keyed by display name; schedules by registry key.
    const byName = new Map(lastRuns.map((row) => [row.portalName.toLowerCase(), row]));
    const schedules = await this.loadSchedules();

    let checked = 0;
    let caughtUp = 0;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      const portal = getPortalConfig(schedule.portalName);
      const health = portal ? byName.get(portal.name.toLowerCase()) : undefined;

      checked++;

      const report = detectMissedWindows({
        expression: schedule.cronExpression,
        lastRunAt: health?.lastRunAt ?? null,
        now,
        graceMs: this.missedWindowGraceMs,
        maxCatchUp: this.maxCatchUpPerSweep,
      });
      reports.push({ portalName: schedule.portalName, report });

      if (report.status === 'invalid-expression') {
        console.error(
          `[Scheduler] ${schedule.portalName}: cron '${schedule.cronExpression}' is not ` +
            'parseable, so this portal is NOT being scheduled at all. Fix the expression.',
        );
        continue;
      }

      if (report.status !== 'missed' || report.missed.length === 0) continue;

      const windows = report.missed.map((d) => d.toISOString()).join(', ');
      console.warn(
        `[Scheduler] ${schedule.portalName}: missed ${report.missed.length} scheduled ` +
          `window(s) [${windows}] — enqueuing catch-up`,
      );

      if (report.unrecoverable > 0) {
        console.error(
          `[Scheduler] ${schedule.portalName}: ${report.countTruncated ? 'at least ' : ''}` +
            `${report.unrecoverable} further missed window(s) will NOT be recovered ` +
            `(cap ${this.maxCatchUpPerSweep} per sweep). That data gap is permanent ` +
            'unless a full re-scrape is run.',
        );
      }

      // One catch-up per sweep per portal: the lock would refuse a second
      // anyway, and this keeps the intent explicit.
      const outcome = await this.enqueueScrapeJobDetailed(
        schedule.portalName,
        'catchup',
        schedule.maxPages,
      );
      if (outcome.status === 'queued') {
        caughtUp++;
      } else {
        console.log(
          `[Scheduler] ${schedule.portalName}: catch-up not enqueued — a run is already ` +
            'queued or in progress (no duplicate created)',
        );
      }
    }

    return { checked, caughtUp, reports };
  }

  /** Read the persisted pause flag, defaulting to "not paused" on error. */
  private async readPausedState(): Promise<boolean> {
    if (!this.scheduleSource) return false;
    try {
      return await this.scheduleSource.getSchedulerPaused();
    } catch (err) {
      console.error(
        '[Scheduler] Could not read the persisted pause flag:',
        err instanceof Error ? err.message : err,
      );
      return this.paused;
    }
  }

  /**
   * Persist the administrator's pause decision so it survives a restart.
   */
  async setPaused(paused: boolean): Promise<void> {
    this.paused = paused;
    if (this.scheduleSource) {
      await this.scheduleSource.setSchedulerPaused(paused);
    }
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
    triggeredBy: 'schedule' | 'manual' | 'retry' | 'catchup' = 'manual',
    maxPages?: number,
    fullRescrape = false,
  ): Promise<Job<ScraperJobData, ScraperJobResult> | null> {
    const outcome = await this.enqueueScrapeJobDetailed(
      portalName,
      triggeredBy,
      maxPages,
      fullRescrape,
    );
    return outcome.job;
  }

  /**
   * Enqueue a scraping job, reporting explicitly whether it was queued.
   *
   * Prefer this over `enqueueScrapeJob()` wherever the answer matters — an API
   * response, a catch-up counter — because the older signature returns the
   * in-flight job on refusal and so looks like success.
   */
  async enqueueScrapeJobDetailed(
    portalName: string,
    triggeredBy: 'schedule' | 'manual' | 'retry' | 'catchup' = 'manual',
    maxPages?: number,
    fullRescrape = false,
  ): Promise<EnqueueOutcome> {
    // One pending-or-running job per portal. Previously this check applied only
    // to `triggeredBy === 'schedule'`, and even then fell through to enqueue
    // when it could not find the existing job in the active/waiting sets - so
    // duplicates were produced by exactly the race it was meant to stop.
    // Manual triggers ignored it entirely.
    const holder = `enqueue:${process.pid}:${Date.now()}`;
    const acquired = await this.acquirePortalLock(portalName, holder);

    if (!acquired) {
      const existing =
        (await this.queue.getActive()).find((j) => j.data.portalName === portalName) ??
        (await this.queue.getWaiting()).find((j) => j.data.portalName === portalName) ??
        null;

      console.log(
        `[Scheduler] Skipping ${portalName} (${triggeredBy}) - a run is already queued or in progress` +
          (existing ? ` (job ${existing.id})` : ''),
      );
      return { status: 'already-running', job: existing };
    }

    const schedules = await this.loadSchedules();
    const schedule = schedules.find((s) => s.portalName === portalName);

    let job: Job<ScraperJobData, ScraperJobResult>;
    try {
      job = await this.queue.add(
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
    } catch (err) {
      // Nothing will reach the worker, so nothing would ever release the lock.
      await this.releasePortalLock(portalName, holder);
      throw err;
    }

    console.log(`[Scheduler] Enqueued scrape job for ${portalName} (${triggeredBy})`);
    return { status: 'queued', job };
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
    let heldBack = 0;

    for (const job of failedJobs) {
      // Only retry jobs that have been failed for less than 24 hours
      const failedAt = job.finishedOn || Date.now();
      const hoursSinceFail = (Date.now() - failedAt) / (1000 * 60 * 60);

      if (hoursSinceFail >= 24) continue;

      const portalName = job.data?.portalName;

      // Do not retry a portal that cannot run right now.
      //
      // This used to call job.retry() unconditionally. The retried job kept
      // `triggeredBy: 'schedule'`, so the scrape handler's "portal disabled"
      // guard dropped it and returned a SUCCESS-shaped all-zero result —
      // BullMQ moved the job from failed to completed, the failure disappeared,
      // no HTTP request was made and no ScrapingRun row was written. Phase 8
      // caught this live: `Retried 1 failed jobs` followed by
      // `Completed testportal: 0 new, 0 dup, 0 failed (263ms)` with the mock
      // portal's request counter untouched.
      //
      // Leaving the job in the failed set is the honest outcome: nothing ran,
      // so nothing should look like it succeeded. The next sweep reconsiders it
      // once the operator re-enables the portal (within the 24h window).
      if (portalName && !(await this.isSchedulingAllowed(portalName))) {
        heldBack++;
        console.log(
          `[Scheduler] Not retrying ${portalName} (job ${job.id}) — portal disabled or ` +
            'scheduling paused; leaving it in the failed set rather than marking it completed',
        );
        continue;
      }

      // Mark the attempt as a retry so the execution path can tell it apart
      // from a fresh scheduled firing, and so the ScrapingRun row records the
      // real trigger. Without this every retry claimed `triggeredBy: schedule`.
      try {
        await job.updateData({ ...job.data, triggeredBy: 'retry' });
      } catch (err) {
        // A job that cannot be re-tagged would run as 'schedule' and risk the
        // silent-drop path again, so skip it rather than guess.
        console.error(
          `[Scheduler] Could not tag job ${job.id} as a retry; leaving it failed:`,
          err instanceof Error ? err.message : err,
        );
        continue;
      }

      await job.retry();
      retryCount++;
    }

    console.log(
      `[Scheduler] Retried ${retryCount} failed jobs` +
        (heldBack > 0 ? ` (${heldBack} held back — portal disabled or paused)` : ''),
    );
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
        // Re-check authoritative state at fire time, so a disable or a pause
        // takes effect immediately rather than at the next reconciliation.
        if (!(await this.isSchedulingAllowed(schedule.portalName))) {
          console.log(
            `[Scheduler] Skipping ${schedule.portalName} — disabled or scheduling paused`,
          );
          return;
        }
        await this.enqueueScrapeJob(schedule.portalName, 'schedule', schedule.maxPages);
      } catch (error) {
        console.error(`[Scheduler] Failed to enqueue ${schedule.portalName}:`, error);
      }
    }, { timezone: CRON_TIMEZONE });

    this.cronJobs.set(schedule.portalName, task);
    this.registeredCron.set(schedule.portalName, schedule.cronExpression);
    console.log(`[Scheduler] Cron set for ${schedule.portalName}: ${schedule.cronExpression} (${CRON_TIMEZONE})`);
  }

  /**
   * Whether a scheduled run for this portal may be enqueued right now.
   *
   * Consults the authoritative source, so an admin change applies even to a
   * cron that was registered before it.
   */
  async isSchedulingAllowed(portalName: string): Promise<boolean> {
    if (await this.readPausedState()) {
      this.paused = true;
      return false;
    }
    if (!this.scheduleSource) return true;

    const schedules = await this.loadSchedules();
    const schedule = schedules.find((s) => s.portalName === portalName);
    return schedule?.enabled ?? true;
  }

  private setupFullRescrapeCron(): void {
    // Daily at 2 AM IST = 20:30 UTC previous day
    const task = cron.schedule('30 20 * * *', async () => {
      console.log('[Scheduler] Full re-scrape triggered (2 AM IST)');
      try {
        if (await this.readPausedState()) {
          console.log('[Scheduler] Skipping full re-scrape — scheduling is paused');
          return;
        }
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
      // Terminal state: release the portal so the next schedule can run.
      void this.releasePortalLock(
        job.data.portalName,
        `worker:${process.pid}:${job.id}`,
      );

      if (result?.skipped) {
        console.warn(
          `[Worker] SKIPPED ${job.data.portalName} (${job.data.triggeredBy}): ` +
            `${result.skippedReason ?? 'no reason given'} — no scrape ran and no run record was created`,
        );
        return;
      }

      console.log(
        `[Worker] Completed ${job.data.portalName}: ` +
        `${result.tendersNew} new, ${result.tendersDuplicate} dup, ` +
        `${result.tendersFailed} failed (${result.duration}ms)`,
      );
    });

    this.worker.on('failed', (job: Job<ScraperJobData, ScraperJobResult> | undefined, error: Error) => {
      if (job) {
        const attempts = job.opts.attempts ?? 1;
        const exhausted = job.attemptsMade >= attempts;

        // Hold the lock across backoff: a retry for this portal is still
        // pending, so a cron firing in the meantime must not enqueue a second
        // job. Release only once no attempt remains.
        if (exhausted) {
          void this.releasePortalLock(
            job.data.portalName,
            `worker:${process.pid}:${job.id}`,
          );
        } else {
          void this.takePortalLock(
            job.data.portalName,
            `retry:${process.pid}:${job.id}`,
          );
        }

        console.error(
          `[Worker] Failed ${job.data.portalName} (attempt ${job.attemptsMade}/${attempts}` +
            `${exhausted ? ', no attempts left' : ', will retry after backoff'}):`,
          error.message,
        );
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

    // See the note in createQueue(): an unhandled 'error' event is fatal.
    // QueueEvents holds a blocking Redis connection, so it is the listener most
    // likely to emit one when Redis goes away or the scheduler shuts down.
    this.queueEvents.on('error', (error: Error) => {
      console.error('[Scheduler] Queue events connection error:', error.message);
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

    // Take over the lock from the enqueue step and keep renewing it for as
    // long as this attempt runs.
    const holder = `worker:${process.pid}:${job.id}`;
    await this.takePortalLock(portalName, holder);
    this.startLockRenewal(portalName, holder);

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
      // Propagate the failure.
      //
      // This used to `return` a success-shaped result carrying `errors: [...]`,
      // so BullMQ marked every failed scrape as COMPLETED: `attempts: 3` and
      // the exponential backoff never engaged, worker 'failed' never fired, and
      // the hourly retryFailedJobs() always found an empty failed set. The run
      // was recorded as failed in Postgres and nowhere else.
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Worker] ${portalName} failed after ${Date.now() - startTime}ms: ${err.message}`,
      );

      if (isPermanentScrapeFailure(err.message)) {
        // Re-running cannot fix an unregistered portal: stop the attempt chain.
        console.error(
          `[Worker] ${portalName}: permanent configuration error - discarding without retry`,
        );
        job.discard();
      }

      throw err;
    } finally {
      this.stopLockRenewal(portalName);
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
