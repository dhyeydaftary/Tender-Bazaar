/**
 * Scraper Admin API
 *
 * Lightweight Express server for managing and monitoring the scraper engine.
 * Runs on a separate port (default 4001) from the main API.
 *
 * Endpoints:
 *   GET  /api/health            — Overall engine health check
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

import express, { Request, Response, NextFunction } from 'express';
import { StorageWriter } from '../storage/writer';
import { PORTAL_CONFIGS, getPortalConfig, config } from '../config';
import { createLogger } from '../utils/logger';
// The scheduler type is loosely coupled — we only need start/stop/isRunning
interface SchedulerLike {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning?: boolean | (() => boolean);
}

const logger = createLogger('AdminAPI');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminApiOptions {
  port?: number;
  storageWriter: StorageWriter;
  scheduler?: SchedulerLike;
  onTriggerRun?: (portalKey: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Create API server
// ---------------------------------------------------------------------------

function getSchedulerRunning(scheduler?: SchedulerLike): boolean {
  if (!scheduler) return false;
  if (typeof scheduler.isRunning === 'function') return scheduler.isRunning();
  return scheduler.isRunning ?? false;
}

export function createAdminApi(options: AdminApiOptions): { app: express.Express; start: () => Promise<void> } {
  const app = express();
  const { storageWriter, scheduler, onTriggerRun } = options;
  const port = options.port ?? config.api.port;

  app.use(express.json());

  // CORS for development
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
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
      await onTriggerRun(req.params.key);

      res.json({
        success: true,
        data: {
          message: `Scraping job queued for ${portalConfig.name}`,
          portal: portalConfig.name,
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

  app.post('/api/scheduler/start', async (_req: Request, res: Response) => {
    try {
      if (!scheduler) {
        res.status(501).json({ success: false, error: { message: 'Scheduler not configured' } });
        return;
      }

      if (getSchedulerRunning(scheduler)) {
        res.json({ success: true, data: { message: 'Scheduler already running' } });
        return;
      }

      await scheduler.start();
      logger.info('Scheduler started via API');

      res.json({ success: true, data: { message: 'Scheduler started' } });
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
      logger.info('Scheduler stopped via API');

      res.json({ success: true, data: { message: 'Scheduler stopped' } });
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
