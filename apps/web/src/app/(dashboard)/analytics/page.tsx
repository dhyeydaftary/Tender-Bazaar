'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Eye,
  Bookmark,
  ShieldCheck,
  Target,
  BarChart3,
  Search,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface CategorySplit {
  name: string;
  count: number;
  pct: number;
  color: string;
}

interface EligibilityTrendItem {
  tender: string;
  score: number;
  date: string;
}

interface TopSearchItem {
  keyword: string;
  count: number;
}

interface AnalyticsApiResponse {
  tendersSaved: number;
  hasSavedTenders: boolean;
  savedByCategory: CategorySplit[];
  eligibilityChecksCount: number;
  avgScore: number;
  eligibilityTrend: EligibilityTrendItem[];
  topSearches: TopSearchItem[];
  platformTotalViews: number;
}

interface DayView {
  day: string;
  label: string;
  count: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Dynamically computes views for the last 7 calendar days from local tracking
 */
function calculateLast7DaysViews(): { days: DayView[]; totalViews: number } {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('tb_user_viewed_tenders') : null;
    const list: Array<{ id: string; timestamp: number }> = raw ? JSON.parse(raw) : [];

    const days: DayView[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = targetDate.getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

      const dayCount = list.filter(
        (item) => item.timestamp >= startOfDay && item.timestamp < endOfDay,
      ).length;

      days.push({
        day: targetDate.toLocaleDateString('en-IN', { weekday: 'short' }),
        label: targetDate.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
        count: dayCount,
      });
    }

    const uniqueTenders = new Set(list.map((item) => item.id)).size;
    const totalViews = Math.max(list.length, uniqueTenders);

    return { days, totalViews };
  } catch {
    return {
      days: [
        { day: 'Mon', label: 'Day 1', count: 0 },
        { day: 'Tue', label: 'Day 2', count: 0 },
        { day: 'Wed', label: 'Day 3', count: 0 },
        { day: 'Thu', label: 'Day 4', count: 0 },
        { day: 'Fri', label: 'Day 5', count: 0 },
        { day: 'Sat', label: 'Day 6', count: 0 },
        { day: 'Sun', label: 'Day 7', count: 0 },
      ],
      totalViews: 0,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [last7Days, setLast7Days] = useState<DayView[]>([]);
  const [userTotalViews, setUserTotalViews] = useState(0);

  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredEligibility, setHoveredEligibility] = useState<number | null>(null);

  useEffect(() => {
    // 1. Calculate user view activity
    const viewStats = calculateLast7DaysViews();
    setLast7Days(viewStats.days);
    setUserTotalViews(viewStats.totalViews);

    // 2. Fetch live calculated analytics from API
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get('/profile/analytics');
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
        } else {
          setError('Failed to calculate analytics');
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  const maxViews = Math.max(...last7Days.map((d) => d.count), 1);
  const topSearches = data?.topSearches ?? [];
  const maxSearch = Math.max(...topSearches.map((s) => s.count), 1);

  const displayViews = userTotalViews;
  const savedCount = data?.tendersSaved ?? 0;
  const checksCount = data?.eligibilityChecksCount ?? 0;
  const avgScore = data?.avgScore ?? 0;

  const statCards = [
    {
      label: 'Tenders Viewed',
      value: displayViews,
      icon: Eye,
      color: 'text-primary-500',
      bg: 'bg-primary-500/10',
    },
    {
      label: 'Tenders Saved',
      value: savedCount,
      icon: Bookmark,
      color: 'text-accent-500',
      bg: 'bg-accent-500/10',
    },
    {
      label: 'Eligibility Checks',
      value: checksCount,
      icon: ShieldCheck,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Avg Score',
      value: avgScore,
      suffix: '%',
      icon: Target,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-6 w-6 text-primary-500" />
          <h1 className="text-heading-lg text-foreground font-display">My Analytics</h1>
        </div>
        <p className="text-body-sm text-muted-foreground">
          Track your tender activity, saved items, and eligibility performance
        </p>
      </div>

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn('p-2 rounded-lg', stat.bg)}>
                  <Icon className={cn('h-5 w-5', stat.color)} />
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {isLoading ? (
                <div className="h-9 w-20 bg-muted/60 animate-pulse rounded my-1" />
              ) : (
                <p className="text-display-sm font-mono text-foreground font-bold tracking-tight">
                  {stat.value.toLocaleString('en-IN')}
                  {stat.suffix ?? ''}
                </p>
              )}
              <p className="text-caption text-muted-foreground mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Charts Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Tenders Viewed - Last 7 Days (Vertical Bar Chart) ── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-heading-sm text-foreground font-display">Tenders Viewed</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Live
            </span>
          </div>
          <p className="text-caption text-muted-foreground mb-6">Last 7 days</p>

          <div className="flex items-end gap-2 h-48">
            {last7Days.map((d, i) => {
              const heightPct = maxViews > 0 ? Math.max((d.count / maxViews) * 100, 4) : 4;
              const isHovered = hoveredBar === i;
              return (
                <div
                  key={`${d.day}-${d.label}`}
                  className="flex-1 flex flex-col items-center justify-end h-full relative"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] font-mono rounded px-2 py-1 whitespace-nowrap z-10 shadow-md border border-border">
                      {d.label}: {d.count} views
                    </div>
                  )}
                  {/* Bar */}
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-all duration-300 cursor-pointer',
                      d.count > 0
                        ? isHovered
                          ? 'bg-primary-400'
                          : 'bg-primary-500'
                        : 'bg-muted/40 hover:bg-muted/70',
                    )}
                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                  />
                  {/* Day label */}
                  <span className="text-caption text-muted-foreground mt-2">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Saved by Category (Horizontal Bar Chart) ──────────── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-heading-sm text-foreground font-display">Saved by Category</h2>
            {data?.hasSavedTenders ? (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-500/10 text-accent-600">
                {savedCount} Saved
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Market Baseline
              </span>
            )}
          </div>
          <p className="text-caption text-muted-foreground mb-6">
            {data?.hasSavedTenders
              ? 'Distribution of your saved tenders'
              : 'Marketplace distribution across tender categories'}
          </p>

          <div className="space-y-5">
            {isLoading ? (
              <div className="space-y-4 py-2">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-6 bg-muted/50 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              data?.savedByCategory?.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-body-sm font-medium text-foreground">{cat.name}</span>
                    <span className="text-body-sm font-mono text-muted-foreground">
                      {cat.pct}% {cat.count > 0 ? `(${cat.count})` : ''}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        cat.color,
                      )}
                      style={{ width: `${Math.max(cat.pct, 0)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Stacked summary bar */}
          <div className="mt-6">
            <p className="text-overline text-muted-foreground uppercase tracking-widest mb-2">
              Overall Split
            </p>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {data?.savedByCategory?.map((cat) => (
                <div
                  key={cat.name}
                  className={cn(cat.color)}
                  style={{ width: `${cat.pct}%` }}
                  title={`${cat.name}: ${cat.pct}%`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Top Searches ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-heading-sm text-foreground font-display">Top Searches</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Trending
            </span>
          </div>
          <p className="text-caption text-muted-foreground mb-6">
            Most searched tender keywords
          </p>

          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-8 bg-muted/50 rounded animate-pulse" />
                ))}
              </div>
            ) : topSearches.length === 0 ? (
              <p className="text-body-sm text-muted-foreground py-4 text-center">
                No search history yet. Search for tenders to see your top keywords.
              </p>
            ) : (
              topSearches.map((item, idx) => {
                const widthPct = Math.max((item.count / maxSearch) * 100, 8);
                return (
                  <div key={item.keyword}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-caption font-mono text-muted-foreground w-5 shrink-0">
                          {idx + 1}.
                        </span>
                        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-body-sm text-foreground truncate">{item.keyword}</span>
                      </div>
                      <span className="text-body-sm font-mono font-semibold text-foreground shrink-0 ml-3">
                        {item.count}
                      </span>
                    </div>
                    <div className="ml-7 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-500 transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Eligibility Score Trend ────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-heading-sm text-foreground font-display">
              Eligibility Score Trend
            </h2>
            <Link
              href="/eligibility"
              className="text-[11px] text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Check Tender
            </Link>
          </div>
          <p className="text-caption text-muted-foreground mb-6">
            Your recent AI eligibility checks
          </p>

          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-9 bg-muted/50 rounded animate-pulse" />
                ))}
              </div>
            ) : !data?.eligibilityTrend || data.eligibilityTrend.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-body-sm text-muted-foreground">
                  No eligibility checks evaluated yet.
                </p>
                <Link
                  href="/tenders"
                  className="inline-block text-caption text-primary-500 hover:underline font-medium"
                >
                  Browse tenders & check your AI eligibility
                </Link>
              </div>
            ) : (
              data.eligibilityTrend.map((item, idx) => {
                const isHovered = hoveredEligibility === idx;
                return (
                  <div
                    key={`${item.tender}-${idx}`}
                    className="group"
                    onMouseEnter={() => setHoveredEligibility(idx)}
                    onMouseLeave={() => setHoveredEligibility(null)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-body-sm text-foreground truncate group-hover:text-primary-500 transition-colors">
                          {item.tender}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-caption text-muted-foreground font-mono">
                          {item.date}
                        </span>
                        <span
                          className={cn(
                            'text-body-sm font-mono font-bold w-12 text-right',
                            scoreTextColor(item.score),
                          )}
                        >
                          {item.score}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          scoreBarColor(item.score),
                          isHovered && 'opacity-80',
                        )}
                        style={{ width: `${Math.max(item.score, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-6 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              {'< 50 Low'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              50-69 Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              {'70+ High'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
