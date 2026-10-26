/**
 * Demo Scraper — Entry Point
 *
 * A lightweight stand-in for the real scraper engine, for client demonstrations.
 * It serves the real engine's control-API contract and records simulated runs
 * in the existing ScrapingRun/ScraperHealth tables so the unchanged admin UI
 * shows realistic activity.
 *
 * It never launches a browser, never contacts a tender portal, and never writes
 * tenders. This entry point deliberately imports nothing from scrapers/,
 * scheduler/, storage/tender-index-publisher or index.ts; a test
 * (tests/demo-isolation.test.ts) fails if that changes.
 *
 * Boot refuses unless DEMO_SCRAPER_MODE=true, so this process cannot be started
 * in place of the real engine by accident.
 */

import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { validateApiSecurity } from '../config';
import { createLogger } from '../utils/logger';
import { DEMO_PORTALS } from './demo-portals';
import { DemoRunStore, type DemoDb } from './demo-store';
import { DemoRunner } from './demo-runner';
import { createDemoApi } from './demo-server';
import { parseDemoConfig } from './demo-config';

const logger = createLogger('DemoScraper');

function envInt(key: string, fallback: number): number {
  const parsed = parseInt(process.env[key] ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function main() {
  if (process.env.DEMO_SCRAPER_MODE !== 'true') {
    throw new Error(
      'DEMO_SCRAPER_MODE must be "true" to start the demo scraper. ' +
        'Use the real engine (dist/main.js) for actual scraping.',
    );
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const authToken = (process.env.SCRAPER_API_TOKEN ?? '').trim();
  const problems = validateApiSecurity({ nodeEnv, apiEnabled: true, token: authToken });
  if (problems.length > 0) {
    throw new Error(`Invalid demo scraper configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }

  const port = envInt('SCRAPER_API_PORT', 4001);
  // Validated before connecting: a bad DEMO_* value stops the process here.
  const demoConfig = parseDemoConfig(process.env);
  const scheduleEnabled = demoConfig.scheduleEnabled;

  const prisma = new PrismaClient();
  await prisma.$connect();
  const store = new DemoRunStore(prisma as unknown as DemoDb);

  for (const portal of DEMO_PORTALS) {
    await store.ensurePortal(portal.name, demoConfig.schedules.get(portal.name) ?? null);
  }
  const recovered = await store.recoverInterruptedRuns(DEMO_PORTALS.map((p) => p.name));
  if (recovered > 0) logger.warn('Closed simulated runs left open by a previous process', { count: recovered });

  const runner = new DemoRunner({
    store,
    portals: DEMO_PORTALS,
    concurrency: demoConfig.concurrency,
    failureEvery: demoConfig.failureEvery,
    pageErrorsEvery: demoConfig.pageErrorsEvery,
    startDelayMs: [envInt('DEMO_START_DELAY_MIN_MS', 1500), envInt('DEMO_START_DELAY_MAX_MS', 4000)],
    pageDelayMs: [envInt('DEMO_PAGE_DELAY_MIN_MS', 1800), envInt('DEMO_PAGE_DELAY_MAX_MS', 4200)],
    onError: (portalName, err) =>
      logger.error('Simulated run failed internally', {
        portal: portalName,
        error: err instanceof Error ? err.message : String(err),
      }),
  });

  const tasks: cron.ScheduledTask[] = [];
  if (scheduleEnabled) {
    for (const portal of DEMO_PORTALS) {
      const expression = demoConfig.schedules.get(portal.name);
      if (!expression) continue; // DEMO_CRON_<KEY>=off
      tasks.push(
        cron.schedule(
          expression,
          () => {
            void runner.trigger(portal.key, 'schedule').catch((err) =>
              logger.error('Scheduled simulated run could not start', {
                portal: portal.name,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          },
          { timezone: 'UTC' },
        ),
      );
    }
  }

  const app = createDemoApi({
    runner,
    ping: () => store.ping(),
    authToken,
    scheduleEnabled,
  });
  const server = app.listen(port, () => {
    logger.info('Demo scraper listening — simulated runs only, no portal is contacted', {
      port,
      portals: DEMO_PORTALS.length,
      scheduleEnabled,
      scheduledPortals: tasks.length,
      failureEvery: demoConfig.failureEvery,
      pageErrorsEvery: demoConfig.pageErrorsEvery,
      concurrency: demoConfig.concurrency,
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — cancelling simulated runs and shutting down`);
    tasks.forEach((task) => task.stop());
    server.close();
    await runner.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Demo scraper failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
