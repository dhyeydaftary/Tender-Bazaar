'use client';

import { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  TrendingUp,
  Users,
  IndianRupee,
  RefreshCw,
  CheckCircle,
  Loader2,
  Database,
  Brain,
  Mail,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getRevenueReport,
  getUserReport,
  getTenderReport,
  getSubscriptionReport,
  getScraperHealth,
  getDashboardStats,
} from '@/lib/admin-api';
import { useAuthStore } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReportFormat = 'CSV' | 'JSON' | 'PDF';
type DateRange = 'last_7_days' | 'last_30_days' | 'last_quarter' | 'all_time';
type GenerateState = 'idle' | 'generating' | 'ready';
type ReportStatus = 'Ready' | 'Processing' | 'Failed';

interface DownloadPayload {
  filename: string;
  content: string; // CSV string, JSON string, or data URI for PDF
  mimeType: string;
  format: ReportFormat;
}

interface ReportTemplate {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  lastGenerated: string;
  format: ReportFormat;
  dateRange: DateRange;
  state: GenerateState;
  downloadData?: DownloadPayload;
}

interface RecentReport {
  id: string;
  name: string;
  generatedBy: string;
  date: string;
  format: ReportFormat;
  size: string;
  sizeBytes?: number;
  status: ReportStatus;
  downloadData?: DownloadPayload;
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

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  last_quarter: 'Last Quarter',
  all_time: 'All Time',
};

function getDateRangeParams(range: DateRange): { startDate: string; endDate: string } {
  const end = new Date();
  if (range === 'all_time') {
    return { startDate: new Date(0).toISOString(), endDate: end.toISOString() };
  }
  const start = new Date();
  if (range === 'last_7_days') {
    start.setDate(end.getDate() - 7);
  } else if (range === 'last_30_days') {
    start.setDate(end.getDate() - 30);
  } else if (range === 'last_quarter') {
    start.setDate(end.getDate() - 90);
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

const INITIAL_TEMPLATES: ReportTemplate[] = [
  {
    id: 'tender',
    icon: <FileText className="w-6 h-6" />,
    title: 'Tender Inventory Report',
    description:
      'Live database tender inventory by portal (GeM, CPPP), category (Goods, Works), state, and estimated values.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'all_time',
    state: 'idle',
  },
  {
    id: 'revenue',
    icon: <IndianRupee className="w-6 h-6" />,
    title: 'Revenue & Billing Report',
    description:
      'Payment transactions, subscription plan breakdown, MRR, ARR, and payment status from PostgreSQL.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'all_time',
    state: 'idle',
  },
  {
    id: 'users',
    icon: <Users className="w-6 h-6" />,
    title: 'User Analytics & Signups',
    description:
      'Active user roster, role distribution, email verification status, and registration timeline.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'all_time',
    state: 'idle',
  },
  {
    id: 'subscriptions',
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Subscription Plans & Churn',
    description:
      'Plan distributions (Free, Starter, Professional), billing cycles, and active subscriber status.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'all_time',
    state: 'idle',
  },
  {
    id: 'scrapers',
    icon: <Database className="w-6 h-6" />,
    title: 'Scraper Health & Ingestion',
    description:
      'Status across all 13 government tender portals, run frequencies, errors, and success counts.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'last_7_days',
    state: 'idle',
  },
  {
    id: 'search',
    icon: <Brain className="w-6 h-6" />,
    title: 'Platform Search & Trends',
    description:
      'High-demand and top-viewed tenders with traffic rankings and engagement metrics.',
    lastGenerated: 'Live DB Ready',
    format: 'CSV',
    dateRange: 'last_30_days',
    state: 'idle',
  },
];

/**
 * DEMO DATA — not real scheduled reports.
 *
 * Nothing in this repository dispatches report emails: there is no scheduler,
 * route or worker behind these rows, and the toggle below only changes local
 * component state. They are retained as a UI placeholder, and the panel is
 * labelled accordingly, because an operator could otherwise reasonably believe
 * a "Daily Scraper Sync Audit" email was arriving every morning.
 *
 * To make these real, add persistence plus a dispatch job (the BullMQ repeat
 * pattern in packages/api-server/src/queue/alert-scheduler.ts is the closest
 * existing example) and replace this constant with a fetch.
 */
const INITIAL_SCHEDULED: ScheduledReport[] = [
  {
    id: 'sched-1',
    name: 'Weekly Revenue & Subscriptions',
    frequency: 'Every Monday 9:00 AM',
    nextRun: 'Next Monday 09:00 AM',
    recipients: 'admin@tenderbazaar.com',
    deliveryMethod: 'Email',
    active: true,
  },
  {
    id: 'sched-2',
    name: 'Daily Scraper Sync Audit',
    frequency: 'Every day 6:00 AM',
    nextRun: 'Tomorrow 06:00 AM',
    recipients: 'admin@tenderbazaar.com',
    deliveryMethod: 'Email',
    active: true,
  },
  {
    id: 'sched-3',
    name: 'Monthly Tender & User Growth',
    frequency: '1st of every month',
    nextRun: '1st of next month',
    recipients: 'admin@tenderbazaar.com',
    deliveryMethod: 'Email',
    active: true,
  },
];

function downloadFile(filename: string, content: string | Blob, mimeType: string) {
  let url: string;
  let isBlobUrl = false;

  if (typeof content === 'string' && content.startsWith('data:')) {
    url = content;
  } else {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    url = URL.createObjectURL(blob);
    isBlobUrl = true;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (isBlobUrl) {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function formatStorageSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0.0 KB';
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  const kb = 1024;

  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(2)} GB`;
  }
  if (bytes >= mb) {
    return `${(bytes / mb).toFixed(1)} MB`;
  }
  return `${(bytes / kb).toFixed(1)} KB`;
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return 'No data available\n';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

function generatePDFData(title: string, rangeLabel: string, rawData: any[]): { blob: Blob; dataUri: string } {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 45, 'F');

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 25, 28);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `TenderBazaar System Export | Range: ${rangeLabel} | Date: ${new Date().toLocaleString()} | Total Records: ${rawData.length}`,
    25,
    62,
  );

  if (rawData && rawData.length > 0) {
    const headers = Object.keys(rawData[0]);
    const rows = rawData.slice(0, 1000).map((row) =>
      headers.map((h) => (row[h] === null || row[h] === undefined ? '' : String(row[h]))),
    );

    autoTable(doc, {
      startY: 72,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 4,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [2, 132, 199], // sky-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { top: 72, left: 25, right: 25, bottom: 25 },
    });
  }

  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  return { blob, dataUri };
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<ReportTemplate[]>(INITIAL_TEMPLATES);
  const [scheduled, setScheduled] = useState<ScheduledReport[]>(INITIAL_SCHEDULED);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [totalTendersCount, setTotalTendersCount] = useState<number>(0);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  // Load live counts and saved recent reports from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tb_admin_recent_reports');
      if (saved) {
        const parsed: RecentReport[] = JSON.parse(saved);
        setRecentReports(parsed);
        const totalSize = parsed.reduce((sum, r) => sum + (r.sizeBytes || r.downloadData?.content?.length || 0), 0);
        setStorageBytes(totalSize);
      }
    } catch {}

    // Fetch live dashboard & report metrics on mount and keep updated dynamically
    const fetchLiveMetrics = async () => {
      try {
        const stats = await getDashboardStats();
        if (typeof stats?.tenders?.total === 'number') {
          setTotalTendersCount(stats.tenders.total);
        }
        if (typeof stats?.users?.total === 'number') {
          setTotalUsersCount(stats.users.total);
        }
      } catch {}
    };

    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 8000);
    return () => clearInterval(interval);
  }, []);

  const saveRecentReports = (list: RecentReport[]) => {
    setRecentReports(list);
    try {
      localStorage.setItem('tb_admin_recent_reports', JSON.stringify(list));
    } catch {}
  };

  // When format is switched, reset state to idle so user generates fresh data in that format
  const updateTemplateFormat = (id: string, format: ReportFormat) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, format, state: 'idle', downloadData: undefined } : t,
      ),
    );
  };

  // When date range is switched, reset state to idle so user queries fresh data for that range
  const updateTemplateDateRange = (id: string, dateRange: DateRange) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, dateRange, state: 'idle', downloadData: undefined } : t,
      ),
    );
  };

  const toggleScheduled = (id: string) => {
    setScheduled((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  };

  // Generate real report by fetching live PostgreSQL data and immediately downloading the file
  const handleGenerate = async (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;

    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, state: 'generating' } : t)),
    );

    try {
      let rawData: any[] = [];
      let filenamePrefix = template.id;
      const { startDate, endDate } = getDateRangeParams(template.dateRange);

      if (id === 'tender') {
        const res = await getTenderReport({ startDate, endDate });
        if (res.tenders && res.tenders.length > 0) {
          rawData = res.tenders.map((t) => ({
            ReferenceNumber: t.referenceNumber || t.id,
            Title: t.title,
            Organization: t.organization,
            Category: t.category,
            State: t.state || 'N/A',
            Status: t.status,
            SourcePortal: t.sourcePortal,
            EstimatedValueINR: t.estimatedValue != null ? t.estimatedValue : 0,
            SubmissionDeadline: t.bidSubmissionDeadline ? new Date(t.bidSubmissionDeadline).toLocaleDateString() : 'N/A',
            PublishedDate: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A',
          }));
        } else {
          rawData = res.byCategory.map((c) => ({
            Metric: 'Category Breakdown',
            Category: c.category,
            Count: c.count,
            TotalTenders: res.totalTenders,
            TotalEstimatedValueINR: res.totalEstimatedValue,
            TotalViews: res.totalViews,
          }));
        }
        filenamePrefix = 'tenders-report';
      } else if (id === 'revenue') {
        const res = await getRevenueReport({ startDate, endDate });
        if (res.payments && res.payments.length > 0) {
          rawData = res.payments.map((p) => ({
            PaymentID: p.id,
            CustomerName: p.userName,
            CustomerEmail: p.userEmail,
            Plan: p.plan,
            BillingCycle: p.cycle,
            AmountINR: p.amount,
            Currency: p.currency,
            Status: p.status,
            Gateway: p.gateway,
            Date: new Date(p.date).toLocaleString(),
          }));
        } else {
          rawData = res.planBreakdown.map((p) => ({
            Plan: p.plan,
            RevenueINR: p.amount,
            TransactionCount: p.count,
            MRR: res.mrr,
            ARR: res.arr,
          }));
        }
        filenamePrefix = 'revenue-report';
      } else if (id === 'users') {
        const res = await getUserReport({ startDate, endDate });
        if (res.users && res.users.length > 0) {
          rawData = res.users.map((u) => ({
            UserID: u.id,
            Name: u.name,
            Email: u.email,
            Role: u.role,
            EmailVerified: u.isEmailVerified ? 'Yes' : 'No',
            JoinedDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A',
          }));
        } else {
          rawData = (res.roleDistribution || res.byRole || []).map((r) => ({
            Role: r.role,
            Count: r.count,
            VerifiedUsers: res.verifiedUsers,
            VerificationRate: `${res.verificationRate}%`,
            TotalUsers: res.totalUsers,
          }));
        }
        filenamePrefix = 'users-report';
      } else if (id === 'subscriptions') {
        const res = await getSubscriptionReport({ startDate, endDate });
        if (res.subscriptions && res.subscriptions.length > 0) {
          rawData = res.subscriptions.map((s) => ({
            SubscriptionID: s.id,
            CustomerName: s.userName,
            CustomerEmail: s.userEmail,
            Plan: s.plan,
            BillingCycle: s.cycle,
            Status: s.status,
            StartDate: new Date(s.startDate).toLocaleDateString(),
            EndDate: new Date(s.endDate).toLocaleDateString(),
          }));
        } else {
          rawData = res.byPlan.map((p) => ({
            Plan: p.plan,
            Subscribers: p.count,
            TotalSubscriptions: res.totalSubscriptions,
            ChurnRate: `${res.churnRate}%`,
          }));
        }
        filenamePrefix = 'subscriptions-report';
      } else if (id === 'scrapers') {
        const scrapers = await getScraperHealth();
        const minDate = new Date(startDate);
        const filtered = template.dateRange === 'all_time'
          ? scrapers
          : scrapers.filter((s) => s.lastRunAt && new Date(s.lastRunAt) >= minDate);
        const toExport = filtered.length > 0 ? filtered : scrapers;
        rawData = toExport.map((s) => ({
          Portal: s.portalName,
          Status: s.status,
          Enabled: s.enabled ? 'Yes' : 'No',
          TotalRuns: s.totalRuns,
          SuccessRuns: s.totalSuccessRuns,
          FailedRuns: s.totalFailedRuns,
          TendersFound: s.totalTendersFound,
          ErrorRate: `${s.errorRate}%`,
          LastRun: s.lastRunAt || 'Never',
        }));
        filenamePrefix = 'scrapers-health-report';
      } else if (id === 'search') {
        const res = await getTenderReport({ startDate, endDate });
        const sorted = (res.tenders || []).slice(0, 100).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        rawData = sorted.map((t) => ({
          TenderID: t.referenceNumber || t.id,
          Title: t.title,
          Organization: t.organization,
          Category: t.category,
          State: t.state || 'N/A',
          ViewCount: t.viewCount || 0,
          EstimatedValueINR: t.estimatedValue != null ? t.estimatedValue : 0,
          PublishedDate: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A',
        }));
        filenamePrefix = 'search-and-trends-report';
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const rangeTag = template.dateRange.replace(/_/g, '-');
      const filename = `${filenamePrefix}-${rangeTag}-${dateStr}.${template.format.toLowerCase()}`;

      let fileContent: string = '';
      let mimeType: string = '';
      let downloadPayload: string | Blob = '';
      let sizeBytes = 0;

      if (template.format === 'CSV') {
        fileContent = convertToCSV(rawData);
        mimeType = 'text/csv;charset=utf-8;';
        downloadPayload = fileContent;
        sizeBytes = new Blob([fileContent]).size;
      } else if (template.format === 'JSON') {
        fileContent = JSON.stringify(rawData, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        downloadPayload = fileContent;
        sizeBytes = new Blob([fileContent]).size;
      } else if (template.format === 'PDF') {
        const { blob, dataUri } = generatePDFData(
          template.title,
          DATE_RANGE_LABELS[template.dateRange],
          rawData,
        );
        mimeType = 'application/pdf';
        fileContent = dataUri;
        downloadPayload = blob;
        sizeBytes = blob.size;
      }

      const sizeLabel = formatStorageSize(sizeBytes);

      setStorageBytes((prev) => prev + sizeBytes);

      const downloadData: DownloadPayload = {
        filename,
        content: fileContent,
        mimeType,
        format: template.format,
      };

      // 1. Immediately trigger the file download in the browser
      downloadFile(filename, downloadPayload, mimeType);

      // 2. Update template state to ready with the download data
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                state: 'ready',
                lastGenerated: 'Just now',
                downloadData,
              }
            : t,
        ),
      );

      // 3. Add to recent exports table
      const newReport: RecentReport = {
        id: `rep-${Date.now()}`,
        name: `${template.title} (${DATE_RANGE_LABELS[template.dateRange]})`,
        generatedBy: user?.name ? `${user.name} (${user.role})` : user?.email || 'Administrator',
        date: dateStr,
        format: template.format,
        size: sizeLabel,
        sizeBytes,
        status: 'Ready',
        downloadData,
      };

      saveRecentReports([newReport, ...recentReports.slice(0, 19)]);
      setNotification(`Downloaded ${newReport.name} [${template.format}] with ${rawData.length} records!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('Error generating report:', err);
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, state: 'idle' } : t)),
      );
      setNotification(`Failed to generate report: ${err?.message || 'Server error'}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDownload = (template: ReportTemplate) => {
    if (template.downloadData) {
      downloadFile(
        template.downloadData.filename,
        template.downloadData.content,
        template.downloadData.mimeType,
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Reports &amp; Data Exports</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real PostgreSQL Export
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Export live data directly from PostgreSQL database in CSV, JSON, and PDF formats.
          </p>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 text-foreground text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-primary-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reports Created</p>
          <p className="text-2xl font-bold text-foreground mt-1">{recentReports.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Session &amp; historical</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tenders in Database</p>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{totalTendersCount.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Available for export</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Registered Users</p>
          <p className="text-2xl font-bold text-accent-500 mt-1">{totalUsersCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">In User table</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Storage Exported</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatStorageSize(storageBytes)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cumulative payload</p>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Available Report Templates                                         */}
      {/* ================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-bold text-foreground">Available Report Generators</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary-500/40 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20">
                    {tpl.icon}
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                    {tpl.lastGenerated}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground">{tpl.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border space-y-3">
                {/* Format selection */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Format:</span>
                  <div className="flex gap-1.5">
                    {(['CSV', 'JSON', 'PDF'] as ReportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => updateTemplateFormat(tpl.id, fmt)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                          tpl.format === fmt
                            ? 'bg-primary-500 text-white shadow-sm ring-1 ring-primary-400'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range selection */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Range:</span>
                  <select
                    value={tpl.dateRange}
                    onChange={(e) => updateTemplateDateRange(tpl.id, e.target.value as DateRange)}
                    className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                  >
                    {Object.entries(DATE_RANGE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Generate & Download CTA */}
                {tpl.state === 'ready' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(tpl)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download {tpl.format}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerate(tpl.id)}
                      title="Generate and download again"
                      className="p-2.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerate(tpl.id)}
                    disabled={tpl.state === 'generating'}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {tpl.state === 'generating' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating {tpl.format}...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate &amp; Download {tpl.format}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Generated Reports History                                         */}
      {/* ================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-foreground">Recent Exports</h2>
          </div>
          {recentReports.length > 0 && (
            <button
              onClick={() => saveRecentReports([])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear history
            </button>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {recentReports.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Download className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No exports generated yet. Click &quot;Generate &amp; Download&quot; on any template above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Report Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Generated By</th>
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Format</th>
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Size</th>
                    <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentReports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-foreground">{r.name}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{r.generatedBy}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{r.date}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-primary-500">{r.format}</td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{r.size}</td>
                      <td className="py-3 px-4 text-right">
                        {r.downloadData && (
                          <button
                            type="button"
                            onClick={() => downloadFile(r.downloadData!.filename, r.downloadData!.content, r.downloadData!.mimeType)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-white transition-all border border-primary-500/20"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Scheduled Automation                                              */}
      {/* ================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Mail className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-bold text-foreground">Scheduled Report Dispatches</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-600 border border-amber-500/30">
            Demo data
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Placeholder only — no report emails are dispatched by the platform yet, and
          toggling a row does not persist.
        </p>

        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {scheduled.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.active
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {item.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.frequency} &bull; Next run: <span className="text-foreground/80 font-medium">{item.nextRun}</span>
                </p>
                <p className="text-xs text-muted-foreground">Recipients: {item.recipients}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleScheduled(item.id)}
                className="self-start sm:self-center flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-foreground"
              >
                {item.active ? (
                  <>
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    <span>Disabled</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
