import assert from 'node:assert/strict';
import { parseTenderDeadline } from '../lib/calendar-utils';

console.log('--- Starting Tender Calendar Unit & Regression Tests ---');

// 1. Valid ISO date with time
{
  const res = parseTenderDeadline('2026-11-05T05:50:54.044Z');
  assert.ok(res, 'Should parse valid ISO date');
  assert.match(res.dateStr, /^\d{4}-\d{2}-\d{2}$/, 'Should format as YYYY-MM-DD');
  console.log('✓ Parsed valid ISO date string:', res.dateStr);
}

// 2. Valid date-only string
{
  const res = parseTenderDeadline('2026-12-25');
  assert.ok(res, 'Should parse valid date-only string');
  assert.equal(res.dateStr, '2026-12-25', 'Date-only string should preserve exact day');
  console.log('✓ Preserved date-only string without shifting day:', res.dateStr);
}

// 3. Invalid or missing dates
{
  assert.equal(parseTenderDeadline(null), null, 'null date must return null');
  assert.equal(parseTenderDeadline(undefined), null, 'undefined date must return null');
  assert.equal(parseTenderDeadline(''), null, 'empty string must return null');
  assert.equal(parseTenderDeadline('   '), null, 'whitespace string must return null');
  assert.equal(parseTenderDeadline('invalid-date-string'), null, 'garbage string must return null');
  console.log('✓ Missing and invalid dates are handled honestly as null');
}

// 4. Timezone boundaries - date at 23:59:59 local vs UTC
{
  // A tender deadline on a specific date
  const isoStr = '2026-10-15T18:30:00.000Z'; // 18:30 UTC is midnight next day in IST (UTC+5:30)
  const res = parseTenderDeadline(isoStr);
  assert.ok(res);
  const localDate = new Date(isoStr);
  const expectedDay = String(localDate.getDate()).padStart(2, '0');
  assert.equal(res.dateStr.slice(8, 10), expectedDay, 'Extracted date matches local day representation');
  console.log('✓ Timezone boundary matches local date representation without accidental UTC truncation shift');
}

// 5. Deduplication logic test
{
  const rawTenders = [
    { id: 'tender-1', title: 'Road Project', bidSubmissionDeadline: '2026-11-01T10:00:00Z' },
    { id: 'tender-1', title: 'Duplicate Road Project', bidSubmissionDeadline: '2026-11-01T10:00:00Z' },
    { id: 'tender-2', title: 'Bridge Project', bidSubmissionDeadline: '2026-11-05T10:00:00Z' },
    { id: 'tender-3', title: 'Invalid Tender', bidSubmissionDeadline: 'invalid' },
  ];

  const seenIds = new Set<string>();
  const mapped = [];
  for (const t of rawTenders) {
    if (!t.id || seenIds.has(t.id)) continue;
    const parsed = parseTenderDeadline(t.bidSubmissionDeadline);
    if (!parsed) continue;
    seenIds.add(t.id);
    mapped.push({ id: t.id, title: t.title, deadlineDate: parsed.dateStr });
  }

  assert.equal(mapped.length, 2, 'Should deduplicate tender-1 and drop invalid tender-3');
  assert.equal(mapped[0].id, 'tender-1');
  assert.equal(mapped[1].id, 'tender-2');
  console.log('✓ Deduplication removes duplicates and skips invalid dates');
}

// 6. Navigation month transitions
{
  function prevMonth(y: number, m: number) {
    return m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  }
  function nextMonth(y: number, m: number) {
    return m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  }

  assert.deepEqual(prevMonth(2026, 0), { y: 2025, m: 11 }, 'January -> previous year December');
  assert.deepEqual(nextMonth(2026, 11), { y: 2027, m: 0 }, 'December -> next year January');
  assert.deepEqual(nextMonth(2026, 5), { y: 2026, m: 6 }, 'June -> July');
  console.log('✓ Month navigation handles year boundaries accurately');
}

console.log('--- All Tender Calendar Tests Passed Successfully! ---');
