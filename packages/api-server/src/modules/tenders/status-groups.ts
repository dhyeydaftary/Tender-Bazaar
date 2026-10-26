/**
 * Tender status groups used by GET /tenders/stats and the web app's
 * Active / Closed / All tabs.
 *
 * Semantics follow the in-app help (apps/web/src/app/(marketing)/help):
 *   ACTIVE       open for bidding
 *   CORRIGENDUM  an amendment was issued — the tender is still open for bidding
 *   CLOSED       submission deadline has passed
 *   AWARDED      closed and awarded
 *   CANCELLED    withdrawn by the issuing authority
 *
 * Every TenderStatus value belongs to exactly one group, so
 * open + closed always equals the total (tests/tender-status-groups.test.ts
 * checks this against prisma/schema.prisma). The web app mirrors these lists in
 * apps/web/src/app/(dashboard)/tenders/page.tsx.
 */

export const OPEN_TENDER_STATUSES = ['ACTIVE', 'CORRIGENDUM'] as const;
export const CLOSED_TENDER_STATUSES = ['CLOSED', 'AWARDED', 'CANCELLED'] as const;

/** Open tenders whose submission deadline has passed — these become CLOSED. */
export function expiredOpenTendersWhere(now: Date) {
  return {
    status: { in: [...OPEN_TENDER_STATUSES] },
    bidSubmissionDeadline: { lt: now },
  };
}

/** Summarise a `groupBy(['status'])` result into the tab counts. */
export function summarizeStatusCounts(rows: Array<{ status: string; _count: number }>) {
  let open = 0;
  let closed = 0;
  let total = 0;
  for (const row of rows) {
    total += row._count;
    if ((OPEN_TENDER_STATUSES as readonly string[]).includes(row.status)) open += row._count;
    else if ((CLOSED_TENDER_STATUSES as readonly string[]).includes(row.status)) closed += row._count;
  }
  return { total, active: open, closed, unclassified: total - open - closed };
}

/**
 * Pick the tender for a fuzzy (substring) id match only when it is
 * unambiguous. Returning the first of several matches showed an unrelated
 * tender for a short or partial id.
 */
export function pickUnambiguous<T>(matches: T[]): T | null {
  return matches.length === 1 ? matches[0] : null;
}
