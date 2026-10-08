'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { triggerScraper, getScraperHealth, getScraperRuns } from '@/lib/admin-api';
import type { ScraperHealthEntry, ScraperRun } from '@/lib/types';
import {
  Bot,
  Play,
  RefreshCw,
  AlertCircle,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Activity,
  Globe,
  TrendingUp,
  Eye,
  Filter,
  Loader2,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// Completion polling for a manually triggered run: check the real scraper-health
// endpoint every 3s for up to 60s. GeM's real runs take ~12-45s, so this window
// covers them without hanging the UI indefinitely.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

/** Recent runs pulled per portal for the activity feed. */
const RUNS_PER_PORTAL = 5;
/** Upper bound on the merged, cross-portal activity feed. */
const MAX_ACTIVITY_ENTRIES = 20;

type ScraperStatus = 'IDLE' | 'RUNNING' | 'FAILED' | 'DISABLED';

/**
 * A portal row, derived entirely from `GET /admin/scrapers`.
 *
 * `id` is the backend's `portalName` verbatim rather than a slug: it is the
 * value the trigger and runs endpoints look up, case-sensitively, so deriving
 * a prettier display name would break Run Now for TamilNadu/UP/MP — which is
 * exactly what the previous hardcoded portal list did.
 */
interface Portal {
  id: string;
  name: string;
  status: ScraperStatus;
  /** null when the portal has never run. */
  lastRun: Date | null;
  tendersFound: number;
  newTenders: number;
  duplicates: number;
  errors: number;
  avgResponseTime: number; // ms
  schedule: string;
  enabled: boolean;
  totalRuns: number;
  totalSuccessRuns: number;
  totalFailedRuns: number;
}

interface ActivityEntry {
  id: string;
  timestamp: Date;
  portalName: string;
  status: 'success' | 'failure' | 'warning';
  tendersFound: number;
  duration: number; // seconds
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Relative time against the CURRENT clock.
 *
 * Previously this compared against a module-level `const now` captured at
 * import, so every "2h ago" froze at page-load time and drifted thereafter.
 */
function relativeTime(date: Date | null): string {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Render a cron expression in plain English.
 *
 * Only the shapes the portal registry actually uses are translated; anything
 * else falls through to the raw expression rather than being guessed at.
 */
function humanizeCron(cronExpression: string | null): string {
  if (!cronExpression) return 'Not scheduled';

  // "0 */2 * * *" / "30 */6 * * *" — every N hours, at some minute offset.
  const everyNHours = /^\d+ \*\/(\d+) \* \* \*$/.exec(cronExpression);
  if (everyNHours) return `Every ${everyNHours[1]}h`;

  // "*/15 * * * *" — every N minutes.
  const everyNMinutes = /^\*\/(\d+) \* \* \* \*$/.exec(cronExpression);
  if (everyNMinutes) return `Every ${everyNMinutes[1]}m`;

  // "10 * * * *" — once an hour.
  const hourly = /^\d+ \* \* \* \*$/.exec(cronExpression);
  if (hourly) return 'Every 1h';

  // "10 1,7,13,19 * * *" — an explicit list of hours.
  const hourList = /^(\d+) (\d+(?:,\d+)+) \* \* \*$/.exec(cronExpression);
  if (hourList) {
    const minute = hourList[1].padStart(2, '0');
    const hours = hourList[2].split(',');
    return `${hours.length}x daily (${hours
      .map((h) => `${h.padStart(2, '0')}:${minute}`)
      .join(', ')})`;
  }

  // "30 2 * * *" — once a day.
  const dailyAt = /^(\d+) (\d+) \* \* \*$/.exec(cronExpression);
  if (dailyAt) {
    return `Daily at ${dailyAt[2].padStart(2, '0')}:${dailyAt[1].padStart(2, '0')}`;
  }

  // Anything else is shown verbatim rather than guessed at.
  return cronExpression;
}

/**
 * Collapse the backend's health + latest-run state into the four presentation
 * statuses. Nothing is invented: every branch reads a real API field.
 */
function deriveStatus(entry: ScraperHealthEntry): ScraperStatus {
  if (entry.latestRun?.status === 'RUNNING') return 'RUNNING';
  if (!entry.enabled) return 'DISABLED';
  if (entry.status === 'UNHEALTHY') return 'FAILED';
  return 'IDLE';
}

function toPortal(entry: ScraperHealthEntry): Portal {
  const run = entry.latestRun;
  return {
    id: entry.portalName,
    name: entry.portalName,
    status: deriveStatus(entry),
    lastRun: entry.lastRunAt ? new Date(entry.lastRunAt) : null,
    // A portal that has never run reports 0, not a placeholder.
    tendersFound: run?.totalFound ?? 0,
    newTenders: run?.newTenders ?? 0,
    duplicates: run?.duplicates ?? 0,
    errors: run?.errors ?? 0,
    avgResponseTime: entry.avgDurationMs ?? 0,
    schedule: humanizeCron(entry.cronExpression),
    enabled: entry.enabled,
    totalRuns: entry.totalRuns,
    totalSuccessRuns: entry.totalSuccessRuns,
    totalFailedRuns: entry.totalFailedRuns,
  };
}

/** Map a real ScrapingRun onto an activity line. No value is synthesised. */
function runToActivity(run: ScraperRun): ActivityEntry {
  const when = run.completedAt ?? run.startedAt ?? run.createdAt;

  let status: ActivityEntry['status'];
  if (run.status === 'FAILED' || run.status === 'CANCELLED') status = 'failure';
  else if (run.status === 'COMPLETED') status = run.errors > 0 ? 'warning' : 'success';
  else status = 'warning'; // PENDING / RUNNING — not a success yet

  const message =
    run.status === 'COMPLETED'
      ? `${run.totalFound} found, ${run.newTenders} new, ${run.duplicates} duplicate, ` +
        `${run.errors} error(s) across ${run.pagesScraped} page(s). Triggered by ${run.triggeredBy}.`
      : run.errorMessage
      ? `${run.status}: ${run.errorMessage}`
      : `${run.status} — triggered by ${run.triggeredBy}.`;

  return {
    id: run.id,
    timestamp: new Date(when),
    portalName: run.portalName,
    status,
    tendersFound: run.totalFound,
    duration: run.duration ? Math.round(run.duration / 1000) : 0,
    message,
  };
}

function statusBadge(status: ScraperStatus) {
  switch (status) {
    case 'IDLE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground/80">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Idle
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Running
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Failed
        </span>
      );
    case 'DISABLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/30 text-muted-foreground line-through">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Disabled
        </span>
      );
  }
}

function activityStatusIcon(status: 'success' | 'failure' | 'warning') {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'failure':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ScrapersPage() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScraperStatus>('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [runningAll, setRunningAll] = useState(false);
  const [runningFailed, setRunningFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Surfaces a failed trigger instead of silently showing a fake success.
  const [runError, setRunError] = useState<string | null>(null);
  const [runningPortals, setRunningPortals] = useState<Set<string>>(new Set());
  /**
   * Synchronous mirror of `runningPortals`, used only as the click guard.
   *
   * `runningPortals` cannot do that job on its own: it is React state read
   * through a callback closure, so several clicks dispatched in the same tick
   * all observe the pre-click value and every one of them passes the check.
   * That was measured — three same-tick clicks produced three trigger requests
   * and three concurrent runs. A ref is updated immediately, so the first
   * click claims the portal before any re-render.
   *
   * The state is still what drives the spinner and the disabled attribute;
   * the two are always written and cleared together.
   */
  const claimedPortals = useRef<Set<string>>(new Set());
  const [showLogsPortal, setShowLogsPortal] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────

  /**
   * Load the authoritative portal list and the cross-portal activity feed.
   *
   * There is no "recent runs across all portals" endpoint on the API server,
   * so the feed is assembled by asking each portal's runs endpoint for its
   * last few runs and merging. The fan-out is bounded (one request per portal,
   * RUNS_PER_PORTAL rows each) and settled independently, so one failing
   * portal cannot blank the whole feed.
   */
  const loadData = useCallback(async () => {
    const health = await getScraperHealth();
    setPortals(health.map(toPortal));

    const runResults = await Promise.allSettled(
      health.map((entry) => getScraperRuns(entry.portalName, { limit: RUNS_PER_PORTAL })),
    );

    const merged = runResults
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .map(runToActivity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, MAX_ACTIVITY_ENTRIES);

    setActivity(merged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadData();
        if (!cancelled) setLoadError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Could not load scrapers from the API.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  /** Refresh really refetches — it no longer just spins for 1.5s. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Could not refresh scraper data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // ── Derived values (all from real API data) ───────────────────────────

  const activeScrapers = portals.filter((p) => p.enabled).length;

  /**
   * Tenders reported by each portal's most recent run. Deliberately NOT
   * labelled "today" or "all-time": the API exposes only the latest run per
   * portal, and ScraperHealth.totalTendersFound is 0 for most portals, so
   * neither claim would be true.
   */
  const tendersInLatestRuns = portals.reduce((s, p) => s + p.tendersFound, 0);

  const { successRate, totalRunsAllPortals } = useMemo(() => {
    const runs = portals.reduce((s, p) => s + p.totalRuns, 0);
    const ok = portals.reduce((s, p) => s + p.totalSuccessRuns, 0);
    return {
      successRate: runs > 0 ? Math.round((ok / runs) * 100) : 0,
      totalRunsAllPortals: runs,
    };
  }, [portals]);

  /** Per-portal success rate from real run tallies; portals with no runs are omitted. */
  const portalRates = useMemo(
    () =>
      portals
        .filter((p) => p.totalRuns > 0)
        .map((p) => ({
          name: p.name,
          success: Math.round((p.totalSuccessRuns / p.totalRuns) * 100),
          failure: Math.round((p.totalFailedRuns / p.totalRuns) * 100),
          totalRuns: p.totalRuns,
        })),
    [portals],
  );

  const filteredPortals = portals.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredActivity = activity.filter((a) => {
    if (activityFilter === 'all') return true;
    return a.portalName === activityFilter;
  });

  const failedPortals = portals.filter((p) => p.status === 'FAILED');

  // ── Actions (ADM-01 — behaviour unchanged) ────────────────────────────

  /**
   * Pull the authoritative scraper health from the API and fold the real numbers
   * for one portal into the row. Only values the backend reports are written —
   * nothing here is invented.
   */
  const syncPortalFromApi = useCallback(async (
    portalId: string,
    portalName: string,
  ): Promise<string | null> => {
    try {
      const health = await getScraperHealth();
      const entry = health.find((h) => h.portalName === portalName);
      if (!entry) return null;

      setPortals((prev) => prev.map((p) => (p.id === portalId ? toPortal(entry) : p)));

      const latest = entry.latestRun;
      if (latest) {
        setActivity((prev) => {
          // The run may already be in the feed from the initial load; replace
          // rather than duplicate it, keyed on the real ScrapingRun id.
          const withoutThisRun = prev.filter((a) => a.id !== latest.id);
          return [
            {
              id: latest.id,
              timestamp: new Date(latest.completedAt ?? latest.startedAt ?? Date.now()),
              portalName,
              status:
                latest.status === 'FAILED' || latest.status === 'CANCELLED'
                  ? ('failure' as const)
                  : latest.errors > 0
                  ? ('warning' as const)
                  : ('success' as const),
              tendersFound: latest.totalFound,
              duration: latest.duration ? Math.round(latest.duration / 1000) : 0,
              message:
                `${latest.status}: ${latest.totalFound} found, ${latest.newTenders} new, ` +
                `${latest.duplicates} duplicate, ${latest.errors} error(s).`,
            },
            ...withoutThisRun,
          ].slice(0, MAX_ACTIVITY_ENTRIES);
        });
      }

      // Hand the run status back so the poller knows when to stop.
      return latest?.status ?? null;
    } catch {
      // Health refresh is best-effort; the trigger itself already succeeded.
      return null;
    }
  }, []);

  /**
   * Trigger a REAL scraping run via POST /admin/scrapers/:portalName/trigger.
   *
   * Replaces an earlier setTimeout + Math.random() simulation that invented
   * found/new/duplicate/error counts and never contacted the backend, so the
   * UI reported successful scrapes that never happened.
   *
   * The backend queues the run and returns immediately, so this shows a running
   * state, then reads the real numbers back from getScraperHealth(). It never
   * predicts or fabricates results.
   */
  const runPortal = useCallback(
    async (portalId: string, portalName: string) => {
      // UI-side guard: ignore a second click while this portal's run is still
      // being processed. The scraper engine's Redis lock does not currently
      // block manual triggers, so without this a repeated click would stack
      // duplicate jobs. (Hardening the engine lock is a separate follow-up.)
      //
      // Claimed on the ref, synchronously, so same-tick clicks are rejected
      // before React has a chance to re-render the disabled button.
      if (claimedPortals.current.has(portalId)) return;
      claimedPortals.current.add(portalId);

      setRunError(null);
      setRunningPortals((prev) => new Set(prev).add(portalId));
      setPortals((prev) =>
        prev.map((p) => (p.id === portalId ? { ...p, status: 'RUNNING' as ScraperStatus } : p))
      );

      try {
        await triggerScraper(portalName);

        // The engine runs the scrape asynchronously off the queue, so poll the
        // real scraper-health endpoint until its run reaches a terminal state.
        // Nothing is predicted or fabricated: every value shown comes from the
        // backend, and a timeout is reported as "still running" rather than
        // being marked complete.
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        let terminal = false;

        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          const status = await syncPortalFromApi(portalId, portalName);
          if (status === 'COMPLETED' || status === 'FAILED') {
            terminal = true;
            break;
          }
        }

        if (!terminal) {
          setRunError(
            `${portalName}: Scraper is still running. Check the run history for the latest status.`
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Could not start the scraper. Please try again.';
        setRunError(`${portalName}: ${message}`);
        setPortals((prev) =>
          prev.map((p) => (p.id === portalId ? { ...p, status: 'FAILED' as ScraperStatus } : p))
        );
      } finally {
        // Re-enable the button once the run is terminal, the trigger failed,
        // or polling timed out. The ref is released alongside the state so the
        // guard can never outlive the visible running state.
        claimedPortals.current.delete(portalId);
        setRunningPortals((prev) => {
          const next = new Set(prev);
          next.delete(portalId);
          return next;
        });
      }
    },
    // runningPortals is deliberately absent: the guard reads claimedPortals,
    // and depending on the state here would rebuild this callback on every
    // run-state change for no benefit.
    [syncPortalFromApi]
  );

  const runAll = useCallback(async () => {
    setRunningAll(true);
    try {
      // Sequential on purpose: the backend queues each run, and firing 13 at
      // once would stampede the portals.
      for (const p of portals.filter((x) => x.enabled)) {
        await runPortal(p.id, p.name);
      }
    } finally {
      setRunningAll(false);
    }
  }, [portals, runPortal]);

  const runFailed = useCallback(async () => {
    setRunningFailed(true);
    try {
      for (const p of portals.filter((x) => x.status === 'FAILED')) {
        await runPortal(p.id, p.name);
      }
    } finally {
      setRunningFailed(false);
    }
  }, [portals, runPortal]);

  // ── Loading / error states ────────────────────────────────────────────
  // The page used to render seeded rows instantly, which looked like live data
  // even when the API was unreachable. It now shows a skeleton, then either
  // real rows or an explicit error — never invented portals.

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-primary-500" />
          <h1 className="text-2xl font-bold text-foreground">Scraper Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              <div className="h-7 w-16 bg-muted rounded animate-pulse mt-3" />
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading scrapers...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <div>
            <p className="text-foreground font-medium">Could not load scraper data</p>
            <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
          </div>
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ---------------------------------------------------------------- */}
      {/* Header */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-7 h-7 text-primary-500" />
            Scraper Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and control tender scraping across all portals
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground/80 hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Overview Cards */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tenders in latest runs */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tenders Found
            </span>
            <FileText className="w-4 h-4 text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {tendersInLatestRuns.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across the latest run of each portal
          </p>
        </div>

        {/* Active Scrapers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Scrapers
            </span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {activeScrapers}{' '}
            <span className="text-sm font-normal text-muted-foreground">/ {portals.length}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {portals.filter((p) => p.status === 'RUNNING').length} currently running
          </p>
        </div>

        {/* Success Rate */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Success Rate
            </span>
            <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
          </div>
          <p className="text-2xl font-bold text-foreground">{successRate}%</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00D4AA] transition-all"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalRunsAllPortals} recorded run{totalRunsAllPortals === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Manual Actions */}
      {/* ---------------------------------------------------------------- */}
      {runError && (
        <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{runError}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => void runAll()}
          disabled={runningAll || activeScrapers === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
        >
          {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run All Scrapers
        </button>
        <button
          onClick={() => void runFailed()}
          disabled={runningFailed || failedPortals.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 text-sm font-medium transition-colors disabled:opacity-30"
        >
          {runningFailed ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Run Failed Only
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Portal Status Table */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            Portal Status
            <span className="text-xs font-normal text-muted-foreground">
              ({portals.length} portals)
            </span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ScraperStatus)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-500"
            >
              <option value="all">All statuses</option>
              <option value="IDLE">Idle</option>
              <option value="RUNNING">Running</option>
              <option value="FAILED">Failed</option>
              <option value="DISABLED">Disabled</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search portals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Portal
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Run
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Found
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  New
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dups
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Errors
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Schedule
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPortals.map((portal) => (
                <tr
                  key={portal.id}
                  className={`hover:bg-muted/50 transition-colors ${
                    !portal.enabled ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-primary-500 border border-border shrink-0">
                        {portal.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="font-medium text-foreground">{portal.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(portal.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{relativeTime(portal.lastRun)}</td>
                  <td className="px-4 py-3 text-right text-foreground font-medium tabular-nums">
                    {portal.tendersFound}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-medium tabular-nums">
                    {portal.newTenders > 0 ? `+${portal.newTenders}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {portal.duplicates}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={portal.errors > 0 ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                      {portal.errors}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {formatMs(portal.avgResponseTime)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {portal.schedule}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Run Now */}
                      <button
                        onClick={() => runPortal(portal.id, portal.name)}
                        disabled={!portal.enabled || runningPortals.has(portal.id)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Run Now"
                      >
                        {runningPortals.has(portal.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>

                      {/* View Logs */}
                      <button
                        onClick={() =>
                          setShowLogsPortal(showLogsPortal === portal.id ? null : portal.id)
                        }
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View Logs"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPortals.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No portals match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Enabling, disabling and schedule changes are owned by the scraper engine&apos;s portal
          configuration, so they are read-only here.
        </p>
      </div>

      {/* Inline Logs Viewer */}
      {showLogsPortal && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Logs: {showLogsPortal}</h3>
            <button
              onClick={() => setShowLogsPortal(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4 font-mono text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto bg-background">
            {activity
              .filter((a) => a.portalName === showLogsPortal)
              .slice(0, 10)
              .map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span className="text-muted-foreground shrink-0">
                    [{a.timestamp.toLocaleTimeString()}]
                  </span>
                  <span
                    className={
                      a.status === 'success'
                        ? 'text-emerald-400'
                        : a.status === 'failure'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }
                  >
                    {a.status.toUpperCase()}
                  </span>
                  <span className="text-foreground/80">{a.message}</span>
                </div>
              ))}
            {activity.filter((a) => a.portalName === showLogsPortal).length === 0 && (
              <p className="text-muted-foreground">No runs recorded for this portal.</p>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Bottom Grid: Activity Log + Success Rate */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* 4. Recent Activity Log */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Portals</option>
                {[...new Set(activity.map((a) => a.portalName))].map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-200">
            {filteredActivity.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="mt-0.5 shrink-0">{activityStatusIcon(entry.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{entry.portalName}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.tendersFound > 0 && `${entry.tendersFound} tenders`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{relativeTime(entry.timestamp)}</p>
                  <p className="text-xs text-muted-foreground">{formatDuration(entry.duration)}</p>
                </div>
              </div>
            ))}
            {filteredActivity.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No scraping runs recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 5. Success Rate by Portal — real totalSuccessRuns/totalFailedRuns */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Success Rate by Portal
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Across all recorded runs. Portals that have never run are omitted.
          </p>
          <div className="space-y-2">
            {portalRates.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 truncate shrink-0">
                  {p.name}
                </span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[#00D4AA] transition-all"
                    style={{ width: `${p.success}%` }}
                  />
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${p.failure}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-20 text-right tabular-nums shrink-0">
                  {p.success}% / {p.totalRuns}
                </span>
              </div>
            ))}
            {portalRates.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No runs recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
