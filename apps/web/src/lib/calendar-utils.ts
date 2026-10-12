/**
 * Parse an ISO date or date-only string safely into YYYY-MM-DD in local time.
 * Returns null for missing or invalid dates.
 */
export function parseTenderDeadline(dateVal: unknown): { dateStr: string; date: Date } | null {
  if (!dateVal || typeof dateVal !== 'string') return null;
  const trimmed = dateVal.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    return { dateStr: trimmed, date };
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${d}`, date };
}
