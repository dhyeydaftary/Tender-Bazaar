import assert from 'node:assert/strict';

import {
  detectMissedWindows,
  parseCron,
  previousCronWindows,
} from '../scheduler/missed-windows';
import { PORTAL_CONFIGS } from '../config';

/**
 * Missed-window detection policy.
 *
 * Pure tests: detectMissedWindows() takes everything it needs as arguments, so
 * the policy is pinned without Redis, Postgres or timers. The scheduler-side
 * integration (pause, disable, locking, no-duplicate) is covered by
 * missed-windows-sweep.test.ts, which needs a real Redis.
 *
 * Phase 8 context: node-cron lost the 09:16 and 09:18 firings to a host freeze
 * with no error and no replay. These tests describe what we now do about it.
 */

const CRON_2MIN = '*/2 * * * *';
const AT = (iso: string) => new Date(iso);

console.log('--- Starting Missed-Window Detection Tests ---');

// 0. Cron semantics agree with the corpus api-server's cron-schedule.test.ts
//    pins, and with every expression the portal registry actually uses.
//
//    This is the drift guard. The two implementations are deliberately separate
//    (see the header of missed-windows.ts); if either changes meaning, one of
//    the two suites fails rather than the scheduler silently mis-firing.
{
  const CORPUS: Array<[expression: string, from: string, expectedPrevious: string]> = [
    ['*/2 * * * *', '2026-10-16T09:19:30Z', '2026-10-16T09:18:00Z'],
    ['0 */2 * * *', '2026-10-16T09:19:30Z', '2026-10-16T08:00:00Z'],
    ['0 */4 * * *', '2026-10-16T09:19:30Z', '2026-10-16T08:00:00Z'],
    ['30 */4 * * *', '2026-10-16T09:19:30Z', '2026-10-16T08:30:00Z'],
    ['0 */6 * * *', '2026-10-16T09:19:30Z', '2026-10-16T06:00:00Z'],
    ['10 */6 * * *', '2026-10-16T09:19:30Z', '2026-10-16T06:10:00Z'],
    ['0 1,7,13,19 * * *', '2026-10-16T09:19:30Z', '2026-10-16T07:00:00Z'],
    ['30 1,7,13,19 * * *', '2026-10-16T00:05:00Z', '2026-10-15T19:30:00Z'],
    ['30 20 * * *', '2026-10-16T09:19:30Z', '2026-10-15T20:30:00Z'],
    // Day rollover backwards.
    ['0 */2 * * *', '2026-10-16T00:30:00Z', '2026-10-16T00:00:00Z'],
    ['30 */4 * * *', '2026-10-16T00:05:00Z', '2026-10-15T20:30:00Z'],
  ];

  for (const [expression, from, expected] of CORPUS) {
    const [previous] = previousCronWindows(expression, AT(from), 1);
    assert.ok(previous, `${expression} must resolve a previous window from ${from}`);
    assert.equal(
      previous!.toISOString(),
      AT(expected).toISOString(),
      `${expression} from ${from}`,
    );
  }

  // Every registry expression must parse, or that portal is not scheduled.
  for (const portal of PORTAL_CONFIGS) {
    assert.ok(
      parseCron(portal.cronExpression),
      `registry portal '${portal.key}' has an unparseable cron: ${portal.cronExpression}`,
    );
  }

  console.log(
    `✓ Cron maths matches the pinned corpus (${CORPUS.length} cases) and all ` +
      `${PORTAL_CONFIGS.length} registry expressions parse`,
  );
}

// 1. One missed interval.
{
  const report = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:14:00Z'),
    now: AT('2026-10-16T09:17:30Z'),
  });

  assert.equal(report.status, 'missed');
  assert.equal(report.missed.length, 1, 'exactly one window qualifies');
  assert.equal(report.missed[0]!.toISOString(), '2026-10-16T09:16:00.000Z');
  assert.equal(report.unrecoverable, 0);

  console.log('✓ A single missed interval is detected, with the exact window');
}

// 2. Multiple missed intervals are capped, and the remainder is reported as an
//    unrecoverable gap rather than dropped silently.
{
  const report = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:00:00Z'),
    now: AT('2026-10-16T09:21:40Z'),
    maxCatchUp: 1,
  });

  assert.equal(report.status, 'missed');
  assert.equal(report.missed.length, 1, 'catch-up is capped at maxCatchUp');
  assert.ok(report.unrecoverable >= 8, `expected a sizeable gap, got ${report.unrecoverable}`);

  // A raised cap catches up more, still bounded.
  const wider = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:00:00Z'),
    now: AT('2026-10-16T09:21:40Z'),
    maxCatchUp: 3,
  });
  assert.equal(wider.missed.length, 3);
  assert.ok(wider.unrecoverable < report.unrecoverable);
  // Oldest first, so catch-up replays in chronological order.
  assert.ok(
    wider.missed[0]!.getTime() < wider.missed[2]!.getTime(),
    'missed windows must be ordered oldest-first',
  );

  console.log('✓ Multiple missed intervals are bounded by maxCatchUp; the remainder is reported');
}

// 3. A very long outage does not under-report the gap.
{
  const report = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-10T00:00:00Z'),
    now: AT('2026-10-16T09:21:40Z'),
    maxCatchUp: 1,
  });

  assert.equal(report.missed.length, 1);
  assert.ok(report.countTruncated, 'a multi-day gap at 2-minute cadence must be truncated');
  assert.ok(
    report.unrecoverable >= 400,
    `the gap must be reported as large, got ${report.unrecoverable}`,
  );

  console.log('✓ A multi-day outage reports a floor on the gap rather than understating it');
}

// 4. No catch-up when the last run is already current.
{
  const report = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:18:00Z'),
    now: AT('2026-10-16T09:19:40Z'),
  });

  assert.equal(report.status, 'current');
  assert.deepEqual(report.missed, []);
  assert.equal(report.unrecoverable, 0);

  console.log('✓ No catch-up when the most recent window has already run');
}

// 5. The grace period protects a run that is merely in flight.
{
  const justClosed = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:14:00Z'),
    now: AT('2026-10-16T09:16:20Z'),
    graceMs: 90_000,
  });

  assert.equal(
    justClosed.status,
    'within-grace',
    'a window that closed 20s ago must not be judged missed',
  );
  assert.deepEqual(justClosed.missed, []);

  // Past the grace period, the same state is a miss.
  const matured = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:14:00Z'),
    now: AT('2026-10-16T09:17:40Z'),
    graceMs: 90_000,
  });
  assert.equal(matured.status, 'missed');

  console.log('✓ The grace period prevents an in-flight run from being called a miss');
}

// 6. Invalid cron configuration is surfaced, not silently treated as healthy.
{
  for (const bad of [
    'not a cron',
    '*/2 * * *',           // four fields
    '*/2 * * * * *',       // six fields
    '99 * * * *',          // minute out of range
    '0 0 * * MON',         // names unsupported
    '@hourly',             // shorthands unsupported
    '*/0 * * * *',         // zero step
    '',
  ]) {
    const report = detectMissedWindows({
      expression: bad,
      lastRunAt: null,
      now: AT('2026-10-16T09:20:00Z'),
    });
    assert.ok(
      report.status === 'invalid-expression' || report.status === 'no-schedule',
      `'${bad}' must be reported as invalid/absent, got '${report.status}'`,
    );
    assert.deepEqual(report.missed, [], `'${bad}' must never produce catch-up runs`);
  }

  console.log('✓ Invalid or absent cron expressions are surfaced and never produce catch-up');
}

// 7. A portal that has never run is NOT caught up.
//
//    All 13 registry portals default to enabled and start with lastRunAt=null,
//    so catching up a never-run portal would turn the first sweep after a fresh
//    deployment into an immediate scrape of all 13 real portals. Recovery must
//    not become an unprompted mass scrape; the first run comes from the cron.
{
  const report = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: null,
    now: AT('2026-10-16T09:21:40Z'),
    maxCatchUp: 5,
  });

  assert.equal(report.status, 'current', 'a never-run portal has missed nothing');
  assert.deepEqual(report.missed, []);
  assert.equal(report.unrecoverable, 0);

  console.log('✓ A never-run portal is not caught up (no mass scrape on first boot)');
}

// 8. Detection is restart-safe: it depends only on persisted lastRunAt and the
//    cron expression, never on in-process state.
{
  const asIfAfterRestart = detectMissedWindows({
    expression: CRON_2MIN,
    lastRunAt: AT('2026-10-16T09:14:00Z'), // from ScraperHealth, survives restart
    // 100s past the 09:20 window, so it is outside the 90s grace and genuinely
    // judgeable rather than possibly still in flight.
    now: AT('2026-10-16T09:21:40Z'),
    maxCatchUp: 1,
  });

  assert.equal(asIfAfterRestart.status, 'missed');
  assert.equal(asIfAfterRestart.missed.length, 1);
  assert.ok(
    asIfAfterRestart.unrecoverable >= 1,
    'a gap spanning a restart is still visible',
  );

  console.log('✓ Detection relies only on persisted state, so it survives a restart');
}

console.log('--- All Missed-Window Detection Tests Passed ---');
