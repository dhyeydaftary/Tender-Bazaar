/**
 * Missed-window detection for portal schedules.
 *
 * Why this exists: `node-cron` fires on a timer and **never replays a tick it
 * missed**. Phase 8 observed this live — the test portal fired at 09:10, 09:12
 * and 09:14, then nothing at 09:16 or 09:18, then resumed at 09:20. No
 * `Cron triggered` line existed for the gap, because the timer callback simply
 * did not run: the host had frozen the container (Elasticsearch in the same
 * stack logged a 6.2s sleep on the ABSOLUTE clock, and the scraper lost
 * Postgres connectivity for ~40s). Two scheduled runs vanished with no error,
 * no catch-up and nothing to alert on.
 *
 * On a modest VPS that is a plausible steady state, so the gap has to be
 * detected from persisted state rather than from in-process timers.
 *
 * ── Why this module rather than api-server's cron-schedule.ts ──────────────
 * `packages/api-server/src/shared/utils/cron-schedule.ts` already implements
 * compatible UTC cron maths, and reusing it was the first choice. It is not
 * importable here: `@tenderbazaar/shared` is an orphan package that nothing
 * currently depends on, so routing through it would mean making scraper-engine
 * its first consumer (package.json, lockfile, tsconfig paths and a rebuild of
 * every image) — disproportionate to the need, and this module additionally
 * needs to enumerate SEVERAL past windows, which that utility does not do.
 *
 * The duplication risk is real and is mitigated deliberately: both
 * implementations are pinned to the same expression corpus by their tests
 * (see tests/missed-windows.test.ts), so a divergence in cron semantics fails
 * a suite instead of silently mis-scheduling.
 *
 * Everything here is UTC, matching CRON_TIMEZONE in scheduler.ts.
 */

/** Parsed 5-field cron expression. Minute, hour, day-of-month, month, day-of-week. */
interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

const FIELD_RANGES: Array<[keyof CronFields, number, number]> = [
  ['minutes', 0, 59],
  ['hours', 0, 23],
  ['daysOfMonth', 1, 31],
  ['months', 1, 12],
  ['daysOfWeek', 0, 6],
];

/**
 * Expand one cron field into the set of values it matches.
 *
 * Supports `*`, `*​/n`, `a-b`, `a-b/n` and comma lists — which is everything
 * PORTAL_CONFIGS uses. Names (JAN/MON), @-shorthands and a seconds field are
 * deliberately unsupported and reported as invalid rather than mis-scheduled.
 */
function expandField(raw: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();

  for (const part of raw.split(',')) {
    const token = part.trim();
    if (token === '') return null;

    const [range, stepRaw] = token.split('/');
    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1) return null;
    }

    let from: number;
    let to: number;

    if (range === '*') {
      from = min;
      to = max;
    } else if (range !== undefined && range.includes('-')) {
      const [a, b] = range.split('-');
      from = Number(a);
      to = Number(b);
      if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    } else {
      from = Number(range);
      to = from;
      if (!Number.isInteger(from)) return null;
    }

    if (from < min || to > max || from > to) return null;

    for (let v = from; v <= to; v += step) values.add(v);
  }

  return values.size > 0 ? values : null;
}

/** Parse an expression, or null when it is not supported. */
export function parseCron(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const fields: Partial<CronFields> = {};
  for (let i = 0; i < FIELD_RANGES.length; i++) {
    const [name, min, max] = FIELD_RANGES[i]!;
    const expanded = expandField(parts[i]!, min, max);
    if (!expanded) return null;
    fields[name] = expanded;
  }

  return fields as CronFields;
}

function matches(fields: CronFields, at: Date): boolean {
  // Standard cron: when BOTH day-of-month and day-of-week are restricted the
  // match is a union, not an intersection.
  const domRestricted = fields.daysOfMonth.size !== 31;
  const dowRestricted = fields.daysOfWeek.size !== 7;

  const dayMatches =
    domRestricted && dowRestricted
      ? fields.daysOfMonth.has(at.getUTCDate()) || fields.daysOfWeek.has(at.getUTCDay())
      : fields.daysOfMonth.has(at.getUTCDate()) && fields.daysOfWeek.has(at.getUTCDay());

  return (
    fields.minutes.has(at.getUTCMinutes()) &&
    fields.hours.has(at.getUTCHours()) &&
    fields.months.has(at.getUTCMonth() + 1) &&
    dayMatches
  );
}

/** How far back to search before giving up, in minutes (≈ 60 days). */
const MAX_LOOKBACK_MINUTES = 60 * 24 * 60;

/**
 * Most missed windows this module will count in one report.
 *
 * Only affects the REPORTED size of a gap, never how many catch-up runs are
 * enqueued (that is `maxCatchUp`). A 2-minute cadence produces 720 windows a
 * day, so a multi-day outage exceeds this; the report then sets
 * `countTruncated` and the number is logged as a floor.
 */
const GAP_COUNT_LIMIT = 500;

/**
 * The scheduled windows at or before `from`, most recent first.
 *
 * Walks minute by minute, which is cheap for the cadences in use and avoids a
 * second, subtly different cron implementation for the reverse direction.
 */
export function previousCronWindows(
  expression: string,
  from: Date,
  count: number,
): Date[] {
  const fields = parseCron(expression);
  if (!fields || count <= 0) return [];

  const found: Date[] = [];
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);

  for (let i = 0; i < MAX_LOOKBACK_MINUTES && found.length < count; i++) {
    if (matches(fields, cursor)) found.push(new Date(cursor.getTime()));
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1);
  }

  return found;
}

export interface MissedWindowOptions {
  /** The portal's cron expression. */
  expression: string | null | undefined;
  /** Last attempted run, from ScraperHealth.lastRunAt. Null when never run. */
  lastRunAt: Date | null | undefined;
  now?: Date;
  /**
   * How long a closed window is forgiven before it counts as missed. Must
   * comfortably exceed a normal run plus queue latency, or a run that is merely
   * in flight is reported as a miss.
   */
  graceMs?: number;
  /**
   * Hard cap on catch-up runs enqueued per portal per sweep.
   *
   * Bounded on purpose. After a long outage an unbounded backlog would hammer
   * the portal, and re-scraping the same listing pages N times yields nothing
   * the deduplicator does not already collapse — one catch-up brings the data
   * current. Windows beyond the cap are reported as unrecoverable rather than
   * silently dropped.
   */
  maxCatchUp?: number;
}

export interface MissedWindowReport {
  /** Windows that qualify for catch-up, oldest first. At most `maxCatchUp`. */
  missed: Date[];
  /** Qualifying windows dropped because of the cap — an unrecoverable gap. */
  unrecoverable: number;
  /**
   * True when the gap was larger than this module will enumerate, so
   * `unrecoverable` is a floor rather than an exact count. Logged as "at least
   * N" so a very long outage is never understated.
   */
  countTruncated?: boolean;
  /** The most recent closed window considered, or null when none applies. */
  previousWindow: Date | null;
  /** Machine-readable outcome, for logging and tests. */
  status:
    | 'current'            // nothing missed
    | 'missed'             // at least one window qualifies
    | 'within-grace'       // window closed too recently to judge
    | 'no-schedule'        // no cron configured
    | 'invalid-expression'; // cron present but unparseable
}

/**
 * Decide whether a portal has missed scheduled windows, and which qualify.
 *
 * Pure: no Redis, no Postgres, no timers. Everything it needs is passed in, so
 * the policy is testable without infrastructure.
 */
export function detectMissedWindows(options: MissedWindowOptions): MissedWindowReport {
  const {
    expression,
    lastRunAt,
    now = new Date(),
    graceMs = 90_000,
    maxCatchUp = 1,
  } = options;

  if (!expression || expression.trim() === '') {
    return { missed: [], unrecoverable: 0, previousWindow: null, status: 'no-schedule' };
  }

  if (!parseCron(expression)) {
    // Surfaced rather than treated as "nothing missed": an unparseable cron
    // means the portal is not being scheduled at all, which an operator needs
    // to know about.
    return {
      missed: [],
      unrecoverable: 0,
      previousWindow: null,
      status: 'invalid-expression',
    };
  }

  const [previousWindow] = previousCronWindows(expression, now, 1);
  if (!previousWindow) {
    return { missed: [], unrecoverable: 0, previousWindow: null, status: 'current' };
  }

  if (now.getTime() - previousWindow.getTime() < graceMs) {
    return { missed: [], unrecoverable: 0, previousWindow, status: 'within-grace' };
  }

  // Never run: nothing has been MISSED, so nothing is caught up.
  //
  // The tempting alternative — treat the most recent window as catchable — has
  // a nasty consequence. All 13 registry portals default to enabled, and on a
  // fresh deployment every one of them has lastRunAt = null, so the first sweep
  // would immediately fire a run at all 13 real government portals instead of
  // letting their own cron bring them up gradually. A recovery mechanism must
  // not become an unprompted mass scrape on first boot.
  //
  // A portal that has genuinely never run gets its first run from its cron;
  // from then on lastRunAt exists and real gaps are detectable.
  if (!lastRunAt) {
    return { missed: [], unrecoverable: 0, previousWindow, status: 'current' };
  }

  if (lastRunAt.getTime() >= previousWindow.getTime()) {
    return { missed: [], unrecoverable: 0, previousWindow, status: 'current' };
  }

  // Enumerate the closed windows newer than the last run.
  //
  // Fetching only `maxCatchUp + 1` would cap `unrecoverable` at 1 and so
  // under-report a long outage — the opposite of making the gap visible. Count
  // up to GAP_COUNT_LIMIT instead, and say plainly when even that was not
  // enough.
  const probe = previousCronWindows(expression, now, GAP_COUNT_LIMIT);
  const qualifying = probe.filter(
    (w) => w.getTime() > lastRunAt.getTime() && now.getTime() - w.getTime() >= graceMs,
  );

  const missed = qualifying.slice(0, maxCatchUp).reverse(); // oldest first
  const unrecoverable = Math.max(0, qualifying.length - missed.length);

  return {
    missed,
    unrecoverable,
    previousWindow,
    status: missed.length > 0 ? 'missed' : 'current',
    ...(qualifying.length >= GAP_COUNT_LIMIT ? { countTruncated: true } : {}),
  };
}
