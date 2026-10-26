/**
 * Demo scraper configuration, parsed and validated from the environment.
 *
 * Pure, so it can be tested and so a bad value stops the process at boot
 * instead of producing surprising behaviour later.
 *
 *   DEMO_FAILURE_EVERY        every Nth run of a portal fails ([Simulated]); 0 = never. Default 6
 *   DEMO_PAGE_ERRORS_EVERY    every Nth run has 1–2 [Simulated] page errors; 0 = never. Default 3
 *   DEMO_CONCURRENCY          simulated runs at once, 1–2. Default 2
 *   DEMO_SCHEDULE_ENABLED     'true' to run portals on their schedule. Default false
 *   DEMO_CRON_<PORTAL_KEY>    per-portal cron (UTC) or 'off'; e.g. DEMO_CRON_GEM_DEMO.
 *                             Defaults to the portal's built-in 2–6 hour schedule.
 *
 * Schedules must run at most once an hour (the minute field must be a single
 * number), so a mistyped `* * * * *` cannot hammer the demo.
 */

import cron from 'node-cron';
import { DEMO_PORTALS, type DemoPortal } from './demo-portals';
import { MAX_DEMO_CONCURRENCY } from './demo-runner';

export interface DemoConfig {
  failureEvery: number;
  pageErrorsEvery: number;
  concurrency: number;
  scheduleEnabled: boolean;
  /** portal name → cron expression, or null when that portal is not scheduled. */
  schedules: Map<string, string | null>;
}

function nonNegativeInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${key} must be a whole number of 0 or more (got "${raw}").`);
  return parseInt(raw, 10);
}

export function cronEnvKey(portal: DemoPortal): string {
  return `DEMO_CRON_${portal.key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

export function parseDemoConfig(env: NodeJS.ProcessEnv, portals: readonly DemoPortal[] = DEMO_PORTALS): DemoConfig {
  const failureEvery = nonNegativeInt(env, 'DEMO_FAILURE_EVERY', 6);
  const pageErrorsEvery = nonNegativeInt(env, 'DEMO_PAGE_ERRORS_EVERY', 3);
  const concurrency = nonNegativeInt(env, 'DEMO_CONCURRENCY', MAX_DEMO_CONCURRENCY);
  if (concurrency < 1 || concurrency > MAX_DEMO_CONCURRENCY) {
    throw new Error(`DEMO_CONCURRENCY must be between 1 and ${MAX_DEMO_CONCURRENCY} (got ${concurrency}).`);
  }
  const scheduleEnabled = env.DEMO_SCHEDULE_ENABLED?.trim() === 'true';

  const schedules = new Map<string, string | null>();
  for (const portal of portals) {
    const key = cronEnvKey(portal);
    const raw = env[key]?.trim();
    if (!scheduleEnabled || raw === 'off') {
      schedules.set(portal.name, null);
      continue;
    }
    const expression = raw || portal.cronExpression;
    if (!cron.validate(expression)) throw new Error(`${key} is not a valid cron expression ("${expression}").`);
    if (!/^\d{1,2}$/.test(expression.split(/\s+/)[0])) {
      throw new Error(`${key} must run at most once an hour: its minute field must be a single number ("${expression}").`);
    }
    schedules.set(portal.name, expression);
  }

  return { failureEvery, pageErrorsEvery, concurrency, scheduleEnabled, schedules };
}
