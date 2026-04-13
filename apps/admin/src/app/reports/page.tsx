'use client';

import { useState } from 'react';
import {
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Users,
  IndianRupee,
  BarChart3,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Database,
  Cpu,
  Brain,
  Mail,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReportFormat = 'PDF' | 'CSV' | 'XLSX';
type DateRange = 'last_7_days' | 'last_30_days' | 'last_quarter' | 'custom';
type GenerateState = 'idle' | 'generating' | 'ready';
type ReportStatus = 'Ready' | 'Processing' | 'Failed';

interface ReportTemplate {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  lastGenerated: string;
  format: ReportFormat;
  dateRange: DateRange;
  state: GenerateState;
}

interface RecentReport {
  id: number;
  name: string;
  generatedBy: string;
  date: string;
  format: ReportFormat;
  size: string;
  status: ReportStatus;
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  nextRun: string;
  recipients: string;
  deliveryMethod: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  last_quarter: 'Last Quarter',
  custom: 'Custom',
};

const INITIAL_TEMPLATES: ReportTemplate[] = [
  {
    id: 'revenue',
    icon: <IndianRupee className="w-6 h-6" />,
    title: 'Revenue Report',
    description:
      'Monthly/yearly revenue breakdown by plan, payment methods, refunds, and net revenue trends.',
    lastGenerated: '2 days ago',
    format: 'PDF',
    dateRange: 'last_30_days',
    state: 'idle',
  },
  {
    id: 'user-analytics',
    icon: <Users className="w-6 h-6" />,
    title: 'User Analytics Report',
    description:
      'User growth, retention, churn rate, geographic distribution, and cohort analysis.',
    lastGenerated: '5 days ago',
    format: 'PDF',
    dateRange: 'last_30_days',
    state: 'idle',
  },
  {
    id: 'tender',
    icon: <FileText className="w-6 h-6" />,
    title: 'Tender Report',
    description:
      'Tender volume by portal, category, and state; bid success rates and average values.',
    lastGenerated: '1 day ago',
    format: 'CSV',
    dateRange: 'last_quarter',
    state: 'idle',
  },
  {
    id: 'subscription',
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Subscription Report',
    description:
      'Plan distribution, upgrades, downgrades, ARPU, LTV, and MRR tracking.',
    lastGenerated: '3 days ago',
    format: 'XLSX',
    dateRange: 'last_30_days',
    state: 'idle',
  },
  {
    id: 'scraper',
    icon: <Database className="w-6 h-6" />,
    title: 'Scraper Performance',
    description:
      'Portal-wise success rates, uptime percentages, error frequency, and response times.',
    lastGenerated: '12 hours ago',
    format: 'PDF',
    dateRange: 'last_7_days',
    state: 'idle',
  },
  {
    id: 'ai-usage',
    icon: <Brain className="w-6 h-6" />,
    title: 'AI Usage Report',
    description:
      'Eligibility checks performed, bid assistant usage, accuracy metrics, and token consumption.',
    lastGenerated: '4 days ago',
    format: 'CSV',
    dateRange: 'last_30_days',
    state: 'idle',
  },
];

const RECENT_REPORTS: RecentReport[] = [
  { id: 1, name: 'Revenue Report - March 2026', generatedBy: 'Parth Savajadiya', date: '2026-04-09', format: 'PDF', size: '2.4 MB', status: 'Ready' },
  { id: 2, name: 'User Analytics - Q1 2026', generatedBy: 'Priya Sharma', date: '2026-04-08', format: 'XLSX', size: '5.1 MB', status: 'Ready' },
  { id: 3, name: 'Tender Volume - Weekly', generatedBy: 'Parth Savajadiya', date: '2026-04-07', format: 'CSV', size: '890 KB', status: 'Ready' },
  { id: 4, name: 'Scraper Health - April W1', generatedBy: 'System (Auto)', date: '2026-04-07', format: 'PDF', size: '1.2 MB', status: 'Ready' },
  { id: 5, name: 'Subscription Report - March', generatedBy: 'Amit Patel', date: '2026-04-05', format: 'XLSX', size: '3.7 MB', status: 'Ready' },
  { id: 6, name: 'AI Usage Report - March', generatedBy: 'Priya Sharma', date: '2026-04-04', format: 'PDF', size: '1.8 MB', status: 'Processing' },
  { id: 7, name: 'Revenue Report - February 2026', generatedBy: 'Parth Savajadiya', date: '2026-04-01', format: 'PDF', size: '2.1 MB', status: 'Ready' },
  { id: 8, name: 'Tender Report - Q1 2026', generatedBy: 'Amit Patel', date: '2026-03-31', format: 'CSV', size: '4.5 MB', status: 'Ready' },
  { id: 9, name: 'User Growth - March Cohort', generatedBy: 'Priya Sharma', date: '2026-03-30', format: 'XLSX', size: '2.9 MB', status: 'Failed' },
  { id: 10, name: 'Weekly Revenue Summary', generatedBy: 'System (Auto)', date: '2026-03-28', format: 'PDF', size: '980 KB', status: 'Ready' },
];

const INITIAL_SCHEDULED: ScheduledReport[] = [
  {
    id: 'sched-1',
    name: 'Weekly Revenue Summary',
    frequency: 'Every Monday 9:00 AM',
    nextRun: 'Mon, Apr 14 2026 09:00 AM',
    recipients: 'superadmin@tenderbazaar.com',
    deliveryMethod: 'Email',
    active: true,
  },
  {
    id: 'sched-2',
    name: 'Daily Scraper Health',
    frequency: 'Every day 6:00 AM',
    nextRun: 'Sat, Apr 12 2026 06:00 AM',
    recipients: 'Admin team (5 members)',
    deliveryMethod: 'Email',
    active: true,
  },
  {
    id: 'sched-3',
    name: 'Monthly User Growth',
    frequency: '1st of every month',
    nextRun: 'Thu, May 1 2026 08:00 AM',
    recipients: 'superadmin@tenderbazaar.com, analytics@tenderbazaar.com',
    deliveryMethod: 'Email + Slack',
    active: true,
  },
  {
    id: 'sched-4',
    name: 'Quarterly Business Review',
    frequency: 'Every quarter end',
    nextRun: 'Tue, Jun 30 2026 09:00 AM',
    recipients: 'founders@tenderbazaar.com',
    deliveryMethod: 'Email',
    active: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBadgeColor(format: ReportFormat): string {
  switch (format) {
    case 'PDF':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'CSV':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'XLSX':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
}

function statusBadge(status: ReportStatus) {
  switch (status) {
    case 'Ready':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Ready
        </span>
      );
    case 'Processing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-1 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    case 'Failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>(INITIAL_TEMPLATES);
  const [scheduled, setScheduled] = useState<ScheduledReport[]>(INITIAL_SCHEDULED);
  const [scheduledExpanded, setScheduledExpanded] = useState(false);

  // Handle template format change
  const updateTemplateFormat = (id: string, format: ReportFormat) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, format } : t))
    );
  };

  // Handle template date range change
  const updateTemplateDateRange = (id: string, dateRange: DateRange) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dateRange } : t))
    );
  };

  // Handle generate button
  const handleGenerate = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, state: 'generating' as GenerateState } : t))
    );
    // Simulate generation time
    setTimeout(() => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, state: 'ready' as GenerateState } : t))
      );
    }, 2500);
  };

  // Toggle scheduled report active state
  const toggleScheduled = (id: string) => {
    setScheduled((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  // Storage percentage for progress bar
  const storageUsed = 2.4;
  const storageTotal = 10;
  const storagePercent = (storageUsed / storageTotal) * 100;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Reports &amp; Exports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate, download, and schedule business reports.
        </p>
      </div>

      {/* ================================================================== */}
      {/* Quick Stats Row                                                    */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Reports Generated */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Reports This Month</span>
            <div className="p-2 rounded-lg bg-primary-500/10">
              <BarChart3 className="w-4 h-4 text-primary-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">45</p>
          <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
        </div>

        {/* Scheduled Reports */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Scheduled Reports</span>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">8</p>
          <p className="text-xs text-muted-foreground mt-1">3 active, 5 paused</p>
        </div>

        {/* Last Generated */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Last Generated</span>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">2 hours ago</p>
          <p className="text-xs text-muted-foreground mt-1">Revenue Report - March</p>
        </div>

        {/* Storage Used */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Storage Used</span>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Database className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">2.4 GB / 10 GB</p>
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-orange-400"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Report Templates Section                                           */}
      {/* ================================================================== */}
      <SectionTitle title="Report Templates" icon={<FileText className="w-5 h-5" />} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-card border border-border rounded-xl p-6 flex flex-col"
          >
            {/* Icon + Title */}
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-primary-500/10 text-primary-500 shrink-0">
                {tmpl.icon}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{tmpl.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last generated: {tmpl.lastGenerated}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4 flex-1">{tmpl.description}</p>

            {/* Controls */}
            <div className="space-y-3">
              {/* Format selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14 shrink-0">Format:</span>
                <div className="flex gap-1.5">
                  {(['PDF', 'CSV', 'XLSX'] as ReportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => updateTemplateFormat(tmpl.id, fmt)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                        tmpl.format === fmt
                          ? formatBadgeColor(fmt)
                          : 'border-border text-muted-foreground hover:border-border hover:text-muted-foreground'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14 shrink-0">Range:</span>
                <select
                  value={tmpl.dateRange}
                  onChange={(e) =>
                    updateTemplateDateRange(tmpl.id, e.target.value as DateRange)
                  }
                  className="flex-1 text-xs bg-muted border border-border text-foreground/80 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
                >
                  {Object.entries(DATE_RANGE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generate button */}
              <button
                onClick={() => handleGenerate(tmpl.id)}
                disabled={tmpl.state === 'generating'}
                className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-lg transition-all ${
                  tmpl.state === 'ready'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : tmpl.state === 'generating'
                    ? 'bg-muted text-muted-foreground border border-border cursor-wait'
                    : 'bg-primary-500 text-foreground hover:bg-primary-600 active:bg-primary-700'
                }`}
              >
                {tmpl.state === 'generating' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                )}
                {tmpl.state === 'ready' && (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Ready - Download
                  </>
                )}
                {tmpl.state === 'idle' && (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================== */}
      {/* Recent Reports Table                                               */}
      {/* ================================================================== */}
      <SectionTitle title="Recent Reports" icon={<Clock className="w-5 h-5" />} />

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Report Name
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Generated By
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Format
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Size
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3.5 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {RECENT_REPORTS.map((report) => (
                <tr
                  key={report.id}
                  className="border-b border-border hover:bg-muted/40 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-gray-200 font-medium">
                        {report.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {report.generatedBy}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {report.date}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${formatBadgeColor(
                        report.format
                      )}`}
                    >
                      {report.format}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {report.size}
                  </td>
                  <td className="px-5 py-3.5">{statusBadge(report.status)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      disabled={report.status !== 'Ready'}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        report.status === 'Ready'
                          ? 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 border border-primary-500/30'
                          : 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Scheduled Reports Section (Collapsible)                            */}
      {/* ================================================================== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setScheduledExpanded(!scheduledExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="text-primary-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-foreground">Scheduled Reports</h2>
              <p className="text-xs text-muted-foreground">
                {scheduled.filter((s) => s.active).length} active,{' '}
                {scheduled.filter((s) => !s.active).length} paused
              </p>
            </div>
          </div>
          {scheduledExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Collapsible content */}
        {scheduledExpanded && (
          <div className="px-6 pb-6 space-y-4">
            {scheduled.map((sched) => (
              <div
                key={sched.id}
                className={`border rounded-xl p-5 transition-colors ${
                  sched.active
                    ? 'border-border bg-muted/30'
                    : 'border-border bg-card/50 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {sched.name}
                      </h3>
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          sched.active
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-muted-foreground bg-muted border-border'
                        }`}
                      >
                        {sched.active ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Frequency:</span>{' '}
                        <span className="text-foreground/80">{sched.frequency}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Next Run:</span>{' '}
                        <span className="text-foreground/80">{sched.nextRun}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Delivery:</span>{' '}
                        <span className="text-foreground/80">{sched.deliveryMethod}</span>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <span className="text-muted-foreground">Recipients:</span>{' '}
                        <span className="text-foreground/80 break-all">{sched.recipients}</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleScheduled(sched.id)}
                    className="shrink-0 self-start sm:self-center"
                    title={sched.active ? 'Pause schedule' : 'Activate schedule'}
                  >
                    {sched.active ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Title
// ---------------------------------------------------------------------------
function SectionTitle({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-2">
      <div className="text-primary-500">{icon}</div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
    </div>
  );
}
