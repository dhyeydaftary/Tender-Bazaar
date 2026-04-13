'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  Bell,
  Bookmark,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  Shield,
  Columns3,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
  Building2,
  MapPin,
  IndianRupee,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, getDeadlineInfo, getGreeting, getCategoryInfo, formatIndianNumber } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

function useCounter(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(true);
  }, []);

  useEffect(() => {
    if (!started) return;
    let raf: number;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, started]);

  return value;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const STATS = [
  { key: 'new', label: 'New Today', value: 1247, icon: Zap, change: '+12%', changeType: 'positive' as const },
  { key: 'active', label: 'Active Tenders', value: 52438, icon: FileText, change: '+324', changeType: 'positive' as const },
  { key: 'saved', label: 'Saved', value: 23, icon: Bookmark, change: '5 expiring', changeType: 'warning' as const },
  { key: 'score', label: 'Avg AI Score', value: 74, icon: Sparkles, change: 'avg', changeType: 'neutral' as const, suffix: '%' },
];

const RECOMMENDED_TENDERS = [
  {
    id: '1',
    title: 'Construction of 4-Lane Highway NH-48 Junction to Mehsana Bypass',
    organization: 'National Highways Authority of India',
    category: 'WORKS',
    state: 'Gujarat',
    estimatedValue: 373969000000,
    bidSubmissionDeadline: '2026-04-25T17:00:00',
    aiScore: 82,
  },
  {
    id: '2',
    title: 'Supply of Desktop Computers and Peripherals for Government Schools',
    organization: 'CSC SPV, Ministry of Electronics & IT',
    category: 'GOODS',
    state: 'Delhi',
    estimatedValue: 128000000,
    bidSubmissionDeadline: '2026-04-18T17:00:00',
    aiScore: 91,
  },
  {
    id: '3',
    title: 'Cloud Infrastructure and Managed Services for NIC Data Centers',
    organization: 'National Informatics Centre',
    category: 'SERVICES',
    state: 'Delhi',
    estimatedValue: 892000000,
    bidSubmissionDeadline: '2026-04-14T17:00:00',
    aiScore: 67,
  },
  {
    id: '4',
    title: 'Solar Panel Installation for Rural Electrification Project Phase III',
    organization: 'NTPC Limited',
    category: 'WORKS',
    state: 'Rajasthan',
    estimatedValue: 8900000000,
    bidSubmissionDeadline: '2026-04-30T17:00:00',
    aiScore: 55,
  },
  {
    id: '5',
    title: 'Consultancy Services for Smart City Portal Development',
    organization: 'Jaipur Smart City Ltd.',
    category: 'CONSULTANCY',
    state: 'Rajasthan',
    estimatedValue: 42000000,
    bidSubmissionDeadline: '2026-04-22T17:00:00',
    aiScore: 88,
  },
];

const ALERTS = [
  { name: 'Road Construction Gujarat', matches: 14, active: true },
  { name: 'IT Services > 1 Cr', matches: 8, active: true },
  { name: 'MSME Reserved Solar', matches: 3, active: true },
  { name: 'Medical Equipment Delhi', matches: 6, active: false },
];

const RECENT_SEARCHES = [
  { query: 'highway construction tender', results: 342, time: '2 hours ago' },
  { query: 'IT infrastructure NIC', results: 28, time: '5 hours ago' },
  { query: 'water treatment plant', results: 89, time: 'Yesterday' },
  { query: 'security services government', results: 156, time: 'Yesterday' },
  { query: 'solar energy MSME', results: 67, time: '2 days ago' },
];

const PLAN_USAGE = {
  plan: 'Starter',
  views: { used: 32, limit: 50 },
  aiChecks: { used: 3, limit: 5 },
  alerts: { used: 4, limit: 5 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   MINI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreRingMini({ score, size = 32 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={3} fill="none" className="text-muted/50" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-foreground">
        {score}
      </span>
    </div>
  );
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min((used / limit) * 100, 100);
  const isHigh = pct > 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-mono', isHigh ? 'text-amber-500' : 'text-foreground')}>
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', isHigh ? 'bg-amber-500' : 'bg-primary-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const now = new Date();
  const greeting = getGreeting();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-heading-lg text-foreground font-display">{greeting}, User</h1>
        <p className="text-body-sm text-muted-foreground mt-0.5">{dateStr}</p>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          const count = useCounter(stat.value);
          return (
            <div
              key={stat.key}
              className="group bg-card border border-border rounded-xl p-4 lg:p-5 hover:border-border/80 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px]">
                  {stat.label}
                </p>
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary-500" />
                </div>
              </div>
              <p className="text-display-sm font-mono text-foreground font-bold tracking-tight">
                {formatIndianNumber(count)}
                {stat.suffix ?? ''}
              </p>
              <p
                className={cn(
                  'text-caption mt-1',
                  stat.changeType === 'positive' && 'text-accent-500',
                  stat.changeType === 'warning' && 'text-amber-500',
                  stat.changeType === 'neutral' && 'text-muted-foreground',
                )}
              >
                {stat.change}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Main Content: Two columns ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Recommended Tenders */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-heading-sm text-foreground font-display">Recommended for you</h2>
              <Link href="/tenders" className="text-body-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors">
                See all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {RECOMMENDED_TENDERS.map((tender) => {
                const cat = getCategoryInfo(tender.category);
                const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);
                return (
                  <Link
                    key={tender.id}
                    href={`/tenders/${tender.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Category accent */}
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: cat.color.includes('#') ? cat.color.replace('text-[', '').replace(']', '') : undefined }} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>
                          {cat.label}
                        </span>
                        <span className="text-caption text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {tender.state}
                        </span>
                      </div>
                      <p className="text-body-sm text-foreground font-medium truncate group-hover:text-primary-500 transition-colors">
                        {tender.title}
                      </p>
                      <p className="text-caption text-muted-foreground truncate">{tender.organization}</p>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-body-sm font-mono text-foreground font-medium">
                        {formatCurrency(tender.estimatedValue)}
                      </p>
                      <p className={cn('text-caption', deadline.color)}>{deadline.text}</p>
                    </div>

                    {/* AI Score */}
                    <div className="shrink-0 hidden md:block">
                      <ScoreRingMini score={tender.aiScore} size={36} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Search, label: 'Search', href: '/tenders', color: 'text-primary-500' },
                { icon: Bell, label: 'Create Alert', href: '/alerts', color: 'text-accent-500' },
                { icon: Shield, label: 'Check Eligibility', href: '/eligibility', color: 'text-blue-500' },
                { icon: Columns3, label: 'Compare', href: '/compare', color: 'text-purple-500' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border transition-all text-center"
                  >
                    <Icon className={cn('w-5 h-5', action.color)} />
                    <span className="text-caption text-foreground font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Your Alerts */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-sm text-foreground font-display">Your Alerts</h3>
              <Link href="/alerts" className="text-caption text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            </div>
            <div className="space-y-2.5">
              {ALERTS.map((alert) => (
                <div key={alert.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', alert.active ? 'bg-accent-500' : 'bg-gray-500')} />
                    <span className="text-body-sm text-foreground truncate">{alert.name}</span>
                  </div>
                  <span className="text-caption text-muted-foreground font-mono shrink-0 ml-2">
                    {alert.matches} today
                  </span>
                </div>
              ))}
            </div>
            <Link href="/alerts" className="mt-4 inline-flex items-center gap-1 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
              Create new alert <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Plan Usage */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-sm text-foreground font-display">Plan Usage</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 font-semibold">
                {PLAN_USAGE.plan}
              </span>
            </div>
            <div className="space-y-3">
              <UsageBar used={PLAN_USAGE.views.used} limit={PLAN_USAGE.views.limit} label="Views today" />
              <UsageBar used={PLAN_USAGE.aiChecks.used} limit={PLAN_USAGE.aiChecks.limit} label="AI Checks" />
              <UsageBar used={PLAN_USAGE.alerts.used} limit={PLAN_USAGE.alerts.limit} label="Alerts" />
            </div>
            <Link
              href="/subscription"
              className="mt-4 block text-center py-2 rounded-lg bg-primary-500/10 text-primary-500 text-body-sm font-medium hover:bg-primary-500/15 transition-colors"
            >
              Upgrade Plan
            </Link>
          </div>

          {/* Recent Searches */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Recent Searches</h3>
            <div className="space-y-2.5">
              {RECENT_SEARCHES.map((search) => (
                <Link
                  key={search.query}
                  href={`/tenders?q=${encodeURIComponent(search.query)}`}
                  className="flex items-center gap-3 group"
                >
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-foreground truncate group-hover:text-primary-500 transition-colors">
                      {search.query}
                    </p>
                  </div>
                  <span className="text-caption text-muted-foreground shrink-0 font-mono">
                    {search.results}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
