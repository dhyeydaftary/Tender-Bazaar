'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Bell,
  Bookmark,
  ArrowRight,
  ChevronRight,
  Search,
  Shield,
  Columns3,
  Sparkles,
  Zap,
  MapPin,
  AlertCircle,
  UserCog,
} from 'lucide-react';
import {
  cn,
  formatCurrency,
  getDeadlineInfo,
  getGreeting,
  getCategoryInfo,
  formatIndianNumber,
} from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useDashboardStore,
  type DashboardAlert,
  type RecommendedTender,
  type SearchHistoryItem,
  type UsageItem,
} from '@/stores/dashboard-store';

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

function useCounter(target: number, duration = 1500) {
  const [value, setValue] = useState(0);

  useEffect(() => {
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
  }, [target, duration]);

  return value;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Plan limits use -1 to mean unlimited (see CLAUDE.md). */
const isUnlimited = (limit: number) => limit === -1;

/* ═══════════════════════════════════════════════════════════════════════════
   MINI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreRingMini({ score, size = 32 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative" style={{ width: size, height: size }} title={`Match score ${score}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={3}
          fill="none"
          className="text-muted/50"
        />
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

function UsageBar({ item }: { item: UsageItem }) {
  const unlimited = isUnlimited(item.limit);
  const pct = unlimited ? 0 : Math.min(item.percentage, 100);
  const isHigh = !unlimited && pct > 80;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{item.label}</span>
        <span className={cn('font-mono', isHigh ? 'text-amber-500' : 'text-foreground')}>
          {unlimited ? `${item.used} / ∞` : `${item.used}/${item.limit}`}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            unlimited ? 'bg-accent-500/40' : isHigh ? 'bg-amber-500' : 'bg-primary-500',
          )}
          style={{ width: unlimited ? '100%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | null;
  icon: React.ElementType;
  change: string;
  changeType: 'positive' | 'negative' | 'warning' | 'neutral';
  suffix?: string;
}

/**
 * Extracted into its own component so the animation hook runs at a stable
 * position. It used to be called inside the stats `.map()`, which breaks the
 * rules of hooks as soon as the number of cards is data-dependent.
 */
function StatCard({ label, value, icon: Icon, change, changeType, suffix }: StatCardProps) {
  const count = useCounter(value ?? 0);

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
        {value === null ? '—' : `${formatIndianNumber(count)}${suffix ?? ''}`}
      </p>
      <p
        className={cn(
          'text-caption mt-1',
          changeType === 'positive' && 'text-accent-500',
          changeType === 'negative' && 'text-red-500',
          changeType === 'warning' && 'text-amber-500',
          changeType === 'neutral' && 'text-muted-foreground',
        )}
      >
        {change}
      </p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 lg:p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-2.5 w-20 bg-muted rounded" />
        <div className="w-8 h-8 rounded-lg bg-muted" />
      </div>
      <div className="h-7 w-24 bg-muted rounded" />
      <div className="h-2.5 w-14 bg-muted rounded mt-2" />
    </div>
  );
}

function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted shrink-0" />
          <div className="h-3 flex-1 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-body-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANELS
   ═══════════════════════════════════════════════════════════════════════════ */

function RecommendedPanel({
  tenders,
  personalised,
  isLoading,
}: {
  tenders: RecommendedTender[];
  personalised: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-heading-sm text-foreground font-display">
            {personalised ? 'Recommended for you' : 'Latest tenders'}
          </h2>
          {!isLoading && !personalised && tenders.length > 0 && (
            <p className="text-caption text-muted-foreground mt-0.5">
              Complete your company profile for personalised matches
            </p>
          )}
        </div>
        <Link
          href="/tenders"
          className="text-body-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors shrink-0"
        >
          See all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="px-5 py-4">
          <PanelSkeleton rows={5} />
        </div>
      ) : tenders.length === 0 ? (
        <div className="px-5">
          <EmptyState
            message="No active tenders to show yet."
            action={
              <Link
                href="/tenders"
                className="text-body-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                Browse all tenders
              </Link>
            }
          />
        </div>
      ) : (
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                        cat.color,
                        cat.bgColor,
                      )}
                    >
                      {cat.label}
                    </span>
                    <span className="text-caption text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {tender.state}
                    </span>
                  </div>
                  <p className="text-body-sm text-foreground font-medium truncate group-hover:text-primary-500 transition-colors">
                    {tender.title}
                  </p>
                  <p className="text-caption text-muted-foreground truncate">
                    {tender.organization}
                  </p>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-body-sm font-mono text-foreground font-medium">
                    {tender.estimatedValue ? formatCurrency(tender.estimatedValue) : '—'}
                  </p>
                  <p className={cn('text-caption', deadline.color)}>{deadline.text}</p>
                </div>

                {tender.aiScore !== null && (
                  <div className="shrink-0 hidden md:block">
                    <ScoreRingMini score={tender.aiScore} size={36} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertsPanel({ alerts, isLoading }: { alerts: DashboardAlert[]; isLoading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-heading-sm text-foreground font-display">Your Alerts</h3>
        <Link
          href="/alerts"
          className="text-caption text-primary-500 hover:text-primary-600 font-medium"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <PanelSkeleton />
      ) : alerts.length === 0 ? (
        <EmptyState
          message="You have no alerts yet."
          action={
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1 text-body-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              Create your first alert <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      alert.isActive ? 'bg-accent-500' : 'bg-gray-500',
                    )}
                    title={alert.isActive ? 'Active' : 'Paused'}
                  />
                  <span className="text-body-sm text-foreground truncate">{alert.name}</span>
                </div>
                <span className="text-caption text-muted-foreground font-mono shrink-0 ml-2">
                  {formatIndianNumber(alert.matchCount)}{' '}
                  {alert.matchCount === 1 ? 'match' : 'matches'}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/alerts"
            className="mt-4 inline-flex items-center gap-1 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Create new alert <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </div>
  );
}

function PlanUsagePanel({
  planName,
  usage,
  isLoading,
}: {
  planName: string | undefined;
  usage: UsageItem[];
  isLoading: boolean;
}) {
  // "Comparison tenders per session" is a per-request cap, not consumption, so
  // a usage bar for it would always read 0 and tell the user nothing.
  const bars = usage.filter((item) => item.resetType !== 'per_request');

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-heading-sm text-foreground font-display">Plan Usage</h3>
        {planName && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 font-semibold">
            {planName}
          </span>
        )}
      </div>

      {isLoading ? (
        <PanelSkeleton rows={3} />
      ) : bars.length === 0 ? (
        <EmptyState message="Usage data unavailable." />
      ) : (
        <div className="space-y-3">
          {bars.map((item) => (
            <UsageBar key={item.feature} item={item} />
          ))}
        </div>
      )}

      <Link
        href="/subscription"
        className="mt-4 block text-center py-2 rounded-lg bg-primary-500/10 text-primary-500 text-body-sm font-medium hover:bg-primary-500/15 transition-colors"
      >
        Manage Plan
      </Link>
    </div>
  );
}

function RecentSearchesPanel({
  searches,
  isLoading,
}: {
  searches: SearchHistoryItem[];
  isLoading: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-heading-sm text-foreground font-display mb-4">Recent Searches</h3>

      {isLoading ? (
        <PanelSkeleton rows={3} />
      ) : searches.length === 0 ? (
        <EmptyState
          message="Your recent searches will show up here."
          action={
            <Link
              href="/search"
              className="inline-flex items-center gap-1 text-body-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              Start searching <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {searches.map((search) => (
            <Link
              key={search.id}
              href={`/tenders?q=${encodeURIComponent(search.query)}`}
              className="flex items-center gap-3 group"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-foreground truncate group-hover:text-primary-500 transition-colors">
                  {search.query}
                </p>
                <p className="text-caption text-muted-foreground">{timeAgo(search.createdAt)}</p>
              </div>
              {search.resultCount !== null && (
                <span className="text-caption text-muted-foreground shrink-0 font-mono">
                  {formatIndianNumber(search.resultCount)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading, error, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displayName = user?.name || 'User';
  const stats = data?.stats;
  // Only show skeletons on the very first load; a background refresh should not
  // blank out data the user is already reading.
  const showSkeleton = isLoading && !data;

  const newTodayChange =
    stats?.newTodayChangePct !== null && stats?.newTodayChangePct !== undefined
      ? `${stats.newTodayChangePct >= 0 ? '+' : ''}${stats.newTodayChangePct}% vs yesterday`
      : 'vs yesterday: n/a';

  return (
    <div className="space-y-6">
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-heading-lg text-foreground font-display">
          {greeting}, {displayName}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-0.5">{dateStr}</p>
      </div>

      {/* ── Error banner ──────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body-sm text-foreground font-medium">{error}</p>
            <button
              onClick={() => fetchDashboard({ force: true })}
              className="text-caption text-primary-500 hover:text-primary-600 font-medium mt-0.5"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="New Today"
              value={stats?.newToday ?? 0}
              icon={Zap}
              change={newTodayChange}
              changeType={
                stats?.newTodayChangePct == null
                  ? 'neutral'
                  : stats.newTodayChangePct >= 0
                    ? 'positive'
                    : 'negative'
              }
            />
            <StatCard
              label="Active Tenders"
              value={stats?.activeTenders ?? 0}
              icon={FileText}
              change={`+${formatIndianNumber(stats?.activeAddedThisWeek ?? 0)} this week`}
              changeType="positive"
            />
            <StatCard
              label="Saved"
              value={stats?.savedCount ?? 0}
              icon={Bookmark}
              change={
                stats?.savedExpiringSoon
                  ? `${stats.savedExpiringSoon} closing in 7 days`
                  : 'none closing soon'
              }
              changeType={stats?.savedExpiringSoon ? 'warning' : 'neutral'}
            />
            <StatCard
              label="Avg AI Score"
              value={stats?.avgAiScore ?? null}
              icon={Sparkles}
              suffix="%"
              change={
                stats?.aiChecksCount
                  ? `across ${formatIndianNumber(stats.aiChecksCount)} ${
                      stats.aiChecksCount === 1 ? 'check' : 'checks'
                    }`
                  : 'no checks yet'
              }
              changeType="neutral"
            />
          </>
        )}
      </div>

      {/* ── Main Content: Two columns ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          <RecommendedPanel
            tenders={data?.recommendedTenders.tenders ?? []}
            personalised={data?.recommendedTenders.personalised ?? false}
            isLoading={showSkeleton}
          />
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
                {
                  icon: Shield,
                  label: 'Check Eligibility',
                  href: '/ai-eligibility',
                  color: 'text-blue-500',
                },
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

          {/* Complete-profile nudge — only when recommendations are not yet
              personalised, since that is exactly what unlocks them. */}
          {!showSkeleton && data && !data.recommendedTenders.personalised && (
            <Link
              href="/settings"
              className="flex items-start gap-3 bg-card border border-border rounded-xl p-5 hover:border-primary-500/40 transition-colors group"
            >
              <UserCog className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-body-sm text-foreground font-medium group-hover:text-primary-500 transition-colors">
                  Complete your company profile
                </p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  Add your categories, states and turnover to get matched tenders and AI scores.
                </p>
              </div>
            </Link>
          )}

          <AlertsPanel alerts={data?.alerts ?? []} isLoading={showSkeleton} />

          <PlanUsagePanel
            planName={data?.planUsage.planName}
            usage={data?.planUsage.usage ?? []}
            isLoading={showSkeleton}
          />

          <RecentSearchesPanel
            searches={data?.recentSearches ?? []}
            isLoading={showSkeleton}
          />
        </div>
      </div>
    </div>
  );
}
