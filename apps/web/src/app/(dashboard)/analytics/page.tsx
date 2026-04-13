'use client';

import { useState } from 'react';
import {
  Eye,
  Bookmark,
  ShieldCheck,
  Target,
  BarChart3,
  Search,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const STAT_CARDS = [
  {
    label: 'Tenders Viewed',
    value: 342,
    icon: Eye,
    color: 'text-primary-500',
    bg: 'bg-primary-500/10',
  },
  {
    label: 'Tenders Saved',
    value: 23,
    icon: Bookmark,
    color: 'text-accent-500',
    bg: 'bg-accent-500/10',
  },
  {
    label: 'Eligibility Checks',
    value: 8,
    icon: ShieldCheck,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    label: 'Avg Score',
    value: 74,
    suffix: '%',
    icon: Target,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
];

const VIEWS_LAST_7_DAYS = [
  { day: 'Mon', label: 'Apr 05', count: 38 },
  { day: 'Tue', label: 'Apr 06', count: 52 },
  { day: 'Wed', label: 'Apr 07', count: 61 },
  { day: 'Thu', label: 'Apr 08', count: 45 },
  { day: 'Fri', label: 'Apr 09', count: 73 },
  { day: 'Sat', label: 'Apr 10', count: 29 },
  { day: 'Sun', label: 'Apr 11', count: 44 },
];

const SAVED_BY_CATEGORY = [
  { name: 'Works', pct: 45, color: 'bg-primary-500' },
  { name: 'Goods', pct: 25, color: 'bg-blue-500' },
  { name: 'Services', pct: 20, color: 'bg-accent-500' },
  { name: 'Consultancy', pct: 10, color: 'bg-purple-500' },
];

const TOP_SEARCHES = [
  { keyword: 'highway construction tender', count: 48 },
  { keyword: 'IT infrastructure NIC', count: 36 },
  { keyword: 'solar panel government', count: 29 },
  { keyword: 'medical equipment supply', count: 22 },
  { keyword: 'water treatment plant', count: 17 },
];

const ELIGIBILITY_TREND = [
  { tender: 'Road Repair - UP PWD', score: 45, date: 'Mar 22' },
  { tender: 'IT Infra - MeitY', score: 62, date: 'Mar 28' },
  { tender: 'Hospital Equipment - AIIMS', score: 78, date: 'Apr 02' },
  { tender: 'Bridge Construction - NHAI', score: 71, date: 'Apr 06' },
  { tender: 'Server Procurement - NIC', score: 88, date: 'Apr 10' },
];

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

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredEligibility, setHoveredEligibility] = useState<number | null>(null);

  const maxViews = Math.max(...VIEWS_LAST_7_DAYS.map((d) => d.count));
  const maxSearch = Math.max(...TOP_SEARCHES.map((s) => s.count));

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

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => {
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
              <p className="text-display-sm font-mono text-foreground font-bold tracking-tight">
                {stat.value.toLocaleString('en-IN')}
                {stat.suffix ?? ''}
              </p>
              <p className="text-caption text-muted-foreground mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Charts Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Tenders Viewed - Last 7 Days (Vertical Bar Chart) ── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-heading-sm text-foreground font-display mb-1">Tenders Viewed</h2>
          <p className="text-caption text-muted-foreground mb-6">Last 7 days</p>

          <div className="flex items-end gap-2 h-48">
            {VIEWS_LAST_7_DAYS.map((d, i) => {
              const heightPct = (d.count / maxViews) * 100;
              const isHovered = hoveredBar === i;
              return (
                <div
                  key={d.day}
                  className="flex-1 flex flex-col items-center justify-end h-full relative"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] font-mono rounded px-2 py-1 whitespace-nowrap z-10 shadow-md border border-border">
                      {d.count} views
                    </div>
                  )}
                  {/* Bar */}
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-all duration-200 cursor-pointer',
                      isHovered ? 'bg-primary-400' : 'bg-primary-500',
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
          <h2 className="text-heading-sm text-foreground font-display mb-1">Saved by Category</h2>
          <p className="text-caption text-muted-foreground mb-6">
            Distribution of your saved tenders
          </p>

          <div className="space-y-5">
            {SAVED_BY_CATEGORY.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-body-sm font-medium text-foreground">{cat.name}</span>
                  <span className="text-body-sm font-mono text-muted-foreground">{cat.pct}%</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      cat.color,
                    )}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Stacked summary bar */}
          <div className="mt-6">
            <p className="text-overline text-muted-foreground uppercase tracking-widest mb-2">
              Overall Split
            </p>
            <div className="flex h-3 rounded-full overflow-hidden">
              {SAVED_BY_CATEGORY.map((cat) => (
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
          <h2 className="text-heading-sm text-foreground font-display mb-1">Top Searches</h2>
          <p className="text-caption text-muted-foreground mb-6">
            Your most searched keywords
          </p>

          <div className="space-y-4">
            {TOP_SEARCHES.map((item, idx) => {
              const widthPct = (item.count / maxSearch) * 100;
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
            })}
          </div>
        </div>

        {/* ── Eligibility Score Trend ────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-heading-sm text-foreground font-display mb-1">
            Eligibility Score Trend
          </h2>
          <p className="text-caption text-muted-foreground mb-6">
            Your last 5 AI eligibility checks
          </p>

          <div className="space-y-4">
            {ELIGIBILITY_TREND.map((item, idx) => {
              const isHovered = hoveredEligibility === idx;
              return (
                <div
                  key={item.tender}
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
                          'text-body-sm font-mono font-bold w-10 text-right',
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
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
