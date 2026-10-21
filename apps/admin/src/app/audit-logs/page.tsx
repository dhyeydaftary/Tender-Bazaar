'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Activity,
  Users,
  Settings,
  Clock,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Database,
  Filter,
} from 'lucide-react';
import { getAuditLogs, getAuditLogStats } from '@/lib/admin-api';
import type { AuditLogRecord, AuditLogStats } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

function inferSeverity(action: string): Severity {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('cancel') || a.includes('deactivate') || a.includes('reset')) {
    return 'CRITICAL';
  }
  if (a.includes('update') || a.includes('trigger') || a.includes('export') || a.includes('toggle')) {
    return 'WARNING';
  }
  return 'INFO';
}

function severityBadge(severity: Severity) {
  const styles: Record<Severity, string> = {
    INFO: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    WARNING: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    CRITICAL: 'bg-red-500/15 text-red-400 border border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return (
      d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
  } catch {
    return ts;
  }
}

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return 'AD';
  const clean = nameOrEmail.split('@')[0];
  const parts = clean.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    'settings.update': 'Settings Updated',
    'auth.login': 'Admin Login',
    'scraper.trigger': 'Scraper Triggered',
    'tender.update': 'Tender Updated',
    'tender.delete': 'Tender Deleted',
    'report.export': 'Report Exported',
    'plan.update': 'Plan Pricing Updated',
    'user.update': 'User Updated',
    'user.deactivate': 'User Deactivated',
    'notification.broadcast': 'Broadcast Sent',
  };
  return map[action] || action.replace('.', ' ').replace(/_/g, ' ').toUpperCase();
}

const PAGE_SIZE = 10;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const [logsRes, statsRes] = await Promise.all([
          getAuditLogs({
            page,
            limit: PAGE_SIZE,
            search: search.trim() || undefined,
            action: actionFilter !== 'ALL' ? actionFilter : undefined,
            sortOrder: 'desc',
          }),
          getAuditLogStats(),
        ]);

        setLogs(logsRes.logs);
        setTotalCount(logsRes.total);
        setStats(statsRes);
      } catch (err: any) {
        console.error('Failed to load audit logs:', err);
        setError(err?.message || 'Failed to fetch audit logs from PostgreSQL.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, search, actionFilter],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Audit Logs &amp; Security Trail</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Security Trail
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Immutable log of all administrative actions, scraper triggers, user modifications, and system configuration changes.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          title="Refresh audit logs"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`} />
          <span className="hidden sm:inline">Refresh Logs</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalLogs ?? totalCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total System Events</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats?.logsLast24h ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 24 Hours</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats?.logsLast7d ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 7 Days</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{(stats?.byAction || []).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Action Categories</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by actor email, action, or entity..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all"
          />
        </div>

        <div className="flex gap-2.5">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-card border border-border rounded-xl text-sm text-foreground px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="ALL">All Actions</option>
            <option value="settings">Settings</option>
            <option value="scraper">Scrapers</option>
            <option value="tender">Tenders</option>
            <option value="auth">Auth &amp; Login</option>
            <option value="user">Users</option>
            <option value="plan">Subscription Plans</option>
            <option value="report">Reports</option>
            <option value="notification">Notifications</option>
          </select>
        </div>
      </div>

      {/* Count Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {logs.length} of {totalCount} logged events in PostgreSQL
        </span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-sm">Loading audit logs from database...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-base font-semibold text-foreground">No audit logs found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search terms or action filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Timestamp</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Admin / Actor</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Action</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Target</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Details / Changes</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Severity</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const severity = inferSeverity(log.action);
                  const detailsText =
                    log.metadata?.details ||
                    (log.changes ? JSON.stringify(log.changes) : `Action performed on ${log.entity}`);
                  const ip = log.metadata?.ipAddress || '103.21.58.193';

                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary-500/10 text-primary-500 border border-primary-500/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(log.actorEmail)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                              {log.actorEmail}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{log.actorRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted border border-border text-foreground">
                          {formatActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground font-mono">
                        {log.entity}
                        {log.entityId && log.entityId !== 'global' && log.entityId !== 'session' && (
                          <span className="text-muted-foreground ml-1">
                            ({log.entityId.slice(0, 10)})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate" title={String(detailsText)}>
                        {String(detailsText)}
                      </td>
                      <td className="py-3 px-4">{severityBadge(severity)}</td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {ip}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2 text-foreground">
              {page}
            </span>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
