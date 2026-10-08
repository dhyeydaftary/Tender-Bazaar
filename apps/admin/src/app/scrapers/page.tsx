'use client';

import { useState, useCallback } from 'react';
import { triggerScraper, getScraperHealth } from '@/lib/admin-api';
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
  Trash2,
  FileText,
  Activity,
  Globe,
  TrendingUp,
  Timer,
  Eye,
  ToggleLeft,
  ToggleRight,
  Filter,
  ArrowUpDown,
  Loader2,
  Zap,
  BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// Completion polling for a manually triggered run: check the real scraper-health
// endpoint every 3s for up to 60s. GeM's real runs take ~12-45s, so this window
// covers them without hanging the UI indefinitely.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

type ScraperStatus = 'IDLE' | 'RUNNING' | 'FAILED' | 'DISABLED';

interface Portal {
  id: string;
  name: string;
  domain: string;
  status: ScraperStatus;
  lastRun: Date;
  tendersFound: number;
  newTenders: number;
  duplicates: number;
  errors: number;
  avgResponseTime: number; // ms
  schedule: string;
  enabled: boolean;
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
// Mock Data
// ---------------------------------------------------------------------------
const now = new Date();
function hoursAgo(h: number) {
  return new Date(now.getTime() - h * 3600_000);
}
function minutesAgo(m: number) {
  return new Date(now.getTime() - m * 60_000);
}

const INITIAL_PORTALS: Portal[] = [
  { id: 'gem', name: 'GeM', domain: 'gem.gov.in', status: 'IDLE', lastRun: hoursAgo(1), tendersFound: 342, newTenders: 87, duplicates: 255, errors: 0, avgResponseTime: 1240, schedule: 'Every 2h', enabled: true },
  { id: 'cppp', name: 'CPPP', domain: 'eprocure.gov.in', status: 'RUNNING', lastRun: minutesAgo(5), tendersFound: 156, newTenders: 34, duplicates: 122, errors: 2, avgResponseTime: 2100, schedule: 'Every 3h', enabled: true },
  { id: 'gujarat', name: 'Gujarat', domain: 'nprocure.com', status: 'IDLE', lastRun: hoursAgo(2), tendersFound: 89, newTenders: 23, duplicates: 66, errors: 0, avgResponseTime: 980, schedule: 'Every 4h', enabled: true },
  { id: 'maharashtra', name: 'Maharashtra', domain: 'mahatenders.gov.in', status: 'FAILED', lastRun: hoursAgo(4), tendersFound: 0, newTenders: 0, duplicates: 0, errors: 12, avgResponseTime: 0, schedule: 'Every 2h', enabled: true },
  { id: 'rajasthan', name: 'Rajasthan', domain: 'eproc.rajasthan.gov.in', status: 'IDLE', lastRun: hoursAgo(3), tendersFound: 67, newTenders: 15, duplicates: 52, errors: 1, avgResponseTime: 1560, schedule: 'Every 4h', enabled: true },
  { id: 'karnataka', name: 'Karnataka', domain: 'eproc.karnataka.gov.in', status: 'IDLE', lastRun: hoursAgo(2), tendersFound: 124, newTenders: 41, duplicates: 83, errors: 0, avgResponseTime: 1100, schedule: 'Every 3h', enabled: true },
  { id: 'tamilnadu', name: 'Tamil Nadu', domain: 'tntenders.gov.in', status: 'DISABLED', lastRun: hoursAgo(48), tendersFound: 45, newTenders: 8, duplicates: 37, errors: 5, avgResponseTime: 3200, schedule: 'Every 6h', enabled: false },
  { id: 'up', name: 'Uttar Pradesh', domain: 'etender.up.nic.in', status: 'IDLE', lastRun: hoursAgo(1.5), tendersFound: 198, newTenders: 56, duplicates: 142, errors: 0, avgResponseTime: 1800, schedule: 'Every 2h', enabled: true },
  { id: 'mp', name: 'Madhya Pradesh', domain: 'mptenders.gov.in', status: 'IDLE', lastRun: hoursAgo(5), tendersFound: 73, newTenders: 19, duplicates: 54, errors: 3, avgResponseTime: 2400, schedule: 'Every 4h', enabled: true },
  { id: 'delhi', name: 'Delhi', domain: 'govtprocurement.delhi.gov.in', status: 'IDLE', lastRun: hoursAgo(2.5), tendersFound: 52, newTenders: 14, duplicates: 38, errors: 0, avgResponseTime: 1350, schedule: 'Every 3h', enabled: true },
];

const INITIAL_ACTIVITY: ActivityEntry[] = [
  { id: '1', timestamp: minutesAgo(5), portalName: 'CPPP', status: 'success', tendersFound: 156, duration: 45, message: 'Scraping in progress...' },
  { id: '2', timestamp: hoursAgo(1), portalName: 'GeM', status: 'success', tendersFound: 342, duration: 62, message: 'Successfully scraped 342 tenders, 87 new.' },
  { id: '3', timestamp: hoursAgo(1.5), portalName: 'Uttar Pradesh', status: 'success', tendersFound: 198, duration: 78, message: 'Successfully scraped 198 tenders, 56 new.' },
  { id: '4', timestamp: hoursAgo(2), portalName: 'Gujarat', status: 'success', tendersFound: 89, duration: 33, message: 'Successfully scraped 89 tenders, 23 new.' },
  { id: '5', timestamp: hoursAgo(2), portalName: 'Karnataka', status: 'success', tendersFound: 124, duration: 41, message: 'Successfully scraped 124 tenders.' },
  { id: '6', timestamp: hoursAgo(2.5), portalName: 'Delhi', status: 'success', tendersFound: 52, duration: 29, message: 'Successfully scraped 52 tenders.' },
  { id: '7', timestamp: hoursAgo(3), portalName: 'Rajasthan', status: 'warning', tendersFound: 67, duration: 55, message: 'Completed with 1 non-critical error.' },
  { id: '8', timestamp: hoursAgo(4), portalName: 'Maharashtra', status: 'failure', tendersFound: 0, duration: 120, message: 'Connection timeout after 120s. Portal may be down.' },
  { id: '9', timestamp: hoursAgo(5), portalName: 'Madhya Pradesh', status: 'warning', tendersFound: 73, duration: 88, message: 'Completed with 3 warnings. Some pages returned 503.' },
  { id: '10', timestamp: hoursAgo(6), portalName: 'GeM', status: 'success', tendersFound: 310, duration: 58, message: 'Successfully scraped 310 tenders.' },
  { id: '11', timestamp: hoursAgo(8), portalName: 'CPPP', status: 'success', tendersFound: 141, duration: 50, message: 'Successfully scraped 141 tenders.' },
  { id: '12', timestamp: hoursAgo(10), portalName: 'Karnataka', status: 'success', tendersFound: 118, duration: 39, message: 'Successfully scraped 118 tenders.' },
];

// Tenders per day (last 7 days) mock data
const DAILY_TENDERS = [
  { day: 'Apr 4', count: 423 },
  { day: 'Apr 5', count: 587 },
  { day: 'Apr 6', count: 312 },
  { day: 'Apr 7', count: 695 },
  { day: 'Apr 8', count: 541 },
  { day: 'Apr 9', count: 478 },
  { day: 'Apr 10', count: 297 },
];

// Per-portal success/failure rates
const PORTAL_RATES = [
  { name: 'GeM', success: 98, failure: 2 },
  { name: 'CPPP', success: 92, failure: 8 },
  { name: 'Gujarat', success: 96, failure: 4 },
  { name: 'Maharashtra', success: 45, failure: 55 },
  { name: 'Rajasthan', success: 88, failure: 12 },
  { name: 'Karnataka', success: 97, failure: 3 },
  { name: 'Tamil Nadu', success: 72, failure: 28 },
  { name: 'UP', success: 94, failure: 6 },
  { name: 'MP', success: 82, failure: 18 },
  { name: 'Delhi', success: 95, failure: 5 },
];

// New vs duplicate per day
const NEW_VS_DUP = [
  { day: 'Apr 4', newT: 112, dup: 311 },
  { day: 'Apr 5', newT: 145, dup: 442 },
  { day: 'Apr 6', newT: 78, dup: 234 },
  { day: 'Apr 7', newT: 189, dup: 506 },
  { day: 'Apr 8', newT: 134, dup: 407 },
  { day: 'Apr 9', newT: 121, dup: 357 },
  { day: 'Apr 10', newT: 297, dup: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(date: Date): string {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
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
  if (ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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
  const [portals, setPortals] = useState<Portal[]>(INITIAL_PORTALS);
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [runningAll, setRunningAll] = useState(false);
  const [runningFailed, setRunningFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Surfaces a failed trigger instead of silently showing a fake success.
  const [runError, setRunError] = useState<string | null>(null);
  const [runningPortals, setRunningPortals] = useState<Set<string>>(new Set());
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ portalId: '', interval: '' });
  const [showLogsPortal, setShowLogsPortal] = useState<string | null>(null);

  // Computed
  const activeScrapers = portals.filter((p) => p.enabled).length;
  const totalTendersToday = portals.reduce((s, p) => s + p.tendersFound, 0);
  const totalTendersAllTime = 47832;
  const successRate = portals.filter((p) => p.enabled).length > 0
    ? Math.round(
        (portals.filter((p) => p.status !== 'FAILED' && p.enabled).length /
          portals.filter((p) => p.enabled).length) *
          100
      )
    : 0;
  const nextRun = '47 min';

  const filteredPortals = portals.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domain.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActivity = activity.filter((a) => {
    if (activityFilter === 'all') return true;
    return a.portalName === activityFilter;
  });

  // Actions

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
      const health = (await getScraperHealth()) as any[];
      const entry = Array.isArray(health)
        ? health.find((h) => h.portalName === portalName)
        : undefined;
      if (!entry) return null;

      setPortals((prev) =>
        prev.map((p) =>
          p.id === portalId
            ? {
                ...p,
                status: (entry.status === 'HEALTHY'
                  ? 'IDLE'
                  : entry.status === 'DISABLED'
                  ? 'DISABLED'
                  : entry.status === 'UNHEALTHY'
                  ? 'FAILED'
                  : p.status) as ScraperStatus,
                lastRun: entry.lastRunAt ? new Date(entry.lastRunAt) : p.lastRun,
                // Once a real run exists, every counter comes from it. Fields the
                // API does not project (duplicates is absent from its latestRun
                // select) resolve to 0 rather than keeping a placeholder value —
                // showing a stale number next to real ones would be misleading.
                tendersFound: entry.latestRun ? entry.latestRun.totalFound ?? 0 : p.tendersFound,
                newTenders: entry.latestRun ? entry.latestRun.newTenders ?? 0 : p.newTenders,
                duplicates: entry.latestRun ? entry.latestRun.duplicates ?? 0 : p.duplicates,
                errors: entry.latestRun ? entry.latestRun.errors ?? 0 : p.errors,
                enabled: entry.enabled ?? p.enabled,
              }
            : p
        )
      );

      const latest = entry.latestRun;
      if (latest) {
        setActivity((prev) => [
          {
            id: `${portalName}-${latest.completedAt ?? Date.now()}`,
            timestamp: latest.completedAt ? new Date(latest.completedAt) : new Date(),
            portalName,
            status: latest.errors > 0 ? 'warning' : 'success',
            tendersFound: latest.totalFound,
            duration: latest.duration ? Math.round(latest.duration / 1000) : 0,
            message: `${latest.status}: ${latest.totalFound} found, ${latest.newTenders} new, ${latest.errors} error(s).`,
          },
          ...prev,
        ]);
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
      if (runningPortals.has(portalId)) return;

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
        // Re-enable the button once the run is terminal or polling timed out.
        setRunningPortals((prev) => {
          const next = new Set(prev);
          next.delete(portalId);
          return next;
        });
      }
    },
    [runningPortals, syncPortalFromApi]
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

  const clearFailed = useCallback(() => {
    setPortals((prev) =>
      prev.map((p) => (p.status === 'FAILED' ? { ...p, status: 'IDLE' as ScraperStatus, errors: 0 } : p))
    );
  }, []);

  const togglePortal = useCallback((portalId: string) => {
    setPortals((prev) =>
      prev.map((p) =>
        p.id === portalId
          ? {
              ...p,
              enabled: !p.enabled,
              status: p.enabled ? ('DISABLED' as ScraperStatus) : ('IDLE' as ScraperStatus),
            }
          : p
      )
    );
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleScheduleSave = useCallback(() => {
    if (!scheduleForm.portalId || !scheduleForm.interval) return;
    setPortals((prev) =>
      prev.map((p) =>
        p.id === scheduleForm.portalId ? { ...p, schedule: scheduleForm.interval } : p
      )
    );
    setShowScheduleEditor(false);
    setScheduleForm({ portalId: '', interval: '' });
  }, [scheduleForm]);

  // Chart scale
  const maxDaily = Math.max(...DAILY_TENDERS.map((d) => d.count));
  const maxNewDup = Math.max(...NEW_VS_DUP.map((d) => d.newT + d.dup));

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
          onClick={handleRefresh}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenders */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tenders Scraped
            </span>
            <FileText className="w-4 h-4 text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalTendersToday.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Today &middot; {totalTendersAllTime.toLocaleString()} all-time
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
        </div>

        {/* Next Scheduled Run */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Next Scheduled Run
            </span>
            <Timer className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{nextRun}</p>
          <p className="text-xs text-muted-foreground mt-1">GeM &middot; Every 2h cycle</p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Manual Actions */}
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
          disabled={runningAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
        >
          {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run All Scrapers
        </button>
        <button
          onClick={() => void runFailed()}
          disabled={runningFailed || portals.filter((p) => p.status === 'FAILED').length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 text-sm font-medium transition-colors disabled:opacity-30"
        >
          {runningFailed ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Run Failed Only
        </button>
        <button
          onClick={clearFailed}
          disabled={portals.filter((p) => p.status === 'FAILED').length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground/80 hover:bg-muted text-sm font-medium transition-colors disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
          Clear Failed Jobs
        </button>
        <button
          onClick={() => setShowScheduleEditor(!showScheduleEditor)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground/80 hover:bg-muted text-sm font-medium transition-colors"
        >
          <Clock className="w-4 h-4" />
          Edit Schedule
        </button>
      </div>

      {/* Schedule Editor */}
      {showScheduleEditor && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Edit Scraper Schedule</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={scheduleForm.portalId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, portalId: e.target.value })}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-500 flex-1"
            >
              <option value="">Select portal...</option>
              {portals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={scheduleForm.interval}
              onChange={(e) => setScheduleForm({ ...scheduleForm, interval: e.target.value })}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-500 flex-1"
            >
              <option value="">Select interval...</option>
              <option value="Every 30m">Every 30 minutes</option>
              <option value="Every 1h">Every 1 hour</option>
              <option value="Every 2h">Every 2 hours</option>
              <option value="Every 3h">Every 3 hours</option>
              <option value="Every 4h">Every 4 hours</option>
              <option value="Every 6h">Every 6 hours</option>
              <option value="Every 12h">Every 12 hours</option>
              <option value="Every 24h">Every 24 hours</option>
            </select>
            <button
              onClick={handleScheduleSave}
              disabled={!scheduleForm.portalId || !scheduleForm.interval}
              className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-foreground text-sm font-medium transition-colors disabled:opacity-30"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. Portal Status Table */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            Portal Status
          </h2>
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
                      <div>
                        <p className="font-medium text-foreground">{portal.name}</p>
                        <p className="text-xs text-muted-foreground">{portal.domain}</p>
                      </div>
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

                      {/* Toggle Enable/Disable */}
                      <button
                        onClick={() => togglePortal(portal.id)}
                        className={`p-1.5 rounded-md hover:bg-muted transition-colors ${
                          portal.enabled ? 'text-emerald-400' : 'text-muted-foreground'
                        }`}
                        title={portal.enabled ? 'Disable' : 'Enable'}
                      >
                        {portal.enabled ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
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
                    No portals found matching &ldquo;{search}&rdquo;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Logs Viewer */}
      {showLogsPortal && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Logs: {portals.find((p) => p.id === showLogsPortal)?.name}
            </h3>
            <button
              onClick={() => setShowLogsPortal(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4 font-mono text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto bg-background">
            {activity
              .filter(
                (a) =>
                  a.portalName ===
                  portals.find((p) => p.id === showLogsPortal)?.name
              )
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
            {activity.filter(
              (a) =>
                a.portalName ===
                portals.find((p) => p.id === showLogsPortal)?.name
            ).length === 0 && <p className="text-muted-foreground">No log entries found.</p>}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Bottom Grid: Activity Log + Charts */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* 3. Recent Activity Log */}
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
                No activity for this portal.
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 4. Charts */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-6">
          {/* Tenders per Day Bar Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Tenders Scraped (Last 7 Days)
            </h3>
            <div className="flex items-end gap-2 h-32">
              {DAILY_TENDERS.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-primary-500 transition-all hover:bg-primary-600"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">{d.day.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Success/Failure by Portal */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Success Rate by Portal
            </h3>
            <div className="space-y-2">
              {PORTAL_RATES.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{p.name}</span>
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
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums shrink-0">
                    {p.success}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* New vs Duplicate */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              New vs Duplicate Tenders (Last 7 Days)
            </h3>
            <div className="flex items-end gap-2 h-28">
              {NEW_VS_DUP.map((d) => {
                const total = d.newT + d.dup;
                const newPct = total > 0 ? (d.newT / maxNewDup) * 100 : 0;
                const dupPct = total > 0 ? (d.dup / maxNewDup) * 100 : 0;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums">{total}</span>
                    <div className="w-full flex flex-col-reverse" style={{ height: '80px' }}>
                      <div
                        className="w-full bg-emerald-500 rounded-b-md"
                        style={{ height: `${newPct}%` }}
                      />
                      <div
                        className="w-full bg-gray-300 rounded-t-md"
                        style={{ height: `${dupPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {d.day.split(' ')[1]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                New
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                Duplicate
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
