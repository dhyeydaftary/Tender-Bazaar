import type { ScraperHealthEntry } from './types';

/**
 * Scraper dashboard KPIs, derived only from GET /admin/scrapers.
 *
 * - tendersFoundLatest: sum of `totalFound` from each portal's most recent run.
 *   Previously a portal whose latest run found 0 fell back to
 *   `totalTendersFound`, which the API fills with the number of tenders in the
 *   database for that portal — so the card mixed "latest run" figures with
 *   all-time database counts.
 * - enabled: portals enabled for scheduling (not "currently running").
 * - successRate: completed / (completed + failed) over finished runs, from the
 *   run records, rounded down to one decimal (see floorPercent). Cancelled and in-progress runs are excluded. Runs that
 *   completed with page errors count as completed and are reported separately,
 *   so partial errors are visible without being called failures. null when no
 *   run has finished (the card shows "—" rather than a fake 0% or 100%).
 */
export interface ScraperKpis {
  portals: number;
  enabled: number;
  tendersFoundLatest: number;
  totalRuns: number;
  finishedRuns: number;
  completedRuns: number;
  completedWithErrors: number;
  failedRuns: number;
  cancelledRuns: number;
  inProgressRuns: number;
  successRate: number | null;
}

export function computeScraperKpis(entries: ScraperHealthEntry[]): ScraperKpis {
  const sum = (pick: (e: ScraperHealthEntry) => number) => entries.reduce((s, e) => s + pick(e), 0);
  const completedRuns = sum((e) => e.runStats?.completed ?? 0);
  const failedRuns = sum((e) => e.runStats?.failed ?? 0);
  const finishedRuns = completedRuns + failedRuns;
  return {
    portals: entries.length,
    enabled: entries.filter((e) => e.enabled).length,
    tendersFoundLatest: sum((e) => e.latestRun?.totalFound ?? 0),
    totalRuns: sum((e) => e.runStats?.total ?? 0),
    finishedRuns,
    completedRuns,
    completedWithErrors: sum((e) => e.runStats?.completedWithErrors ?? 0),
    failedRuns,
    cancelledRuns: sum((e) => e.runStats?.cancelled ?? 0),
    inProgressRuns: sum((e) => e.runStats?.inProgress ?? 0),
    successRate: finishedRuns > 0 ? floorPercent(completedRuns, finishedRuns) : null,
  };
}

/**
 * Percentage rounded DOWN to one decimal, so the rate reads 100% only when no
 * finished run failed (480 of 481 is 99.7%, where Math.round said 100%).
 */
export function floorPercent(part: number, whole: number): number {
  return Math.floor((part / whole) * 1000) / 10;
}

/** Per-portal completed/failed shares of finished runs, for the bar chart. */
export function portalSuccessShares(entry: ScraperHealthEntry) {
  const completed = entry.runStats?.completed ?? 0;
  const failed = entry.runStats?.failed ?? 0;
  const finished = completed + failed;
  const success = finished > 0 ? floorPercent(completed, finished) : 0;
  return {
    finished,
    success,
    failure: finished > 0 ? Math.round((100 - success) * 10) / 10 : 0,
  };
}
