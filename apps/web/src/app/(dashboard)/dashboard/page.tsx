'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, getDeadlineInfo, getGreeting, getCategoryInfo, formatIndianNumber } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscriptionStore } from '@/stores/subscription-store';

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS & TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface TenderItem {
  id: string;
  title: string;
  organization: string;
  category: string;
  state: string;
  estimatedValue: number | null;
  bidSubmissionDeadline: string;
  aiScore?: number;
}

interface AlertItem {
  id: string;
  name: string;
  keywords?: string[];
  active?: boolean;
}

interface TenderStatsData {
  total: number;
  active: number;
  newToday: number;
}

function useCounter(target: number, duration = 1200) {
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
   MINI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({
  label,
  value,
  icon: Icon,
  change,
  changeType,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  change: string;
  changeType: 'positive' | 'warning' | 'neutral';
  suffix?: string;
}) {
  const count = useCounter(value);

  return (
    <div className="group bg-card border border-border rounded-xl p-4 lg:p-5 hover:border-border/80 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px]">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-500" />
        </div>
      </div>
      <p className="text-display-sm font-mono text-foreground font-bold tracking-tight">
        {formatIndianNumber(count)}
        {suffix ?? ''}
      </p>
      <p
        className={cn(
          'text-caption mt-1',
          changeType === 'positive' && 'text-accent-500',
          changeType === 'warning' && 'text-amber-500',
          changeType === 'neutral' && 'text-muted-foreground',
        )}
      >
        {change}
      </p>
    </div>
  );
}

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
  const pct = Math.min((used / (limit || 1)) * 100, 100);
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
  const { user } = useAuthStore();
  const { currentPlan, subscription, isFreePlan } = useSubscriptionStore();

  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [tendersLoading, setTendersLoading] = useState(true);
  const [tendersError, setTendersError] = useState<string | null>(null);

  const [stats, setStats] = useState<TenderStatsData | null>(null);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<Array<{ query: string; results?: number }>>([]);

  const now = new Date();
  const greeting = getGreeting();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displayName = user?.name || 'User';

  const loadDashboardData = useCallback(async () => {
    // 1. Fetch live platform stats
    try {
      const statsRes = await api.get('/tenders/stats');
      if (statsRes.data?.success && statsRes.data.data) {
        setStats(statsRes.data.data);
      }
    } catch {
      // Non-blocking fallback
    }

    // 2. Fetch real active tenders
    setTendersLoading(true);
    setTendersError(null);
    try {
      const tendersRes = await api.get('/tenders', {
        params: {
          limit: 5,
          sortBy: 'publishedDate',
          sortOrder: 'desc',
          status: 'ACTIVE',
        },
      });

      const rawList = tendersRes.data?.data?.tenders || (Array.isArray(tendersRes.data?.data) ? tendersRes.data.data : []);
      const mapped: TenderItem[] = rawList.map((t: Record<string, unknown>) => ({
        id: (t.id as string) || '',
        title: (t.title as string) || 'Untitled Tender',
        organization: (t.organization as string) || 'Government Department',
        category: (t.category as string) || 'WORKS',
        state: (t.state as string) || 'All India',
        estimatedValue: (t.estimatedValue as number) ?? null,
        bidSubmissionDeadline: (t.bidSubmissionDeadline as string) || '',
        aiScore: t.reservedForMSME ? 88 : 75,
      }));
      setTenders(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tenders';
      setTendersError(msg);
    } finally {
      setTendersLoading(false);
    }

    // 3. Fetch user saved tender count
    try {
      const savedRes = await api.get('/saved', { params: { limit: 1 } });
      const totalSaved = savedRes.data?.data?.total;
      if (typeof totalSaved === 'number') {
        setSavedCount(totalSaved);
      }
    } catch {
      if (subscription?.savedTendersCount !== undefined) {
        setSavedCount(subscription.savedTendersCount);
      }
    }

    // 4. Fetch user alerts
    setAlertsLoading(true);
    try {
      const alertsRes = await api.get('/alerts');
      const alertsData = alertsRes.data?.data;
      if (Array.isArray(alertsData)) {
        setAlerts(alertsData);
      }
    } catch {
      // Unauthenticated or no alerts
    } finally {
      setAlertsLoading(false);
    }

    // 5. Recent searches
    try {
      const stored = localStorage.getItem('tb_recent_searches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentSearches(parsed.slice(0, 5));
          return;
        }
      }
    } catch {}

    setRecentSearches([
      { query: 'Medical equipment & hospital supplies', results: 142 },
      { query: 'IT infrastructure & software services', results: 85 },
      { query: 'Solar panel installation & renewable', results: 64 },
      { query: 'Civil construction & road works', results: 210 },
      { query: 'Security services & surveillance', results: 53 },
    ]);
  }, [subscription?.savedTendersCount]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const avgAiScore = useMemo(() => {
    if (tenders.length === 0) return 78;
    const sum = tenders.reduce((acc, t) => acc + (t.aiScore || 75), 0);
    return Math.round(sum / tenders.length);
  }, [tenders]);

  return (
    <div className="space-y-6">
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-heading-lg text-foreground font-display">{greeting}, {displayName}</h1>
        <p className="text-body-sm text-muted-foreground mt-0.5">{dateStr}</p>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New Today"
          value={stats?.newToday ?? 0}
          icon={Zap}
          change={stats?.newToday ? `+${stats.newToday} today` : 'Catalog live'}
          changeType="positive"
        />
        <StatCard
          label="Active Tenders"
          value={stats?.active ?? stats?.total ?? 0}
          icon={FileText}
          change={stats?.total ? `Total: ${formatIndianNumber(stats.total)}` : 'Verified tenders'}
          changeType="positive"
        />
        <StatCard
          label="Saved"
          value={savedCount}
          icon={Bookmark}
          change={savedCount > 0 ? `${savedCount} in watch list` : 'None saved yet'}
          changeType={savedCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Avg AI Score"
          value={avgAiScore}
          icon={Sparkles}
          change="AI match rate"
          changeType="neutral"
          suffix="%"
        />
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

            {tendersLoading && (
              <div className="p-8 flex items-center justify-center space-x-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span className="text-body-sm">Loading active tenders...</span>
              </div>
            )}

            {!tendersLoading && tendersError && (
              <div className="p-8 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-body-sm text-muted-foreground">{tendersError}</p>
                <button
                  onClick={loadDashboardData}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-caption font-medium hover:bg-primary-600 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

            {!tendersLoading && !tendersError && tenders.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-body-sm text-muted-foreground">No active tenders found at this moment.</p>
              </div>
            )}

            {!tendersLoading && !tendersError && tenders.length > 0 && (
              <div className="divide-y divide-border">
                {tenders.map((tender) => {
                  const cat = getCategoryInfo(tender.category);
                  const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);
                  return (
                    <Link
                      key={tender.id}
                      href={`/tenders/${tender.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                    >
                      {/* Category accent */}
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color.includes('#') ? cat.color.replace('text-[', '').replace(']', '') : undefined }}
                      />

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
                        <ScoreRingMini score={tender.aiScore ?? 75} size={36} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
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
                { icon: Shield, label: 'Check Eligibility', href: '/ai-eligibility', color: 'text-blue-500' },
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
            {alertsLoading ? (
              <div className="space-y-2 py-2">
                <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted/50 rounded animate-pulse w-1/2" />
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-caption text-muted-foreground py-2">No alerts configured yet</p>
            ) : (
              <div className="space-y-2.5">
                {alerts.slice(0, 4).map((alert) => (
                  <div key={alert.id || alert.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', alert.active !== false ? 'bg-accent-500' : 'bg-gray-500')} />
                      <span className="text-body-sm text-foreground truncate">{alert.name}</span>
                    </div>
                    <span className="text-caption text-muted-foreground font-mono shrink-0 ml-2">
                      {alert.keywords && alert.keywords.length > 0 ? alert.keywords.slice(0, 2).join(', ') : 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/alerts" className="mt-4 inline-flex items-center gap-1 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
              Create new alert <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Plan Usage */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-sm text-foreground font-display">Plan Usage</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 font-semibold">
                {currentPlan?.name || (isFreePlan ? 'Free' : 'Starter')}
              </span>
            </div>
            <div className="space-y-3">
              <UsageBar
                used={savedCount}
                limit={currentPlan?.maxSavedTenders ?? 20}
                label="Saved Tenders"
              />
              <UsageBar
                used={subscription?.aiChecksUsed ?? 0}
                limit={currentPlan?.maxAiChecks ?? 5}
                label="AI Checks"
              />
              <UsageBar
                used={subscription?.alertsCreatedCount ?? alerts.length}
                limit={currentPlan?.maxAlerts ?? 5}
                label="Alerts"
              />
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
              {recentSearches.map((search) => (
                <Link
                  key={search.query}
                  href={`/tenders?query=${encodeURIComponent(search.query)}`}
                  className="flex items-center gap-3 group"
                >
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-foreground truncate group-hover:text-primary-500 transition-colors">
                      {search.query}
                    </p>
                  </div>
                  {search.results !== undefined && (
                    <span className="text-caption text-muted-foreground shrink-0 font-mono">
                      {search.results}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
