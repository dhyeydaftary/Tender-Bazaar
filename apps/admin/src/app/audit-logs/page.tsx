'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Activity,
  Users,
  Settings,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ActionType =
  | 'USER_MODIFIED'
  | 'PLAN_CHANGED'
  | 'SETTING_UPDATED'
  | 'SCRAPER_TOGGLED'
  | 'NOTIFICATION_SENT'
  | 'USER_DELETED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'TENDER_MODIFIED'
  | 'EXPORT_DATA';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

type DateRange = 'today' | '7days' | '30days' | 'custom';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  adminName: string;
  adminInitials: string;
  action: ActionType;
  target: string;
  details: string;
  severity: Severity;
  ipAddress: string;
}

// ---------------------------------------------------------------------------
// Mock Data — 20 audit log entries
// ---------------------------------------------------------------------------
const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  { id: 1, timestamp: '2026-04-11T14:32:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'PLAN_CHANGED', target: 'Rajesh Kumar', details: 'Changed plan for Rajesh Kumar from Starter to Professional', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 2, timestamp: '2026-04-11T14:15:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'SCRAPER_TOGGLED', target: 'Maharashtra Scraper', details: 'Toggled Maharashtra scraper OFF', severity: 'WARNING', ipAddress: '49.36.142.87' },
  { id: 3, timestamp: '2026-04-11T13:48:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'NOTIFICATION_SENT', target: 'Bulk Users', details: 'Sent bulk notification to 1,245 users', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 4, timestamp: '2026-04-11T13:22:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'SETTING_UPDATED', target: 'Payment Gateway', details: 'Updated Razorpay API key', severity: 'CRITICAL', ipAddress: '49.36.142.87' },
  { id: 5, timestamp: '2026-04-11T12:55:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'EXPORT_DATA', target: 'User Records', details: 'Exported 5,000 user records', severity: 'WARNING', ipAddress: '103.21.58.193' },
  { id: 6, timestamp: '2026-04-11T12:30:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'USER_DELETED', target: 'Meena Gupta', details: 'Deleted inactive user account', severity: 'CRITICAL', ipAddress: '49.36.142.87' },
  { id: 7, timestamp: '2026-04-11T11:45:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'SETTING_UPDATED', target: 'Subscription Plans', details: 'Updated subscription pricing for Professional plan', severity: 'CRITICAL', ipAddress: '103.21.58.193' },
  { id: 8, timestamp: '2026-04-11T11:10:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'LOGIN', target: 'Admin Panel', details: 'Login from new IP address', severity: 'WARNING', ipAddress: '182.73.215.44' },
  { id: 9, timestamp: '2026-04-11T10:50:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'USER_MODIFIED', target: 'Priya Sharma', details: 'Updated email address for Priya Sharma', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 10, timestamp: '2026-04-11T10:22:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'TENDER_MODIFIED', target: 'TND-2026-04521', details: 'Manually updated tender status to Closed', severity: 'INFO', ipAddress: '49.36.142.87' },
  { id: 11, timestamp: '2026-04-11T09:55:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'SCRAPER_TOGGLED', target: 'GeM Portal Scraper', details: 'Toggled GeM Portal scraper ON after maintenance', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 12, timestamp: '2026-04-11T09:30:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'PLAN_CHANGED', target: 'Amit Patel', details: 'Changed plan for Amit Patel from Professional to Enterprise', severity: 'INFO', ipAddress: '49.36.142.87' },
  { id: 13, timestamp: '2026-04-11T09:05:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'SETTING_UPDATED', target: 'Email Templates', details: 'Updated welcome email template content', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 14, timestamp: '2026-04-11T08:40:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'USER_MODIFIED', target: 'Vikram Singh', details: 'Promoted Vikram Singh to ADMIN role', severity: 'CRITICAL', ipAddress: '49.36.142.87' },
  { id: 15, timestamp: '2026-04-11T08:15:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'LOGIN', target: 'Admin Panel', details: 'Routine login from known IP', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 16, timestamp: '2026-04-11T07:50:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'EXPORT_DATA', target: 'Tender Reports', details: 'Exported quarterly tender analytics report', severity: 'WARNING', ipAddress: '49.36.142.87' },
  { id: 17, timestamp: '2026-04-10T22:30:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'LOGOUT', target: 'Admin Panel', details: 'End of session logout', severity: 'INFO', ipAddress: '103.21.58.193' },
  { id: 18, timestamp: '2026-04-10T21:15:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'NOTIFICATION_SENT', target: 'Enterprise Users', details: 'Sent maintenance window notification to 89 Enterprise users', severity: 'INFO', ipAddress: '49.36.142.87' },
  { id: 19, timestamp: '2026-04-10T20:00:00', adminName: 'Karthik Iyer', adminInitials: 'KI', action: 'USER_DELETED', target: 'Arjun Verma', details: 'Deleted user account per GDPR request', severity: 'CRITICAL', ipAddress: '103.21.58.193' },
  { id: 20, timestamp: '2026-04-10T18:45:00', adminName: 'Sanjay Malhotra', adminInitials: 'SM', action: 'TENDER_MODIFIED', target: 'TND-2026-03887', details: 'Corrected tender value from 50L to 5Cr for CPPP tender', severity: 'WARNING', ipAddress: '49.36.142.87' },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACTION_TYPES: ActionType[] = [
  'USER_MODIFIED',
  'PLAN_CHANGED',
  'SETTING_UPDATED',
  'SCRAPER_TOGGLED',
  'NOTIFICATION_SENT',
  'USER_DELETED',
  'LOGIN',
  'LOGOUT',
  'TENDER_MODIFIED',
  'EXPORT_DATA',
];

const SEVERITIES: Severity[] = ['INFO', 'WARNING', 'CRITICAL'];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom' },
];

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function severityBadge(severity: Severity) {
  const styles: Record<Severity, string> = {
    INFO: 'bg-blue-500/15 text-blue-400',
    WARNING: 'bg-amber-500/15 text-amber-400',
    CRITICAL: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function actionLabel(action: ActionType): string {
  const labels: Record<ActionType, string> = {
    USER_MODIFIED: 'User Modified',
    PLAN_CHANGED: 'Plan Changed',
    SETTING_UPDATED: 'Setting Updated',
    SCRAPER_TOGGLED: 'Scraper Toggled',
    NOTIFICATION_SENT: 'Notification Sent',
    USER_DELETED: 'User Deleted',
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    TENDER_MODIFIED: 'Tender Modified',
    EXPORT_DATA: 'Export Data',
  };
  return labels[action];
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function isToday(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date('2026-04-11T15:00:00');
  return d.toDateString() === now.toDateString();
}

function isWithinDays(ts: string, days: number): boolean {
  const d = new Date(ts);
  const now = new Date('2026-04-11T15:00:00');
  const diff = now.getTime() - d.getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'All'>('All');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'All'>('All');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return MOCK_AUDIT_LOGS.filter((log) => {
      const q = search.toLowerCase();
      if (q && !log.adminName.toLowerCase().includes(q) && !log.details.toLowerCase().includes(q) && !actionLabel(log.action).toLowerCase().includes(q)) {
        return false;
      }
      if (actionFilter !== 'All' && log.action !== actionFilter) return false;
      if (severityFilter !== 'All' && log.severity !== severityFilter) return false;
      if (dateRange === 'today' && !isToday(log.timestamp)) return false;
      if (dateRange === '7days' && !isWithinDays(log.timestamp, 7)) return false;
      if (dateRange === '30days' && !isWithinDays(log.timestamp, 30)) return false;
      return true;
    });
  }, [search, actionFilter, severityFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats (mock summary numbers)
  const totalActionsToday = 156;
  const criticalActions = 12;
  const usersModified = 34;
  const settingsChanged = 8;

  const stats = [
    {
      label: 'Total Actions Today',
      value: totalActionsToday,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Critical Actions',
      value: criticalActions,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Users Modified',
      value: usersModified,
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Settings Changed',
      value: settingsChanged,
      icon: Settings,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track all administrative actions across the platform
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by admin name or action..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value as ActionType | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value as Severity | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value as DateRange); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {DATE_RANGES.map((dr) => (
              <option key={dr.value} value={dr.value}>{dr.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {filtered.length} log{filtered.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    No audit logs found matching your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80 shrink-0">
                          {log.adminInitials}
                        </div>
                        <span className="text-sm text-foreground font-medium whitespace-nowrap">{log.adminName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80">
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{log.target}</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{log.details}</td>
                    <td className="p-4">{severityBadge(log.severity)}</td>
                    <td className="p-4 text-sm text-muted-foreground font-mono text-xs">{log.ipAddress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {filtered.length > 0
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`
              : 'No results'}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page ? 'bg-primary-500 text-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
