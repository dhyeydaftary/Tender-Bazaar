/**
 * Minimal 5-field cron support: validation, next firing and previous firing.
 *
 * Why this exists:
 *   * the admin dashboard accepted ANY string as a portal's cron expression,
 *     stored it, and reported success — the scheduler then silently discarded
 *     it as unparseable, so the portal kept its old cadence;
 *   * `nextRunAt` was never computed or persisted anywhere, so the dashboard
 *     could not show when a portal would next run, nor whether a window had
 *     been missed.
 *
 * Scope is deliberately small: the five standard fields with `*`, `*​/n`,
 * ranges, and comma lists — which is everything the portal registry uses. It is
 * NOT a general cron implementation: no names (JAN/MON), no @-shorthands, and
 * no seconds field. Unsupported input is reported as invalid rather than
 * silently mis-scheduled.
 *
 * All calculations are in UTC, matching the scraper engine, which pins
 * node-cron to UTC (see CRON_TIMEZONE in packages/scraper-engine).
 */

export interface CronFields {
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

/** Expand one cron field into the set of values it matches. */
function parseField(raw: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();

  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (piece === '') return null;

    const [spec, stepText] = piece.split('/');
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText)) return null;
      step = Number(stepText);
      if (step < 1) return null;
    }

    let start: number;
    let end: number;

    if (spec === '*') {
      start = min;
      end = max;
    } else if (/^\d+$/.test(spec)) {
      start = Number(spec);
      end = stepText === undefined ? start : max;
    } else {
      const range = /^(\d+)-(\d+)$/.exec(spec);
      if (!range) return null;
      start = Number(range[1]);
      end = Number(range[2]);
    }

    if (start < min || end > max || start > end) return null;

    for (let value = start; value <= end; value += step) values.add(value);
  }

  return values.size > 0 ? values : null;
}

/** Parse a 5-field expression, or return null when unsupported/invalid. */
export function parseCronExpression(expression: string): CronFields | null {
  if (typeof expression !== 'string') return null;

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const fields: Partial<CronFields> = {};
  for (let index = 0; index < FIELD_RANGES.length; index += 1) {
    const [name, min, max] = FIELD_RANGES[index];
    const parsed = parseField(parts[index], min, max);
    if (!parsed) return null;
    fields[name] = parsed;
  }

  return fields as CronFields;
}

export function isValidCronExpression(expression: string): boolean {
  return parseCronExpression(expression) !== null;
}

/** Does this UTC instant match the expression? (minute resolution) */
function matches(fields: CronFields, date: Date): boolean {
  if (!fields.minutes.has(date.getUTCMinutes())) return false;
  if (!fields.hours.has(date.getUTCHours())) return false;
  if (!fields.months.has(date.getUTCMonth() + 1)) return false;

  // Standard cron semantics: when both day-of-month and day-of-week are
  // restricted, EITHER matching is enough.
  const domRestricted = fields.daysOfMonth.size < 31;
  const dowRestricted = fields.daysOfWeek.size < 7;
  const domMatch = fields.daysOfMonth.has(date.getUTCDate());
  const dowMatch = fields.daysOfWeek.has(date.getUTCDay());

  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true;
}

/** Search horizon: a year covers every expression the registry can express. */
const MAX_MINUTES_SEARCHED = 366 * 24 * 60;

/**
 * The next firing strictly after `from`, or null when the expression is
 * invalid or never fires within a year.
 */
export function nextCronRun(expression: string, from: Date = new Date()): Date | null {
  const fields = parseCronExpression(expression);
  if (!fields) return null;

  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  for (let i = 0; i < MAX_MINUTES_SEARCHED; i += 1) {
    if (matches(fields, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

/**
 * The most recent firing at or before `from`, or null when the expression is
 * invalid or has not fired within a year.
 *
 * Used to decide whether a scheduled window was missed: if a portal's last run
 * predates its previous expected firing, a window went by without a run.
 */
export function previousCronRun(expression: string, from: Date = new Date()): Date | null {
  const fields = parseCronExpression(expression);
  if (!fields) return null;

  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);

  for (let i = 0; i < MAX_MINUTES_SEARCHED; i += 1) {
    if (matches(fields, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1);
  }
  return null;
}

/**
 * Has this portal missed its most recent scheduled window?
 *
 * `graceMinutes` absorbs the time a run legitimately takes plus queue latency,
 * so a run that is merely in progress is not reported as missed.
 */
export function hasMissedSchedule(
  expression: string | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date = new Date(),
  graceMinutes = 30,
): boolean {
  if (!expression) return false;

  const previous = previousCronRun(expression, now);
  if (!previous) return false;

  // Only judge a window that closed more than the grace period ago.
  if (now.getTime() - previous.getTime() < graceMinutes * 60 * 1000) return false;

  if (!lastRunAt) return true;
  return lastRunAt.getTime() < previous.getTime();
}
