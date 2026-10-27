'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Eye,
  Loader2,
} from 'lucide-react';
import { cn, getScoreStrokeColor } from '@/lib/utils';
import api from '@/lib/api';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { useSubscriptionStore } from '@/stores/subscription-store';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type EligibilityStatus = 'eligible' | 'partial' | 'not_eligible';

interface EligibilityCheck {
  id: string;
  tenderId: string;
  title: string;
  organization: string;
  score: number;
  status: EligibilityStatus;
  dateChecked: string;
  topIssue: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function getStatusConfig(status: EligibilityStatus) {
  const map = {
    eligible: {
      label: 'Eligible',
      icon: CheckCircle2,
      color: 'text-accent-600 dark:text-accent-400',
      bg: 'bg-accent-100 dark:bg-accent-900/30',
    },
    partial: {
      label: 'Partially Eligible',
      icon: MinusCircle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    },
    not_eligible: {
      label: 'Not Eligible',
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
    },
  };
  return map[status];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINI SCORE CIRCLE (SVG)
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreCircle({ score, size = 40 }: { score: number; size?: number }) {
  const strokeWidth = 3;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const strokeColor = getScoreStrokeColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-foreground">
        {score}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPUTED STATS
   ═══════════════════════════════════════════════════════════════════════════ */

function computeStats(checks: EligibilityCheck[], planLimit: number, isUnlimited: boolean) {
  const totalUsed = checks.length;
  const avgScore = checks.length > 0
    ? Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length)
    : 0;

  // Most common issue
  const issueCounts: Record<string, number> = {};
  checks.forEach((c) => {
    if (c.topIssue) {
      issueCounts[c.topIssue] = (issueCounts[c.topIssue] || 0) + 1;
    }
  });
  const topIssueEntry = Object.entries(issueCounts).sort((a, b) => b[1] - a[1])[0];
  const mostCommonIssue = topIssueEntry
    ? topIssueEntry[0]
    : checks.length > 0
      ? 'No criteria issues'
      : 'None detected';

  return { totalUsed, planLimit, isUnlimited, avgScore, mostCommonIssue };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EligibilityDashboardPage() {
  const [checks, setChecks] = useState<EligibilityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Entitlement gate for AI eligibility checks. Used and limit come from the
  // plan and GET /subscription/usage — the counts the API enforces — not from
  // the history list below (all-time, while the allowance is per period) and
  // never from a guessed default limit.
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);
  const fetchUsage = useSubscriptionStore((s) => s.fetchUsage);
  useEffect(() => {
    fetchSubscription();
    fetchUsage();
  }, [fetchSubscription, fetchUsage]);
  const aiCheckLimit = useLimitGate('maxAiChecks');
  const isUnlimited = aiCheckLimit.isUnlimited;
  const planLimit = isUnlimited ? -1 : aiCheckLimit.limit;
  const usageReady = aiCheckLimit.status === 'ready';
  const allowancePeriod = aiCheckLimit.resetType === 'lifetime' ? '' : ' this month';

  const fetchChecks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: res } = await api.get('/eligibility/history', {
        params: { page: 1, limit: 100 },
      });
      if (res.success && Array.isArray(res.data)) {
        const mapped: EligibilityCheck[] = res.data.map((item: any) => {
          const score = item.score ?? 0;
          let status: EligibilityStatus = 'not_eligible';
          if (item.isEligible === true || score >= 70) status = 'eligible';
          else if (score >= 40) status = 'partial';

          // Extract the top issue from criteria JSON (supports both object and array)
          let topIssue: string | null = null;
          if (item.criteria && typeof item.criteria === 'object') {
            const criteriaEntries = Array.isArray(item.criteria)
              ? item.criteria
              : Object.values(item.criteria);
            const failing = criteriaEntries.find(
              (c: any) =>
                c.status === 'fail' ||
                c.status === 'partial' ||
                c.status === 'NOT_MET' ||
                c.status === 'PARTIALLY_MET' ||
                c.met === false
            );
            if (failing) topIssue = failing.detail || failing.name || failing.criterion || null;
          }

          return {
            id: item.id,
            tenderId: item.tenderId,
            title: item.tender?.title ?? 'Untitled Tender',
            organization: item.tender?.organization ?? 'Unknown Organization',
            score,
            status,
            dateChecked: item.createdAt,
            topIssue,
          };
        });
        setChecks(mapped);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to load eligibility checks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  const stats = { ...computeStats(checks, planLimit, isUnlimited), totalUsed: aiCheckLimit.used };

  /* ─── Filtered ─── */

  const filtered = checks.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.organization.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin mb-4" />
        <p className="text-body-sm text-muted-foreground">Loading eligibility checks...</p>
      </div>
    );
  }

  /* ─── Error State ─── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
        <p className="text-body-sm font-medium text-foreground mb-1">Failed to load data</p>
        <p className="text-caption text-muted-foreground mb-4">{error}</p>
        <button
          onClick={fetchChecks}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-heading-lg text-foreground font-display">Eligibility Dashboard</h1>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Track your AI eligibility checks, match scores, and criteria compliance
          </p>
        </div>
        <Link
          href="/ai-eligibility"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shrink-0 shadow-sm"
        >
          <Zap className="h-4 w-4" />
          Check a New Tender
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Total Checks */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-500" />
            </div>
            <span className="text-caption text-muted-foreground font-medium">
              AI Checks Used{usageReady ? allowancePeriod : ''}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-display-sm font-mono text-foreground font-bold">{usageReady ? stats.totalUsed : '—'}</p>
            <span className="text-body-sm text-muted-foreground font-mono">
              / {!usageReady ? '—' : stats.isUnlimited ? '∞' : stats.planLimit}
            </span>
          </div>
          <div className="mt-3">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  usageReady && stats.isUnlimited
                    ? 'bg-accent-500'
                    : usageReady && aiCheckLimit.percentage > 80
                      ? 'bg-amber-500'
                      : 'bg-primary-500',
                )}
                style={{
                  width: !usageReady ? '0%' : stats.isUnlimited ? '100%' : `${aiCheckLimit.percentage}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              {aiCheckLimit.status === 'error'
                ? "Couldn't load your plan usage"
                : !usageReady
                  ? 'Loading your plan…'
                  : stats.isUnlimited
                    ? 'Unlimited AI checks on your active plan'
                    : aiCheckLimit.remaining > 0
                      ? `${aiCheckLimit.remaining} ${aiCheckLimit.remaining === 1 ? 'check' : 'checks'} remaining${allowancePeriod}`
                      : 'Limit reached — upgrade for more checks'}
            </p>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/30 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-accent-500" />
            </div>
            <span className="text-caption text-muted-foreground font-medium">Average Score</span>
          </div>
          <div className="flex items-center gap-3">
            <p className={cn(
              'text-display-sm font-mono font-bold',
              checks.length === 0
                ? 'text-muted-foreground'
                : stats.avgScore >= 70
                  ? 'text-accent-500'
                  : stats.avgScore >= 40
                    ? 'text-amber-500'
                    : 'text-red-500',
            )}>
              {checks.length === 0 ? '—' : `${stats.avgScore}%`}
            </p>
            <ScoreCircle score={checks.length === 0 ? 0 : stats.avgScore} size={44} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 font-medium">
            {checks.length === 0
              ? 'No checks run yet'
              : `Based on ${checks.length} evaluated tender${checks.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Most Common Issue */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-caption text-muted-foreground font-medium">Top Critical Issue</span>
          </div>
          <p className="text-body-sm font-medium text-foreground line-clamp-2 min-h-[40px]">
            {checks.length === 0 ? 'None detected' : stats.mostCommonIssue}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 font-medium">
            {checks.length === 0
              ? 'Run checks to analyze tenders'
              : `Affects ${checks.filter((c) => c.topIssue === stats.mostCommonIssue).length} of ${checks.length} check${checks.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Past Checks Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-heading-sm font-display text-foreground">Past Eligibility Checks</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search checks..."
              className="pl-9 pr-3 py-1.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-caption focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-52"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium px-6 py-3">
                  Tender
                </th>
                <th className="text-center text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium px-4 py-3">
                  Score
                </th>
                <th className="text-left text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium px-4 py-3">
                  Date
                </th>
                <th className="text-left text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium px-4 py-3">
                  Status
                </th>
                <th className="text-right text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium px-6 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-body-sm text-foreground font-medium">No eligibility checks found</p>
                    <p className="text-caption text-muted-foreground mt-1 mb-4">
                      Run AI eligibility checks on any active tender to see detailed compatibility reports
                    </p>
                    <Link
                      href="/ai-eligibility"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium text-caption rounded-lg transition-colors shadow-sm"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Run AI Check Now
                    </Link>
                  </td>
                </tr>
              ) : (
                paginated.map((check) => {
                  const statusCfg = getStatusConfig(check.status);
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr
                      key={check.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      {/* Tender */}
                      <td className="px-6 py-4 max-w-sm">
                        <Link
                          href={`/tenders/${check.tenderId}`}
                          className="text-body-sm font-medium text-foreground hover:text-primary-500 transition-colors line-clamp-1 block"
                        >
                          {check.title}
                        </Link>
                        <span className="text-caption text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{check.organization}</span>
                        </span>
                      </td>

                      {/* Score with mini circle */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <ScoreCircle score={check.score} size={38} />
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4">
                        <span className="text-caption text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(check.dateChecked)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full',
                          statusCfg.bg,
                          statusCfg.color,
                        )}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* View link */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/tenders/${check.tenderId}`}
                          className="inline-flex items-center gap-1 text-caption font-medium text-primary-500 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border">
          {paginated.length === 0 ? (
            <div className="text-center py-16 px-5">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">No eligibility checks found</p>
            </div>
          ) : (
            paginated.map((check) => {
              const statusCfg = getStatusConfig(check.status);
              const StatusIcon = statusCfg.icon;

              return (
                <Link
                  key={check.id}
                  href={`/tenders/${check.tenderId}`}
                  className="flex items-center gap-3.5 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <ScoreCircle score={check.score} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-foreground truncate">
                      {check.title}
                    </p>
                    <p className="text-caption text-muted-foreground truncate mt-0.5">
                      {check.organization}
                    </p>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
                        statusCfg.bg,
                        statusCfg.color,
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(check.dateChecked)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border">
            <p className="text-caption text-muted-foreground">
              Showing <span className="font-mono font-medium text-foreground">{(page - 1) * limit + 1}</span>
              {' '}-{' '}
              <span className="font-mono font-medium text-foreground">{Math.min(page * limit, filtered.length)}</span>
              {' '}of{' '}
              <span className="font-mono font-medium text-foreground">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
