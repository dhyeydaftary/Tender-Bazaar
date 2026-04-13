'use client';

import { useState } from 'react';
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
  ClipboardList,
  ChevronRight,
  FileCheck,
  Activity,
} from 'lucide-react';
import { cn, formatCurrency, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';

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
}

interface TenderSuggestion {
  id: string;
  title: string;
  organization: string;
  estimatedValue: number;
  deadline: string;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  documentCount: number;
  icon: typeof Wrench;
  accentColor: string;
  accentBg: string;
}

interface ActivityItem {
  id: string;
  description: string;
  timeAgo: string;
  icon: typeof Upload;
  iconColor: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const ACTIVE_BIDS: ActiveBid[] = [
  {
    id: 'b1',
    tenderId: 't1',
    title: 'Construction of 4-Lane Highway NH-48 Junction to Mehsana Bypass',
    organization: 'National Highways Authority of India',
    category: 'WORKS',
    documentsReady: 3,
    documentsTotal: 8,
    deadline: '2026-04-25T17:00:00',
    status: 'in_progress',
  },
  {
    id: 'b2',
    tenderId: 't2',
    title: 'Supply of Desktop Computers and Peripherals for Government Schools',
    organization: 'CSC SPV, Ministry of Electronics & IT',
    category: 'GOODS',
    documentsReady: 10,
    documentsTotal: 10,
    deadline: '2026-04-18T17:00:00',
    status: 'documents_ready',
  },
  {
    id: 'b3',
    tenderId: 't3',
    title: 'Cloud Infrastructure and Managed Services for NIC Data Centers',
    organization: 'National Informatics Centre',
    category: 'SERVICES',
    documentsReady: 5,
    documentsTotal: 9,
    deadline: '2026-04-14T17:00:00',
    status: 'review_needed',
  },
];

const TENDER_SUGGESTIONS: TenderSuggestion[] = [
  {
    id: 't10',
    title: 'Annual Maintenance Contract for Water Treatment Plants',
    organization: 'Bangalore Water Supply and Sewerage Board',
    estimatedValue: 45000000,
    deadline: '2026-04-28T17:00:00',
  },
  {
    id: 't11',
    title: 'Supply of Medical Equipment to District Hospitals Phase II',
    organization: 'National Health Mission, Gujarat',
    estimatedValue: 320000000,
    deadline: '2026-05-02T17:00:00',
  },
  {
    id: 't12',
    title: 'IT Infrastructure Upgrade for State Data Centre',
    organization: 'Gujarat Informatics Limited',
    estimatedValue: 89000000,
    deadline: '2026-04-30T17:00:00',
  },
  {
    id: 't13',
    title: 'Consultancy for Urban Transport Master Plan',
    organization: 'Ahmedabad Urban Development Authority',
    estimatedValue: 28000000,
    deadline: '2026-05-05T17:00:00',
  },
];

const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tpl1',
    title: 'Works Tender Checklist',
    documentCount: 12,
    icon: Wrench,
    accentColor: 'text-red-500',
    accentBg: 'bg-red-500/10',
  },
  {
    id: 'tpl2',
    title: 'Goods Supply Checklist',
    documentCount: 10,
    icon: Package,
    accentColor: 'text-blue-500',
    accentBg: 'bg-blue-500/10',
  },
  {
    id: 'tpl3',
    title: 'Services Tender Checklist',
    documentCount: 9,
    icon: Settings,
    accentColor: 'text-accent-500',
    accentBg: 'bg-accent-500/10',
  },
  {
    id: 'tpl4',
    title: 'Consultancy Checklist',
    documentCount: 8,
    icon: Briefcase,
    accentColor: 'text-purple-500',
    accentBg: 'bg-purple-500/10',
  },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    description: 'Uploaded financial statement for NHAI highway tender',
    timeAgo: '2 hours ago',
    icon: Upload,
    iconColor: 'text-primary-500',
  },
  {
    id: 'a2',
    description: 'Completed document checklist for IT Services tender',
    timeAgo: 'Yesterday',
    icon: CheckCircle2,
    iconColor: 'text-accent-500',
  },
  {
    id: 'a3',
    description: 'Started bid preparation for NIC Cloud Infrastructure tender',
    timeAgo: 'Yesterday',
    icon: FileText,
    iconColor: 'text-blue-500',
  },
  {
    id: 'a4',
    description: 'AI flagged missing EMD document for Water Treatment tender',
    timeAgo: '2 days ago',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  {
    id: 'a5',
    description: 'Downloaded bid submission checklist for Desktop Supply tender',
    timeAgo: '3 days ago',
    icon: ClipboardList,
    iconColor: 'text-purple-500',
  },
];

const QUICK_STATS = [
  { key: 'active', label: 'Active Bids', value: 3, icon: Target, color: 'text-primary-500', bgColor: 'bg-primary-500/10' },
  { key: 'docs', label: 'Documents Uploaded', value: 24, icon: FileCheck, color: 'text-accent-500', bgColor: 'bg-accent-500/10' },
  { key: 'completion', label: 'Avg Completion', value: 68, icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-500/10', suffix: '%' },
  { key: 'deadlines', label: 'Upcoming Deadlines', value: 2, icon: Calendar, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
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
  return map[status];
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BidAssistantPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active_bids' | 'templates'>('active_bids');

  // Plan limit gate for AI checks (bid assistant consumes AI checks)
  const aiCheckLimit = useLimitGate('maxAiChecks');

  /* ─── Filtered suggestions ─── */
  const filteredSuggestions = TENDER_SUGGESTIONS.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.organization.toLowerCase().includes(q)
    );
  });

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

      {/* ── Quick Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_STATS.map((stat) => {
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
                {stat.value}{stat.suffix ?? ''}
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
                <span className="text-caption text-muted-foreground font-mono">{ACTIVE_BIDS.length} bids</span>
              </div>
              <div className="divide-y divide-border">
                {ACTIVE_BIDS.map((bid) => {
                  const cat = getCategoryInfo(bid.category);
                  const deadline = getDeadlineInfo(bid.deadline);
                  const statusCfg = getStatusConfig(bid.status);
                  const progressPct = Math.round((bid.documentsReady / bid.documentsTotal) * 100);

                  return (
                    <div
                      key={bid.id}
                      className="px-5 py-4 hover:bg-muted/30 transition-colors"
                    >
                      {/* Top row: category + status */}
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
                          <Clock className="w-3 h-3" />
                          {deadline.text}
                        </span>
                      </div>

                      {/* Title + org */}
                      <p className="text-body-sm text-foreground font-medium line-clamp-1 mb-0.5">
                        {bid.title}
                      </p>
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
                        className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
                      >
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
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
                      className="border border-border rounded-xl p-4 hover:border-border/80 hover:shadow-md transition-all duration-200 bg-background"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', tpl.accentBg)}>
                          <Icon className={cn('w-5 h-5', tpl.accentColor)} />
                        </div>
                        <div>
                          <p className="text-body-sm font-medium text-foreground">{tpl.title}</p>
                          <p className="text-caption text-muted-foreground mt-0.5">
                            {tpl.documentCount} documents
                          </p>
                        </div>
                      </div>
                      <button className="w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-body-sm font-medium text-foreground transition-colors">
                        Use Template
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Start New Bid ──────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-heading-sm text-foreground font-display">Start New Bid</h2>
            </div>
            <div className="p-5">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tender to start bid preparation..."
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Suggestions */}
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {filteredSuggestions.map((tender) => {
                  const deadline = getDeadlineInfo(tender.deadline);
                  return (
                    <div
                      key={tender.id}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm text-foreground font-medium truncate">
                          {tender.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-caption text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{tender.organization}</span>
                          </span>
                          <span className="text-caption text-muted-foreground flex items-center gap-1 shrink-0">
                            <IndianRupee className="w-3 h-3" />
                            {formatCurrency(tender.estimatedValue)}
                          </span>
                          <span className={cn('text-caption shrink-0 flex items-center gap-1', deadline.color)}>
                            <Calendar className="w-3 h-3" />
                            {deadline.text}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/tenders/${tender.id}/bid-assistant`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-caption font-medium rounded-lg transition-colors shrink-0"
                      >
                        Start Bid Preparation
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}

                {filteredSuggestions.length === 0 && (
                  <div className="text-center py-10 px-5">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-body-sm text-muted-foreground">No tenders match your search</p>
                    <p className="text-caption text-muted-foreground mt-1">Try a different keyword</p>
                  </div>
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
                    onClick={() => setActiveTab('templates')}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tpl.accentBg)}>
                      <Icon className={cn('w-4 h-4', tpl.accentColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground font-medium truncate">{tpl.title}</p>
                      <p className="text-caption text-muted-foreground">{tpl.documentCount} docs</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Recent Activity</h3>
            <div className="space-y-3.5">
              {RECENT_ACTIVITY.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className={cn('w-3.5 h-3.5', item.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground leading-snug">
                        {item.description}
                      </p>
                      <p className="text-caption text-muted-foreground mt-0.5">{item.timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
