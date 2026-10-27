/**
 * Demo scraper control API
 *
 * Serves the same contract as the real engine's api/server.ts for every
 * endpoint api-server actually calls, so api-server needs no demo-specific
 * code path to trigger a run:
 *
 *   GET  /api/health             liveness (public)
 *   GET  /api/ready              readiness (public; container healthcheck)
 *   GET  /api/portals            demo portal list
 *   POST /api/portals/:key/run   202 queued | 404 unknown | 409 already running
 *   GET  /api/runs               not served: run history is read from PostgreSQL
 *
 * Every response that describes activity carries `simulated: true` and
 * `mode: 'demo'`, so any caller can tell a demo engine from a real one.
 * Scheduler and toggle endpoints answer 501 rather than pretending to act.
 *
 * Authentication reuses the real engine's helpers (tokensMatch, extractToken)
 * and the same rule: everything except health and readiness needs the shared
 * SCRAPER_API_TOKEN when one is configured.
 */

import express, { Request, Response, NextFunction } from 'express';
import { tokensMatch, extractToken } from '../api/server';
import { DEMO_PORTALS } from './demo-portals';
import type { DemoRunner } from './demo-runner';

const PUBLIC_PATHS = new Set(['/api/health', '/api/ready']);

export interface DemoApiOptions {
  runner: DemoRunner;
  /** Database liveness probe; failing it makes /api/ready answer 503. */
  ping: () => Promise<void>;
  authToken: string;
  scheduleEnabled: boolean;
}

export function createDemoApi(options: DemoApiOptions): express.Express {
  const app = express();
  const authToken = options.authToken.trim();
  app.use(express.json());

  // Service-to-service API: no CORS headers, preflights refused.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(403);
      return;
    }
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (PUBLIC_PATHS.has(req.path) || authToken === '') {
      next();
      return;
    }
    const provided = extractToken(
      req.headers as { authorization?: string; 'x-scraper-api-token'?: string },
    );
    if (!tokensMatch(provided, authToken)) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'A valid scraper API token is required.' },
      });
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        mode: 'demo',
        simulated: true,
        totalPortals: DEMO_PORTALS.length,
        enabledPortals: DEMO_PORTALS.length,
        unhealthyPortals: 0,
        degradedPortals: 0,
        schedulerRunning: options.scheduleEnabled && !options.runner.isStopping(),
        activeRuns: options.runner.activeRunCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        notice: 'Demo scraper: runs are simulated. No external tender portal is contacted.',
      },
    });
  });

  app.get('/api/ready', async (_req: Request, res: Response) => {
    let databaseReachable = true;
    try {
      await options.ping();
    } catch {
      databaseReachable = false;
    }
    const ready = databaseReachable && !options.runner.isStopping();
    res.status(ready ? 200 : 503).json({
      success: ready,
      data: {
        ready,
        reason: !databaseReachable
          ? 'database is unreachable'
          : options.runner.isStopping()
          ? 'demo scraper is shutting down'
          : 'demo scraper ready (simulated runs only)',
        mode: 'demo',
        simulated: true,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/api/portals', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: DEMO_PORTALS.map((p) => ({
        key: p.key,
        name: p.name,
        label: p.label,
        simulated: true,
        cronExpression: options.scheduleEnabled ? p.cronExpression : null,
      })),
    });
  });

  app.post('/api/portals/:key/run', async (req: Request, res: Response) => {
    try {
      const outcome = await options.runner.trigger(req.params.key, 'manual');
      switch (outcome.status) {
        case 'unknown-portal':
          res.status(404).json({
            success: false,
            error: {
              code: 'DEMO_PORTAL_NOT_FOUND',
              message: `"${req.params.key}" is not a demo portal. The demo scraper only simulates *-Demo portals.`,
            },
          });
          return;
        case 'already-running':
          res.status(409).json({
            success: false,
            error: {
              code: 'RUN_ALREADY_IN_PROGRESS',
              message:
                `A simulated run for ${outcome.portal} is already queued or in progress. ` +
                'No new job was queued.',
            },
            data: { status: outcome.status, portal: outcome.portal, jobId: outcome.runId, simulated: true },
          });
          return;
        case 'stopping':
          res.status(503).json({
            success: false,
            error: { code: 'DEMO_SCRAPER_STOPPING', message: 'The demo scraper is shutting down.' },
          });
          return;
        case 'disabled':
          // Only reachable for scheduled triggers; kept for exhaustiveness.
          res.status(409).json({
            success: false,
            error: { code: 'SCRAPER_DISABLED', message: `${outcome.portal} is disabled.` },
          });
          return;
        case 'queued':
          res.status(202).json({
            success: true,
            data: {
              status: 'queued',
              message: `Simulated scraping run queued for ${outcome.portal}`,
              portal: outcome.portal,
              jobId: outcome.runId,
              runId: outcome.runId,
              simulated: true,
              mode: 'demo',
              triggeredAt: new Date().toISOString(),
            },
          });
          return;
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  const notInDemo = (_req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_AVAILABLE_IN_DEMO',
        message: 'Not available in demo mode. Portal settings are managed through the admin API.',
      },
    });
  };
  app.post('/api/portals/:key/toggle', notInDemo);
  app.post('/api/scheduler/start', notInDemo);
  app.post('/api/scheduler/stop', notInDemo);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: { message: 'Not found' } });
  });

  return app;
}
