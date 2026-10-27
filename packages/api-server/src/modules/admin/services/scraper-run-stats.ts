/**
 * Per-portal run statistics computed from ScrapingRun records.
 *
 * The scraper dashboard used ScraperHealth.totalRuns / totalSuccessRuns /
 * totalFailedRuns, which are incremental counters and drift from the run
 * history: stale-run recovery marks runs FAILED without touching them (one
 * WestBengal failure was never counted, so the dashboard showed 100%), and
 * older code paths left completed runs uncounted. The run table is the record
 * of what actually happened, so dashboard KPIs are derived from it.
 *
 * Status semantics:
 *   completed            COMPLETED (whole run finished)
 *   completedWithErrors  COMPLETED with errors > 0 — page-level failures inside
 *                        a finished run; a subset of `completed`, never a
 *                        failed run
 *   failed               FAILED (the run itself failed)
 *   cancelled            CANCELLED (stopped deliberately; neither success nor failure)
 *   inProgress           PENDING or RUNNING
 */

export interface RunStats {
  total: number;
  completed: number;
  completedWithErrors: number;
  failed: number;
  cancelled: number;
  inProgress: number;
}

export function emptyRunStats(): RunStats {
  return { total: 0, completed: 0, completedWithErrors: 0, failed: 0, cancelled: 0, inProgress: 0 };
}

export function buildRunStats(
  byStatus: Array<{ portalName: string; status: string; _count: number }>,
  completedWithErrors: Array<{ portalName: string; _count: number }>,
): Map<string, RunStats> {
  const stats = new Map<string, RunStats>();
  const get = (portal: string) => {
    let s = stats.get(portal);
    if (!s) stats.set(portal, (s = emptyRunStats()));
    return s;
  };
  for (const row of byStatus) {
    const s = get(row.portalName);
    s.total += row._count;
    if (row.status === 'COMPLETED') s.completed += row._count;
    else if (row.status === 'FAILED') s.failed += row._count;
    else if (row.status === 'CANCELLED') s.cancelled += row._count;
    else s.inProgress += row._count; // PENDING, RUNNING
  }
  for (const row of completedWithErrors) get(row.portalName).completedWithErrors += row._count;
  return stats;
}
