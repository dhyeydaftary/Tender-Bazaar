/**
 * Scraper Admin API
 *
 * Lightweight Express server for managing and monitoring the scraper engine.
 * Runs on a separate port (default 4001) from the main API.
 *
 * Authentication:
 *   Every endpoint except GET /api/health and GET /api/ready requires the
 *   shared secret SCRAPER_API_TOKEN, sent as `Authorization: Bearer <token>`
 *   or `X-Scraper-Api-Token: <token>`. Production boot fails when the secret
 *   is missing or a placeholder (see assertApiSecurity in ../config).
 *
 * Endpoints:
 *   GET  /api/health            — Liveness: is this process up?  (public)
 *   GET  /api/ready             — Readiness: is scheduling running? (public)
 *   GET  /api/portals           — List all portal statuses
 *   GET  /api/portals/:key      — Single portal status + recent runs
 *   POST /api/portals/:key/run  — Trigger a manual scraping run
 *   POST /api/portals/:key/toggle — Enable/disable a portal
 *   GET  /api/runs              — Recent scraping runs (all portals)
 *   GET  /api/runs/:id          — Single run details
 *   GET  /api/stats             — Aggregate statistics
 *   POST /api/scheduler/start   — Start the scheduler
 *   POST /api/scheduler/stop    — Stop the scheduler
 */

import crypto from 'node:crypto';

import express, { Request, Response, NextFunction } from 'express';
import { StorageWriter } from '../storage/writer';
import { PORTAL_CONFIGS, getPortalConfig, config } from '../config';
import { createLogger } from '../utils/logger';
// The scheduler type is loosely coupled — we only need start/stop/isRunning
interface SchedulerLike {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning?: boolean | (() => boolean);
  /** Optional: administrator pause state, persisted across restarts. */
  isPaused?: boolean;
  /** Optional: persist a pause/resume decision. */
  setPaused?(paused: boolean): Promise<void>;
  /** Optional: used by /api/ready to prove the queue is actually reachable. */
  getQueueStatus?(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
  /** Optional: number of cron tasks currently registered in this process. */
  registeredCronCount?: number | (() => number);
  /** Optional: registered PORTAL crons, excluding internal maintenance tasks. */
  portalCronCount?: number | (() => number);
  /** Optional: registered internal maintenance crons. */
  internalCronCount?: number | (() => number);
  /** Optional: how many portals are enabled and so should have a cron. */
  enabledPortalCount?: () => Promise<number>;
  /** Optional: run the failed-job retry sweep. Exposed only via a test hook. */
  retryFailedJobs?: () => Promise<number>;
}

/**
 * Endpoints that must stay reachable without credentials.
 *
 * Both are read-only and are used by the container healthcheck, which runs
 * `curl` inside the container and has no access to the shared secret.
 */
const PUBLIC_PATHS = new Set(['/api/health', '/api/ready']);

/** How long the readiness probe waits for the job queue before giving up. */
const QUEUE_PROBE_TIMEOUT_MS = 3000;

/**
 * Constant-time comparison so a wrong token cannot be discovered by timing.
 * Lengths are compared first because timingSafeEqual requires equal lengths.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  if (expected === '' || provided === '') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Extract the caller's token from either `Authorization: Bearer <token>` or
 * `X-Scraper-Api-Token: <token>`.
 */
export function extractToken(headers: {
  authorization?: string;
  'x-scraper-api-token'?: string;
}): string {
  const header = headers.authorization ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (bearer) return bearer[1].trim();
  return (headers['x-scraper-api-token'] ?? '').trim();
}

const logger = createLogger('AdminAPI');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminApiOptions {
  port?: number;
  storageWriter: StorageWriter;
  scheduler?: SchedulerLike;
  onTriggerRun?: (portalKey: string) => Promise<TriggerRunOutcome>;
  /**
   * Register the test-only control hooks. Defaults to config.testHooksEnabled,
   * which requires PORTAL_TEST_ENABLED and SCRAPER_TEST_HOOKS together, so a
   * normal deployment never registers the routes at all.
   */
  enableTestHooks?: boolean;
  /**
   * Shared secret required by state-changing endpoints. Defaults to
   * config.api.token. An empty value is only tolerated outside production
   * (boot calls assertApiSecurity(), which fails closed there).
   */
  authToken?: string;
  /** Browser origins allowed to call the API; defaults to config. */
  allowedOrigins?: string[];
}

// ---------------------------------------------------------------------------
// Create API server
// ---------------------------------------------------------------------------

function getSchedulerRunning(scheduler?: SchedulerLike): boolean {
  if (!scheduler) return false;
  if (typeof scheduler.isRunning === 'function') return scheduler.isRunning();
  return scheduler.isRunning ?? false;
}

function readCount(
  value: number | (() => number) | undefined,
): number | null {
  if (value === undefined) return null;
  return typeof value === 'function' ? value() : value;
}

function getRegisteredCronCount(scheduler?: SchedulerLike): number | null {
  if (!scheduler || scheduler.registeredCronCount === undefined) return null;
  return typeof scheduler.registeredCronCount === 'function'
    ? scheduler.registeredCronCount()
    : scheduler.registeredCronCount;
}

/**
 * Readiness decision, separated from Express so it can be unit-tested.
 *
 * `/api/health` answers "is this process alive" (liveness). It returned 200
 * even when the scheduler had never started — notably when Redis was
 * unavailable at boot, where main() logs a warning, skips scheduling entirely
 * and still serves the API. The container therefore reported healthy while
 * nothing was ever scraped. Readiness answers the question that actually
 * matters: "is recurring scheduling operating".
 */
export function evaluateReadiness(input: {
  schedulerConfigured: boolean;
  schedulerRunning: boolean;
  queueReachable: boolean | null;
  /**
   * Total registered crons, portal and internal together.
   *
   * Retained for callers that cannot distinguish the two. It is a poor
   * readiness signal on its own — see `portalCronCount`.
   */
  registeredCronCount: number | null;
  /**
   * Registered PORTAL crons only.
   *
   * start() always registers `__full_rescrape__` and `__retry_failed__`, so
   * `registeredCronCount` never drops below 2 and its zero-check was dead code:
   * a scheduler with no portal scheduled at all still answered ready. When this
   * is provided it takes precedence.
   */
  portalCronCount?: number | null;
  /** Internal maintenance crons, reported for visibility. */
  internalCronCount?: number | null;
  /**
   * How many portals are currently enabled and therefore SHOULD have a cron.
   * Lets "an operator disabled everything" be told apart from "enabled portals
   * are not being scheduled".
   */
  enabledPortalCount?: number | null;
  /** An administrator deliberately paused scheduling. */
  paused?: boolean;
}): { ready: boolean; reason: string } {
  if (!input.schedulerConfigured) {
    return {
      ready: false,
      reason: 'scheduler not configured (Redis was unavailable at startup)',
    };
  }
  if (input.paused) {
    // Deliberate operator state, not a failure: the container is working as
    // instructed, so it must not be restarted by the healthcheck.
    //
    // This MUST be tested before `schedulerRunning`. Pausing via
    // POST /api/scheduler/stop sets `paused` AND stops the scheduler, so
    // `schedulerRunning` is false for every real pause. With the checks in the
    // other order this branch was unreachable in production: a deliberate
    // pause answered 503 "scheduler is not running", the healthcheck marked
    // the container unhealthy, and the very restart this comment warns about
    // became possible. Unit tests missed it because they paired
    // `paused: true` with `schedulerRunning: true` — a state the API never
    // produces.
    return { ready: true, reason: 'scheduling paused by an administrator' };
  }
  if (!input.schedulerRunning) {
    return { ready: false, reason: 'scheduler is not running' };
  }
  if (input.queueReachable === false) {
    return { ready: false, reason: 'job queue is unreachable' };
  }

  const portalCrons = input.portalCronCount ?? null;

  if (portalCrons !== null) {
    // Every portal disabled is an operator decision, so the container is
    // healthy — reporting it as broken would have a healthcheck restart a
    // correctly-configured scraper in a loop.
    if (input.enabledPortalCount === 0) {
      return { ready: true, reason: 'no portals are enabled' };
    }

    if (portalCrons === 0) {
      return {
        ready: false,
        reason:
          input.enabledPortalCount != null
            ? `${input.enabledPortalCount} portal(s) are enabled but none has a registered cron`
            : 'no portal cron schedules are registered',
      };
    }

    return { ready: true, reason: 'scheduler running' };
  }

  // Fallback for a caller that cannot separate portal from internal crons.
  if (input.registeredCronCount !== null && input.registeredCronCount === 0) {
    return { ready: false, reason: 'no cron schedules are registered' };
  }
  return { ready: true, reason: 'scheduler running' };
}

/**
 * What actually happened when a manual run was requested.
 *
 * `onTriggerRun` used to return `Promise<void>`, so the endpoint could not tell
 * a real enqueue from a refusal and answered
 * `200 {"message":"Scraping job queued"}` either way. Phase 8 caught it live:
 * the scheduler logged `Skipping testportal (manual) - a run is already queued
 * or in progress` while the API reported success, so an operator pressing
 * "run now" was told the job was queued when nothing had been.
 */
export type TriggerRunOutcome =
  /** A new job was added to the queue. */
  | { status: 'queued'; jobId?: string }
  /** Refused: this portal already has a run queued or in progress. */
  | { status: 'already-running'; jobId?: string }
  /** The scheduler is down, so the scrape was started in-process instead. */
  | { status: 'started-inline' };

export function createAdminApi(options: AdminApiOptions): { app: express.Express; start: () => Promise<void> } {
  const app = express();
  const { storageWriter, scheduler, onTriggerRun } = options;
  const port = options.port ?? config.api.port;
  const authToken = (options.authToken ?? config.api.token).trim();
  const testHooksEnabled = options.enableTestHooks ?? config.testHooksEnabled;
  const allowedOrigins = options.allowedOrigins ?? config.api.allowedOrigins;

  app.use(express.json());

  // -----------------------------------------------------------------------
  // CORS — explicit allow-list, nothing by default
  //
  // Previously every response carried `Access-Control-Allow-Origin: *`. This
  // API is service-to-service (api-server calls it over the Compose network),
  // so by default no CORS headers are emitted at all. Browser access is opt-in
  // through SCRAPER_API_ALLOWED_ORIGINS. CORS is not a substitute for the
  // token check below; it only governs which pages a browser will let read a
  // response.
  // -----------------------------------------------------------------------
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Scraper-Api-Token',
      );
    }

    if (req.method === 'OPTIONS') {
      // Preflight for a disallowed (or absent) origin gets no allow headers,
      // so the browser blocks the real request.
      res.sendStatus(origin && allowedOrigins.includes(origin) ? 204 : 403);
      return;
    }

    next();
  });

  // -----------------------------------------------------------------------
  // Authentication — required for everything except health and readiness
  // -----------------------------------------------------------------------
  if (authToken === '') {
    logger.warn(
      'SCRAPER_API_TOKEN is not set: control endpoints are UNAUTHENTICATED. ' +
        'This is permitted only outside production (boot fails closed in production).',
    );
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }

    // No secret configured (development only): behave as before.
    if (authToken === '') {
      next();
      return;
    }

    const provided = extractToken(
      req.headers as { authorization?: string; 'x-scraper-api-token'?: string },
    );

    if (!tokensMatch(provided, authToken)) {
      logger.warn('Rejected unauthenticated control-API request', {
        method: req.method,
        path: req.path,
        // Deliberately no token material, and no client IP beyond what the
        // access log already records.
        hadCredentials: provided !== '',
      });
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid scraper API token required' },
      });
      return;
    }

    next();
  });

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const healthData = await storageWriter.getAllHealth();
      const unhealthy = healthData.filter((h) => h.status === 'UNHEALTHY');
      const degraded = healthData.filter((h) => h.status === 'DEGRADED');

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (unhealthy.length > 0) overallStatus = 'unhealthy';
      else if (degraded.length > 0) overallStatus = 'degraded';

      res.json({
        success: true,
        data: {
          status: overallStatus,
          totalPortals: PORTAL_CONFIGS.length,
          enabledPortals: PORTAL_CONFIGS.filter((p) => p.enabled).length,
          unhealthyPortals: unhealthy.length,
          degradedPortals: degraded.length,
          schedulerRunning: getSchedulerRunning(scheduler),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  // -----------------------------------------------------------------------
  // Readiness — is recurring scheduling actually operating?
  //
  // This is what the container healthcheck uses. Unauthenticated (the
  // healthcheck has no secret) and read-only.
  // -----------------------------------------------------------------------

  app.get('/api/ready', async (_req: Request, res: Response) => {
    const schedulerConfigured = Boolean(scheduler);
    const schedulerRunning = getSchedulerRunning(scheduler);

    let queueReachable: boolean | null = null;
    let queue: Awaited<ReturnType<NonNullable<SchedulerLike['getQueueStatus']>>> | null = null;

    if (schedulerRunning && scheduler?.getQueueStatus) {
      try {
        // Bounded: ioredis keeps retrying a dead server, so an unbounded await
        // left this endpoint HANGING when Redis was down instead of reporting
        // not-ready. A probe that never answers is as unhelpful as one that
        // lies — the container healthcheck would only catch it by timing out.
        queue = await Promise.race([
          scheduler.getQueueStatus(),
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error(`queue status timed out after ${QUEUE_PROBE_TIMEOUT_MS}ms`)),
              QUEUE_PROBE_TIMEOUT_MS,
            ).unref?.(),
          ),
        ]);
        queueReachable = true;
      } catch (err) {
        queueReachable = false;
        logger.error('Readiness probe: queue unreachable', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const registeredCronCount = getRegisteredCronCount(scheduler);
    const portalCronCount = readCount(scheduler?.portalCronCount);
    const internalCronCount = readCount(scheduler?.internalCronCount);
    const paused = scheduler?.isPaused ?? false;

    // How many portals SHOULD be scheduled. Reads the authoritative schedule
    // set, so it is bounded like the queue probe: a hung lookup must report
    // not-ready rather than leave the healthcheck hanging.
    let enabledPortalCount: number | null = null;
    if (schedulerRunning && scheduler?.enabledPortalCount) {
      try {
        enabledPortalCount = await Promise.race([
          scheduler.enabledPortalCount(),
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error(`enabled-portal probe timed out after ${QUEUE_PROBE_TIMEOUT_MS}ms`)),
              QUEUE_PROBE_TIMEOUT_MS,
            ).unref?.(),
          ),
        ]);
      } catch (err) {
        logger.error('Readiness probe: enabled-portal count unavailable', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const { ready, reason } = evaluateReadiness({
      schedulerConfigured,
      schedulerRunning,
      queueReachable,
      registeredCronCount,
      portalCronCount,
      internalCronCount,
      enabledPortalCount,
      paused,
    });

    res.status(ready ? 200 : 503).json({
      success: ready,
      data: {
        ready,
        reason,
        schedulerConfigured,
        schedulerRunning,
        paused,
        registeredCronCount,
        // Reported separately so an operator can see at a glance that the two
        // internal maintenance crons are not standing in for portal schedules.
        portalCronCount,
        internalCronCount,
        enabledPortalCount,
        queueReachable,
        queue,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  });

  // -----------------------------------------------------------------------
  // Portal management
  // -----------------------------------------------------------------------

  app.get('/api/portals', async (_req: Request, res: Response) => {
    try {
      const healthData = await storageWriter.getAllHealth();

      const portals = PORTAL_CONFIGS.map((p) => {
        const health = healthData.find((h) => h.portalName === p.name);
        return {
          key: p.key,
          name: p.name,
          url: p.url,
          type: p.type,
          state: p.state,
          enabled: health?.enabled ?? p.enabled,
          cronExpression: p.cronExpression,
          priority: p.priority,
          health: health
            ? {
                status: health.status,
                lastRunAt: health.lastRunAt,
                lastSuccessAt: health.lastSuccessAt,
                consecutiveFailures: health.consecutiveFailures,
                errorRate: health.errorRate,
                totalRuns: health.totalRuns,
              }
            : null,
        };
      });

      res.json({ success: true, data: portals });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  app.get('/api/portals/:key', async (req: Request, res: Response) => {
    try {
      const portalConfig = getPortalConfig(req.params.key);
      if (!portalConfig) {
        res.status(404).json({ success: false, error: { message: 'Portal not found' } });
        return;
      }

      const [healthData, recentRuns] = await Promise.all([
        storageWriter.getAllHealth(),
        storageWriter.getRecentRuns(portalConfig.name, 10),
      ]);

      const health = healthData.find((h) => h.portalName === portalConfig.name);

      res.json({
        success: true,
        data: {
          config: portalConfig,
          health: health ?? null,
          recentRuns,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  app.post('/api/portals/:key/run', async (req: Request, res: Response) => {
    try {
      const portalConfig = getPortalConfig(req.params.key);
      if (!portalConfig) {
        res.status(404).json({ success: false, error: { message: 'Portal not found' } });
        return;
      }

      if (!onTriggerRun) {
        res.status(501).json({ success: false, error: { message: 'Manual trigger not configured' } });
        return;
      }

      logger.info(`Manual scrape triggered for ${portalConfig.name}`);
      const outcome = await onTriggerRun(req.params.key);

      // Report what actually happened. A refusal is a 409 so the caller can
      // tell it apart from a successful enqueue — api-server relies on this to
      // avoid publishing a duplicate job onto its fallback queue.
      if (outcome.status === 'already-running') {
        logger.warn(`Manual scrape refused for ${portalConfig.name} — run already in progress`, {
          jobId: outcome.jobId,
        });
        res.status(409).json({
          success: false,
          error: {
            code: 'RUN_ALREADY_IN_PROGRESS',
            message:
              `A scraping run for ${portalConfig.name} is already queued or in progress. ` +
              'No new job was queued.',
          },
          data: {
            status: outcome.status,
            portal: portalConfig.name,
            jobId: outcome.jobId,
          },
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          status: outcome.status,
          message:
            outcome.status === 'queued'
              ? `Scraping job queued for ${portalConfig.name}`
              : `Scraping started in-process for ${portalConfig.name} (scheduler unavailable)`,
          portal: portalConfig.name,
          jobId: outcome.status === 'queued' ? outcome.jobId : undefined,
          triggeredAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  app.post('/api/portals/:key/toggle', async (req: Request, res: Response) => {
    try {
      const portalConfig = getPortalConfig(req.params.key);
      if (!portalConfig) {
        res.status(404).json({ success: false, error: { message: 'Portal not found' } });
        return;
      }

      const { enabled } = req.body as { enabled: boolean };
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, error: { message: 'enabled must be a boolean' } });
        return;
      }

      await storageWriter.togglePortal(portalConfig.name, enabled);

      logger.info(`Portal ${portalConfig.name} ${enabled ? 'enabled' : 'disabled'}`);

      res.json({
        success: true,
        data: {
          portal: portalConfig.name,
          enabled,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  // -----------------------------------------------------------------------
  // Runs
  // -----------------------------------------------------------------------

  app.get('/api/runs', async (req: Request, res: Response) => {
    try {
      const portal = req.query.portal as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const runs = await storageWriter.getRecentRuns(portal, Math.min(limit, 100));

      res.json({ success: true, data: runs, meta: { limit } });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  // -----------------------------------------------------------------------
  // Aggregate stats
  // -----------------------------------------------------------------------

  app.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const healthData = await storageWriter.getAllHealth();

      const stats = {
        totalPortals: PORTAL_CONFIGS.length,
        enabledPortals: healthData.filter((h) => h.enabled).length,
        totalRuns: healthData.reduce((sum, h) => sum + h.totalRuns, 0),
        healthBreakdown: {
          healthy: healthData.filter((h) => h.status === 'HEALTHY').length,
          degraded: healthData.filter((h) => h.status === 'DEGRADED').length,
          unhealthy: healthData.filter((h) => h.status === 'UNHEALTHY').length,
          disabled: healthData.filter((h) => h.status === 'DISABLED').length,
        },
        portalStats: healthData.map((h) => ({
          portalName: h.portalName,
          status: h.status,
          totalRuns: h.totalRuns,
          errorRate: h.errorRate,
          consecutiveFailures: h.consecutiveFailures,
          lastRunAt: h.lastRunAt,
        })),
      };

      res.json({ success: true, data: stats });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  // -----------------------------------------------------------------------
  // Scheduler control
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Test-only hooks
  //
  // Not registered at all unless explicitly enabled (see
  // config.testHooksEnabled). The failed-job retry sweep's only production
  // trigger is an hourly cron, so the in-container verification of that path
  // would otherwise have to wait up to an hour or mutate the production cron.
  // This route still goes through the normal authentication middleware.
  // -----------------------------------------------------------------------
  if (testHooksEnabled) {
    logger.warn(
      'TEST HOOKS ENABLED — POST /api/test/retry-failed-jobs is registered. ' +
        'This requires PORTAL_TEST_ENABLED and SCRAPER_TEST_HOOKS together and ' +
        'must never be set in a real deployment.',
    );

    app.post('/api/test/retry-failed-jobs', async (_req: Request, res: Response) => {
      if (!scheduler?.retryFailedJobs) {
        res.status(501).json({
          success: false,
          error: { code: 'NOT_AVAILABLE', message: 'Scheduler cannot run the retry sweep' },
        });
        return;
      }

      try {
        // The real sweep, unchanged — the hook only chooses WHEN it runs, never
        // what it does. It cannot mark a job successful or fabricate a run.
        const retried = await scheduler.retryFailedJobs();
        res.json({ success: true, data: { retried } });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: { message: err instanceof Error ? err.message : 'Internal error' },
        });
      }
    });
  }

  app.post('/api/scheduler/start', async (_req: Request, res: Response) => {
    try {
      if (!scheduler) {
        res.status(501).json({ success: false, error: { message: 'Scheduler not configured' } });
        return;
      }

      if (getSchedulerRunning(scheduler)) {
        // Already running but paused: clear the pause and re-register crons.
        if (scheduler.isPaused && scheduler.setPaused) {
          await scheduler.setPaused(false);
          logger.info('Scheduler un-paused via API');
          res.json({
            success: true,
            data: { message: 'Scheduler resumed', paused: false },
          });
          return;
        }
        res.json({ success: true, data: { message: 'Scheduler already running' } });
        return;
      }

      // Clear the persisted pause BEFORE starting, so start() does not restore
      // it and immediately register nothing.
      if (scheduler.setPaused) await scheduler.setPaused(false);
      await scheduler.start();
      logger.info('Scheduler started via API');

      res.json({
        success: true,
        data: { message: 'Scheduler started', paused: false },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  app.post('/api/scheduler/stop', async (_req: Request, res: Response) => {
    try {
      if (!scheduler) {
        res.status(501).json({ success: false, error: { message: 'Scheduler not configured' } });
        return;
      }

      await scheduler.stop();
      // Persist the decision: without this, the next container restart silently
      // resumed scraping because stop() only cleared in-memory state.
      if (scheduler.setPaused) await scheduler.setPaused(true);
      logger.info('Scheduler stopped via API (pause persisted)');

      res.json({
        success: true,
        data: {
          message: 'Scheduler stopped',
          paused: true,
          note: 'Scheduling stays paused across restarts until it is started again.',
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  // -----------------------------------------------------------------------
  // 404 handler
  // -----------------------------------------------------------------------

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: { message: 'Not found' } });
  });

  // -----------------------------------------------------------------------
  // Error handler
  // -----------------------------------------------------------------------

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled API error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  });

  // -----------------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------------

  function start(): Promise<void> {
    return new Promise((resolve) => {
      app.listen(port, () => {
        logger.info(`Admin API listening on port ${port}`);
        resolve();
      });
    });
  }

  return { app, start };
}
