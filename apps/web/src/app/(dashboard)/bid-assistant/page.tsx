'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Clock,
  ArrowRight,
  Building2,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Upload,
  Target,
  Wrench,
  Package,
  Settings,
  Briefcase,
  ChevronRight,
  FileCheck,
  Activity,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn, formatCurrency, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type BidStatus = 'in_progress' | 'documents_ready' | 'review_needed';

interface ActiveBid {
  id: string;
  tenderId: string;
  title: string;
  organization: string;
  category: string;
  documentsReady: number;
  documentsTotal: number;
  deadline: string;
  status: BidStatus;
  completionPercentage?: number;
}

interface RealTender {
  id: string;
  title: string;
  organization: string;
  category: string;
  estimatedValue: number;
  deadline: string;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  category: string;
  documentCount: number;
  icon: typeof Wrench;
  accentColor: string;
  accentBg: string;
  documents: { name: string; mandatory: boolean; description: string }[];
}

interface ActivityItem {
  id: string;
  description: string;
  timeAgo: string;
  icon: string;
  iconColor: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEMPLATES DEFINITION
   ═══════════════════════════════════════════════════════════════════════════ */

const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tpl-works',
    title: 'Works Tender Checklist',
    category: 'WORKS',
    documentCount: 12,
    icon: Wrench,
    accentColor: 'text-red-500',
    accentBg: 'bg-red-500/10',
    documents: [
      { name: 'Technical Bid Submission Form', mandatory: true, description: 'Signed and stamped technical proposal' },
      { name: 'Bill of Quantities (BOQ) / Price Bid', mandatory: true, description: 'Detailed financial schedule in Excel/PDF' },
      { name: 'Earnest Money Deposit (EMD) / BG', mandatory: true, description: 'Bank guarantee or online payment receipt' },
      { name: 'Audited Balance Sheets (3 Yrs)', mandatory: true, description: 'CA certified financial statements & net worth' },
      { name: 'Similar Works Completion Certificates', mandatory: true, description: 'Client certificates for past civil projects' },
      { name: 'GST Registration Certificate', mandatory: true, description: 'Valid GSTIN registration copy' },
      { name: 'PAN Card Copy', mandatory: true, description: 'Company / Firm PAN card' },
      { name: 'EPFO & ESIC Registration', mandatory: true, description: 'Statutory labor compliance certificates' },
      { name: 'Power of Attorney', mandatory: true, description: 'Authorized signatory resolution' },
      { name: 'Site Visit & Declaration Form', mandatory: true, description: 'Affidavit acknowledging site conditions' },
      { name: 'Machinery & Equipment Schedule', mandatory: true, description: 'List of owned / leased construction equipment' },
      { name: 'ISO 9001 / ISO 14001 Certificates', mandatory: false, description: 'Quality & environmental management certification' },
    ],
  },
  {
    id: 'tpl-goods',
    title: 'Goods Supply Checklist',
    category: 'GOODS',
    documentCount: 10,
    icon: Package,
    accentColor: 'text-blue-500',
    accentBg: 'bg-blue-500/10',
    documents: [
      { name: 'Technical Specification Compliance Sheet', mandatory: true, description: 'Item-by-item compliance matrix' },
      { name: 'Commercial Price Schedule', mandatory: true, description: 'Unit rates including freight & taxes' },
      { name: 'EMD Guarantee or MSME Exemption', mandatory: true, description: 'Udyam registration for EMD waiver' },
      { name: 'OEM Authorization Form (MAF)', mandatory: true, description: 'Direct manufacturer authorization certificate' },
      { name: 'GST Registration Certificate', mandatory: true, description: 'State-wise GSTIN copies' },
      { name: 'PAN Card Copy', mandatory: true, description: 'Company PAN card copy' },
      { name: 'Audited Financial Statements (CA Certified)', mandatory: true, description: 'Turnover certificate for last 3 years' },
      { name: 'Past Supply Performance Orders', mandatory: true, description: 'Copies of purchase orders executed' },
      { name: 'Warranty & Support Undertaking', mandatory: true, description: 'Comprehensive warranty commitment letter' },
      { name: 'Product Quality Certifications (BIS/CE)', mandatory: false, description: 'Standard quality certificates' },
    ],
  },
  {
    id: 'tpl-services',
    title: 'Services Tender Checklist',
    category: 'SERVICES',
    documentCount: 9,
    icon: Settings,
    accentColor: 'text-accent-500',
    accentBg: 'bg-accent-500/10',
    documents: [
      { name: 'Technical Proposal & Methodology', mandatory: true, description: 'Detailed service delivery plan' },
      { name: 'Financial Quotation Schedule', mandatory: true, description: 'Comprehensive manpower & fee schedule' },
      { name: 'Bid Security Declaration / EMD', mandatory: true, description: 'Online receipt or bank guarantee' },
      { name: 'Key Personnel CVs & Credentials', mandatory: true, description: 'CVs of deployed team members' },
      { name: 'Certificate of Incorporation', mandatory: true, description: 'MCA incorporation certificate' },
      { name: 'GST & PAN Registration', mandatory: true, description: 'Tax registration certificates' },
      { name: 'Non-Blacklisting Affidavit', mandatory: true, description: 'Notarized self-declaration on stamp paper' },
      { name: 'GeM Portal Registration Profile', mandatory: false, description: 'Government e-Marketplace verified seller copy' },
      { name: 'Client Satisfaction Testimonials', mandatory: false, description: 'Performance letters from government clients' },
    ],
  },
  {
    id: 'tpl-consultancy',
    title: 'Consultancy Checklist',
    category: 'CONSULTANCY',
    documentCount: 8,
    icon: Briefcase,
    accentColor: 'text-purple-500',
    accentBg: 'bg-purple-500/10',
    documents: [
      { name: 'Technical Approach & Work Plan', mandatory: true, description: 'Methodology and timeline chart' },
      { name: 'Key Experts CVs & Task Assignments', mandatory: true, description: 'Signed CVs of senior advisory consultants' },
      { name: 'Financial Proposal (Form FIN-1 to FIN-4)', mandatory: true, description: 'Remuneration & reimbursable cost sheets' },
      { name: 'Firm Experience in Advisory Projects', mandatory: true, description: 'Case studies of past similar assignments' },
      { name: 'Client Reference Letters', mandatory: true, description: 'End-user completion certificates' },
      { name: 'GST & Company Registration', mandatory: true, description: 'Valid registration documents' },
      { name: 'Annual Turnover Certificate from CA', mandatory: true, description: 'Turnover in consulting services' },
      { name: 'Power of Attorney / Board Resolution', mandatory: true, description: 'Authorization for signing the proposal' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function getStatusConfig(status: BidStatus) {
  const map = {
    in_progress: {
      label: 'In Progress',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      dotColor: 'bg-blue-500',
    },
    documents_ready: {
      label: 'Documents Ready',
      color: 'text-accent-600 dark:text-accent-400',
      bg: 'bg-accent-100 dark:bg-accent-900/30',
      dotColor: 'bg-accent-500',
    },
    review_needed: {
      label: 'Review Needed',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      dotColor: 'bg-amber-500',
    },
  };
  return map[status] || map.in_progress;
}

function renderActivityIcon(iconName: string, iconColor: string) {
  if (iconName === 'CheckCircle2') return <CheckCircle2 className={cn('w-3.5 h-3.5', iconColor)} />;
  if (iconName === 'Upload') return <Upload className={cn('w-3.5 h-3.5', iconColor)} />;
  if (iconName === 'AlertTriangle') return <AlertTriangle className={cn('w-3.5 h-3.5', iconColor)} />;
  return <FileText className={cn('w-3.5 h-3.5', iconColor)} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BidAssistantPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active_bids' | 'templates'>('active_bids');

  // Dynamic overview state
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [activeBids, setActiveBids] = useState<ActiveBid[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [rawStats, setRawStats] = useState<{
    activeBids: number;
    documentsUploaded: number;
    avgCompletion: number;
    upcomingDeadlines: number;
  }>({
    activeBids: 0,
    documentsUploaded: 0,
    avgCompletion: 0,
    upcomingDeadlines: 0,
  });

  // Real tenders list for "Start New Bid"
  const [availableTenders, setAvailableTenders] = useState<RealTender[]>([]);
  const [tendersLoading, setTendersLoading] = useState(true);

  // Template modal state
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);

  // Plan limit gate for AI checks
  const aiCheckLimit = useLimitGate('maxAiChecks');

  /* ─── Fetch Overview (Active Bids, Stats, Activity) ─── */
  const fetchOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const res = await api.get('/bid-assistant/overview');
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        if (Array.isArray(data.activeBids)) {
          setActiveBids(data.activeBids);
        }
        if (data.stats) {
          setRawStats(data.stats);
        }
        if (Array.isArray(data.recentActivity)) {
          setRecentActivity(data.recentActivity);
        }
      }
    } catch (err) {
      console.warn('Failed to load bid assistant overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  /* ─── Fetch Real Active Tenders ─── */
  const fetchActiveTenders = useCallback(async () => {
    try {
      setTendersLoading(true);
      const res = await api.get('/tenders', {
        params: { status: 'ACTIVE', limit: 50 },
      });
      const tenderList = res?.data?.data?.tenders || res?.data?.tenders;
      if (Array.isArray(tenderList)) {
        const mapped: RealTender[] = tenderList.map((t: any) => ({
          id: t.id,
          title: t.title ?? 'Untitled Tender',
          organization: t.organization ?? 'Government Organization',
          category: t.category ?? 'WORKS',
          estimatedValue: t.estimatedValue ?? 0,
          deadline: t.bidSubmissionDeadline ?? t.bidDeadline ?? t.closingDate ?? new Date(Date.now() + 14 * 86400000).toISOString(),
        }));
        setAvailableTenders(mapped);
      }
    } catch (err) {
      console.warn('Failed to load active tenders:', err);
    } finally {
      setTendersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchActiveTenders();
  }, [fetchOverview, fetchActiveTenders]);

  /* ─── Dynamically Calculated Stats ─── */
  const calculatedStats = useMemo(() => {
    const totalBids = activeBids.length || rawStats.activeBids;
    const docsUploaded = activeBids.reduce((sum, b) => sum + (b.documentsReady || 0), 0) || rawStats.documentsUploaded;
    const avgComp = activeBids.length > 0
      ? Math.round(
          activeBids.reduce((sum, b) => {
            const pct = b.completionPercentage ?? Math.round((b.documentsReady / (b.documentsTotal || 1)) * 100);
            return sum + pct;
          }, 0) / activeBids.length
        )
      : rawStats.avgCompletion;

    const upcoming = activeBids.filter((b) => {
      const deadlineInfo = getDeadlineInfo(b.deadline);
      return deadlineInfo.urgency !== 'expired' && deadlineInfo.days <= 30;
    }).length || rawStats.upcomingDeadlines;

    return [
      { key: 'active', label: 'Active Bids', value: totalBids, icon: Target, color: 'text-primary-500', bgColor: 'bg-primary-500/10' },
      { key: 'docs', label: 'Documents Uploaded', value: docsUploaded, icon: FileCheck, color: 'text-accent-500', bgColor: 'bg-accent-500/10' },
      { key: 'completion', label: 'Avg Completion', value: avgComp, icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-500/10', suffix: '%' },
      { key: 'deadlines', label: 'Upcoming Deadlines', value: upcoming, icon: Calendar, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    ];
  }, [activeBids, rawStats]);

  /* ─── Filtered Active Tenders for "Start New Bid" ─── */
  const filteredTenders = useMemo(() => {
    if (!searchQuery) return availableTenders.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return availableTenders
      .filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.organization.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [availableTenders, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Limit banner */}
      {!aiCheckLimit.hasCapacity && !aiCheckLimit.isUnlimited && (
        <UpgradeBanner
          feature="AI Bid Assistant"
          requiredPlan="Professional"
          currentPlan={aiCheckLimit.currentPlan}
          variant="card"
        />
      )}

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-heading-lg text-foreground font-display">Bid Assistant</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 font-semibold uppercase tracking-wider">
              Pro
            </span>
          </div>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            AI-powered bid preparation and document checklist
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-500" />
          <span className="text-body-sm text-muted-foreground">Powered by AI</span>
        </div>
      </div>

      {/* ── Quick Stats Row (Calculated Dynamically) ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {calculatedStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="group bg-card border border-border rounded-xl p-4 lg:p-5 hover:border-border/80 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px]">
                  {stat.label}
                </p>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bgColor)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <p className="text-display-sm font-mono text-foreground font-bold tracking-tight">
                {overviewLoading ? (
                  <span className="inline-block w-8 h-7 bg-muted animate-pulse rounded" />
                ) : (
                  `${stat.value}${stat.suffix ?? ''}`
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('active_bids')}
          className={cn(
            'px-4 py-2.5 text-body-sm font-medium transition-colors relative',
            activeTab === 'active_bids'
              ? 'text-primary-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Active Bids
          {activeTab === 'active_bids' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'px-4 py-2.5 text-body-sm font-medium transition-colors relative',
            activeTab === 'templates'
              ? 'text-primary-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Templates
          {activeTab === 'templates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
          )}
        </button>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          {activeTab === 'active_bids' ? (
            /* ── Active Bids in Progress ───────────────────────────── */
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-heading-sm text-foreground font-display">Active Bids in Progress</h2>
                <span className="text-caption text-muted-foreground font-mono">
                  {overviewLoading ? 'Loading...' : `${activeBids.length} bids`}
                </span>
              </div>
              <div className="divide-y divide-border">
                {overviewLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="w-7 h-7 text-primary-500 animate-spin mx-auto mb-2" />
                    <p className="text-body-sm text-muted-foreground">Calculating bid checklists...</p>
                  </div>
                ) : activeBids.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-body-sm font-medium text-foreground">No active bids in progress yet</p>
                    <p className="text-caption text-muted-foreground mt-1 max-w-sm mx-auto">
                      Select an active tender below to start preparing your proposal and checklist.
                    </p>
                  </div>
                ) : (
                  activeBids.map((bid) => {
                    const cat = getCategoryInfo(bid.category);
                    const deadline = getDeadlineInfo(bid.deadline);
                    const statusCfg = getStatusConfig(bid.status);
                    const progressPct =
                      bid.completionPercentage ??
                      Math.round((bid.documentsReady / (bid.documentsTotal || 1)) * 100);

                    return (
                      <div
                        key={bid.id}
                        className="px-5 py-4 hover:bg-muted/30 transition-colors"
                      >
                        {/* Top row: category + status + real deadline countdown */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>
                              {cat.label}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full',
                              statusCfg.bg,
                              statusCfg.color,
                            )}>
                              <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dotColor)} />
                              {statusCfg.label}
                            </span>
                          </div>
                          <span className={cn('text-caption font-medium flex items-center gap-1', deadline.color)}>
                            <Clock className="w-3.5 h-3.5" />
                            {deadline.text}
                          </span>
                        </div>

                        {/* Title + org */}
                        <Link
                          href={`/tenders/${bid.tenderId}/bid-assistant`}
                          className="group/title block"
                        >
                          <p className="text-body-sm text-foreground font-medium line-clamp-1 mb-0.5 group-hover/title:text-primary-500 transition-colors">
                            {bid.title}
                          </p>
                        </Link>
                        <p className="text-caption text-muted-foreground flex items-center gap-1 mb-3">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{bid.organization}</span>
                        </p>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-700',
                                progressPct === 100 ? 'bg-accent-500' : 'bg-primary-500',
                              )}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-caption font-mono text-muted-foreground shrink-0">
                            {bid.documentsReady}/{bid.documentsTotal} docs
                          </span>
                          <span className="text-caption font-mono font-medium text-foreground shrink-0">
                            {progressPct}%
                          </span>
                        </div>

                        {/* Continue button */}
                        <Link
                          href={`/tenders/${bid.tenderId}/bid-assistant`}
                          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-500 hover:text-primary-600 transition-colors group/btn"
                        >
                          Continue
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ── Document Checklist Templates ──────────────────────── */
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-heading-sm text-foreground font-display">Document Checklist Templates</h2>
                <span className="text-caption text-muted-foreground">Pre-built checklists for common tender types</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                {CHECKLIST_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <div
                      key={tpl.id}
                      className="border border-border rounded-xl p-4 hover:border-border/80 hover:shadow-md transition-all duration-200 bg-background flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start gap-3 mb-3">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', tpl.accentBg)}>
                            <Icon className={cn('w-5 h-5', tpl.accentColor)} />
                          </div>
                          <div>
                            <p className="text-body-sm font-semibold text-foreground">{tpl.title}</p>
                            <p className="text-caption text-muted-foreground mt-0.5">
                              {tpl.documentCount} verified documents
                            </p>
                          </div>
                        </div>
                        <ul className="space-y-1 mb-4 text-[12px] text-muted-foreground">
                          {tpl.documents.slice(0, 3).map((d, i) => (
                            <li key={i} className="flex items-center gap-1.5 truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                              <span className="truncate">{d.name}</span>
                            </li>
                          ))}
                          <li className="text-[11px] text-muted-foreground/70 pl-5">
                            + {tpl.documentCount - 3} more requirements
                          </li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setSelectedTemplate(tpl)}
                        className="w-full py-2 rounded-lg bg-primary-500/10 hover:bg-primary-500 hover:text-white text-body-sm font-medium text-primary-500 transition-colors"
                      >
                        View & Use Template
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Start New Bid (Real Active Tenders) ───────────────────── */}
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-heading-sm text-foreground font-display">Start New Bid</h2>
                <p className="text-caption text-muted-foreground mt-0.5">
                  Select an active tender to launch AI document checklist & proposal assistant
                </p>
              </div>
              <span className="text-caption font-mono text-muted-foreground hidden sm:inline">
                {availableTenders.length} active tenders available
              </span>
            </div>
            <div className="p-5">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search active tender by name, department, or organization..."
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Real Suggestions List */}
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                {tendersLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin mx-auto mb-2" />
                    <p className="text-body-sm text-muted-foreground">Loading active tenders...</p>
                  </div>
                ) : filteredTenders.length === 0 ? (
                  <div className="text-center py-10 px-5">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-body-sm text-muted-foreground">No tenders match your search</p>
                    <p className="text-caption text-muted-foreground mt-1">Try another keyword or browse all tenders</p>
                  </div>
                ) : (
                  filteredTenders.map((tender) => {
                    const deadline = getDeadlineInfo(tender.deadline);
                    const cat = getCategoryInfo(tender.category);
                    return (
                      <div
                        key={tender.id}
                        className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>
                              {cat.label}
                            </span>
                            <p className="text-body-sm text-foreground font-medium truncate">
                              {tender.title}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-caption text-muted-foreground flex items-center gap-1 truncate max-w-[220px]">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{tender.organization}</span>
                            </span>
                            <span className="text-caption text-muted-foreground flex items-center gap-1 shrink-0 font-medium">
                              <IndianRupee className="w-3 h-3" />
                              {formatCurrency(tender.estimatedValue)}
                            </span>
                            <span className={cn('text-caption shrink-0 flex items-center gap-1 font-medium', deadline.color)}>
                              <Calendar className="w-3 h-3" />
                              {deadline.text}
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/tenders/${tender.id}/bid-assistant`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-caption font-medium rounded-lg transition-colors shrink-0 shadow-sm"
                        >
                          Start Bid Preparation
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-6">
          {/* Document Checklist Templates (compact sidebar view) */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Quick Templates</h3>
            <div className="space-y-2.5">
              {CHECKLIST_TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplate(tpl);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tpl.accentBg)}>
                      <Icon className={cn('w-4 h-4', tpl.accentColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground font-medium truncate group-hover:text-primary-500 transition-colors">
                        {tpl.title}
                      </p>
                      <p className="text-caption text-muted-foreground">{tpl.documentCount} docs</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Recent Activity</h3>
            <div className="space-y-3.5">
              {overviewLoading ? (
                <div className="py-4 text-center text-caption text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-primary-500" />
                  Loading activity...
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-caption">
                  No recent activity recorded yet
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                      {renderActivityIcon(item.icon, item.iconColor)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground leading-snug">
                        {item.description}
                      </p>
                      <p className="text-caption text-muted-foreground mt-0.5">{item.timeAgo}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Template Details Modal ──────────────────────────────────── */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', selectedTemplate.accentBg)}>
                  <selectedTemplate.icon className={cn('w-5 h-5', selectedTemplate.accentColor)} />
                </div>
                <div>
                  <h3 className="text-heading-sm font-display text-foreground">{selectedTemplate.title}</h3>
                  <p className="text-caption text-muted-foreground">
                    {selectedTemplate.documentCount} standard requirements for {selectedTemplate.category} tenders
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checklist List */}
            <div className="p-5 overflow-y-auto space-y-2.5 flex-1 divide-y divide-border/50">
              {selectedTemplate.documents.map((doc, idx) => (
                <div key={idx} className="pt-2.5 first:pt-0 flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-body-sm font-medium text-foreground">{doc.name}</p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded font-semibold',
                        doc.mandatory
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {doc.mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-caption text-muted-foreground mt-0.5">{doc.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-caption text-muted-foreground">
                Apply this template to any active tender
              </span>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setActiveTab('active_bids');
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-body-sm font-medium transition-colors"
              >
                Select a Tender to Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
