import assert from 'node:assert/strict';
import {
  isValidCronExpression,
  nextCronRun,
  previousCronRun,
  hasMissedSchedule,
} from '../shared/utils/cron-schedule';

console.log('--- Starting Cron Schedule Utility Tests ---');

const iso = (date: Date | null) => (date ? date.toISOString() : null);

// 1. Every expression in the portal registry must parse.
{
  const registryExpressions = [
    '0 */2 * * *',
    '0 */4 * * *',
    '30 */4 * * *',
    '0 */6 * * *',
    '10 */6 * * *',
    '20 */6 * * *',
    '30 */6 * * *',
    '40 */6 * * *',
    '50 */6 * * *',
    '0 1,7,13,19 * * *',
    '10 1,7,13,19 * * *',
    '20 1,7,13,19 * * *',
    '30 1,7,13,19 * * *',
    '30 20 * * *', // daily full re-scrape (02:00 IST)
    '0 * * * *', // hourly retry sweep
  ];

  for (const expression of registryExpressions) {
    assert.ok(isValidCronExpression(expression), `Must parse: ${expression}`);
    assert.ok(nextCronRun(expression), `Must yield a next run: ${expression}`);
  }

  console.log(`✓ All ${registryExpressions.length} expressions used by the scheduler parse and resolve`);
}

// 2. Invalid or unsupported expressions are rejected, not silently accepted.
{
  const invalid = [
    '',
    'not a cron expression',
    '* * * *', // four fields
    '* * * * * *', // six fields
    '60 * * * *', // minute out of range
    '* 24 * * *', // hour out of range
    '* * 32 * *',
    '* * * 13 *',
    '* * * * 7',
    '*/0 * * * *',
    '5-1 * * * *', // reversed range
    '@daily', // shorthand not supported
    '0 0 * * MON', // names not supported
  ];

  for (const expression of invalid) {
    assert.equal(
      isValidCronExpression(expression),
      false,
      `Must reject: ${JSON.stringify(expression)}`,
    );
    assert.equal(nextCronRun(expression), null);
  }

  console.log(`✓ ${invalid.length} invalid/unsupported expressions are rejected (admin edits can no longer store a dead cron)`);
}

// 3. Next-run arithmetic, in UTC.
{
  // 09:17 UTC, every two hours on the hour -> 10:00 UTC
  assert.equal(
    iso(nextCronRun('0 */2 * * *', new Date('2026-10-15T09:17:00Z'))),
    '2026-10-15T10:00:00.000Z',
  );

  // Exactly on a firing: must advance to the NEXT one, not return now.
  assert.equal(
    iso(nextCronRun('0 */2 * * *', new Date('2026-10-15T10:00:00Z'))),
    '2026-10-15T12:00:00.000Z',
  );

  // Staggered state portal at :20 past every 6th hour.
  assert.equal(
    iso(nextCronRun('20 */6 * * *', new Date('2026-10-15T06:21:00Z'))),
    '2026-10-15T12:20:00.000Z',
  );

  // Explicit hour list.
  assert.equal(
    iso(nextCronRun('0 1,7,13,19 * * *', new Date('2026-10-15T13:30:00Z'))),
    '2026-10-15T19:00:00.000Z',
  );

  // Day rollover: the 02:00 IST full re-scrape is 20:30 UTC.
  assert.equal(
    iso(nextCronRun('30 20 * * *', new Date('2026-10-15T21:00:00Z'))),
    '2026-10-16T20:30:00.000Z',
  );

  console.log('✓ Next-run arithmetic is correct in UTC, including hour lists and day rollover');
}

// 4. Previous-run arithmetic.
{
  assert.equal(
    iso(previousCronRun('0 */2 * * *', new Date('2026-10-15T09:17:00Z'))),
    '2026-10-15T08:00:00.000Z',
  );
  assert.equal(
    iso(previousCronRun('30 20 * * *', new Date('2026-10-15T10:00:00Z'))),
    '2026-10-14T20:30:00.000Z',
    'Must cross midnight backwards',
  );

  console.log('✓ Previous-run arithmetic is correct, including crossing midnight backwards');
}

// 5. Missed-window detection.
{
  const now = new Date('2026-10-15T09:00:00Z'); // previous firing of */2 was 08:00

  assert.equal(
    hasMissedSchedule('0 */2 * * *', new Date('2026-10-15T08:05:00Z'), now),
    false,
    'A run just after the window is not missed',
  );
  assert.equal(
    hasMissedSchedule('0 */2 * * *', new Date('2026-10-15T05:00:00Z'), now),
    true,
    'A run predating the previous window IS missed',
  );
  assert.equal(
    hasMissedSchedule('0 */2 * * *', null, now),
    true,
    'Never having run is a missed window',
  );
  assert.equal(
    hasMissedSchedule(null, null, now),
    false,
    'No cron configured means nothing to miss',
  );

  // Inside the grace period the window is not yet judged.
  assert.equal(
    hasMissedSchedule('0 */2 * * *', new Date('2026-10-15T05:00:00Z'), new Date('2026-10-15T08:10:00Z')),
    false,
    'Within the grace period a run may still be in progress',
  );

  console.log('✓ Missed-window detection honours the grace period and the never-run case');
}

console.log('--- All Cron Schedule Utility Tests Passed ---');
