'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  IndianRupee,
  FileText,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Bot,
  ArrowRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFetch } from '@/lib/hooks';
import {
  getDashboardStats,
  getDashboardCharts,
  getRecentSignups,
  getScraperHealth,
} from '@/lib/admin-api';
import type { DashboardStats, DashboardCharts, RecentSignup, Period } from '@/lib/types';

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, string> = {
  free: '#6B7280',
  starter: '#3B82F6',
  professional: '#FF6B35',
  enterprise: '#A855F7',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatINR(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
  return num.toLocaleString('en-IN');
}

function planBadge(plan: string) {
  const colors: Record<string, string> = {
    Free: 'bg-muted text-foreground/80',
    Starter: 'bg-blue-500/15 text-blue-400',
    Professional: 'bg-orange-500/15 text-orange-400',
    Enterprise: 'bg-purple-500/15 text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[plan] || 'bg-muted text-foreground/80'}`}>
      {plan}
    </span>
  );
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [chartPeriod, setChartPeriod] = useState<Period>('30d');

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } =
    useFetch(() => getDashboardStats(), []);

  const { data: charts, isLoading: chartsLoading } =
    useFetch(() => getDashboardCharts(chartPeriod), [chartPeriod]);

  const { data: signups, isLoading: signupsLoading } =
    useFetch(() => getRecentSignups(10), []);

  const { data: scraperData } = useFetch(() => getScraperHealth(), []);

  // Derive subscription distribution for pie chart
  const subscriptionDistribution = useMemo(() => {
    if (!stats?.subscriptions?.byPlan) return [];
    return stats.subscriptions.byPlan.map((p) => ({
      name: p.plan,
      value: p.count,
      color: PLAN_COLORS[p.slug] || '#6B7280',
    }));
  }, [stats]);

  // Revenue chart data
  const revenueData = useMemo(() => {
    if (!charts?.revenue) return [];
    return charts.revenue.map((p) => ({
      name: formatChartDate(p.date),
      revenue: p.amount,
    }));
  }, [charts]);

  // User signups chart data (last 7 days)
  const usersChartData = useMemo(() => {
    if (!charts?.users) return [];
    const last7 = charts.users.slice(-7);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return last7.map((p) => ({
      name: dayNames[new Date(p.date).getDay()],
      users: p.count,
    }));
  }, [charts]);

  // Scraper health with resilient field mapping
  const scraperHealth = useMemo(() => {
    let list: any[] = [];
    if (scraperData) {
      if (Array.isArray(scraperData)) list = scraperData;
      else if ((scraperData as any)?.scrapers) list = (scraperData as any).scrapers;
    }
    return list.map((s: any) => ({
      id: s.id || s.portalName || s.name,
      portalName: s.portalName || s.portal || s.name || 'Portal Scraper',
      status: (s.status || 'HEALTHY').toUpperCase(),
      lastRunAt: s.lastRunAt || s.lastRun || null,
      tendersScraped: s.totalTendersFound ?? s.tendersScraped ?? 0,
    }));
  }, [scraperData]);

  // ── Loading state ───────────────────────────────────────────────────
  if (statsLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-muted-foreground">{statsError}</p>
        <button
          onClick={refetchStats}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back! Here is what is happening on TenderBazaar today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-blue-500/15 text-blue-400"
          label="Total Users"
          value={formatINR(stats?.users.total || 0)}
          trend={`+${formatINR(stats?.users.newThisWeek || 0)} this week`}
          trendUp={(stats?.users.weekOverWeekChange || 0) >= 0}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          iconBg="bg-purple-500/15 text-purple-400"
          label="Active Subscriptions"
          value={formatINR(stats?.subscriptions.active || 0)}
          trend="paid plans"
          trendUp
        />
        <StatCard
          icon={<IndianRupee className="w-5 h-5" />}
          iconBg="bg-green-500/15 text-green-400"
          label="MRR"
          value={`\u20B9${formatINR(stats?.revenue.mrr || 0)}`}
          trend={`${(stats?.revenue.monthOverMonthChange || 0) >= 0 ? '+' : ''}${stats?.revenue.monthOverMonthChange || 0}% MoM`}
          trendUp={(stats?.revenue.monthOverMonthChange || 0) >= 0}
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          iconBg="bg-orange-500/15 text-orange-400"
          label="Total Tenders"
          value={formatINR(stats?.tenders.total || 0)}
          trend={`+${formatINR(stats?.tenders.addedThisWeek || 0)} this week`}
          trendUp
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-teal-500/15 text-teal-400"
          label="Today's New Tenders"
          value={formatINR(stats?.tenders.addedToday || 0)}
          trend={`${(stats?.tenders.todayVsYesterday || 0) >= 0 ? '+' : ''}${stats?.tenders.todayVsYesterday || 0} vs yesterday`}
          trendUp={(stats?.tenders.todayVsYesterday || 0) >= 0}
        />
      </div>

      {/* Period selector for charts */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Period:</span>
        {(['7d', '30d', '90d', '1y'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setChartPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              chartPeriod === p
                ? 'bg-primary-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Revenue</h2>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} tickFormatter={(v) => `${Math.floor(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                  labelStyle={{ color: '#6B7280' }}
                  formatter={(value: number) => [`\u20B9${formatINR(value)}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#FF6B35" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subscription Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Distribution</h2>
          {subscriptionDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {subscriptionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                  labelStyle={{ color: '#6B7280' }}
                  formatter={(value: number, name: string) => [formatINR(value), name]}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => <span className="text-foreground/80 text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* New Users Chart + Scraper Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">New Users (Last 7 Days)</h2>
          {usersChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usersChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                  labelStyle={{ color: '#6B7280' }}
                />
                <Bar dataKey="users" fill="#00D4AA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Scraper Health */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-foreground">Scraper Health Status</h2>
            </div>
            <Link
              href="/scrapers"
              className="text-xs text-primary-500 hover:text-primary-600 font-medium inline-flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scraperHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                No scraper data available
              </p>
            ) : (
              scraperHealth.map((scraper: any) => {
                const isHealthy = scraper.status === 'HEALTHY' || scraper.status === 'READY';
                const isSlow = scraper.status === 'SLOW' || scraper.status === 'DEGRADED';
                const isDisabled = scraper.status === 'DISABLED';
                return (
                  <div
                    key={scraper.id}
                    className="flex items-center justify-between bg-muted/40 border border-border rounded-lg p-3 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isHealthy
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                            : isSlow
                            ? 'bg-amber-400'
                            : isDisabled
                            ? 'bg-muted-foreground'
                            : 'bg-red-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={scraper.portalName}>
                          {scraper.portalName}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {scraper.lastRunAt
                            ? new Date(scraper.lastRunAt).toLocaleString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-foreground">
                        {Number(scraper.tendersScraped).toLocaleString('en-IN')}
                      </span>
                      <p className="text-[10px] text-muted-foreground">scraped</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Signups</h2>
        {signupsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(signups || []).map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80">
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <span className="text-sm text-foreground font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="py-3 pr-4">{planBadge(user.plan)}</td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground">{user.company || '\u2014'}</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(user.joined).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
                {(!signups || signups.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No recent signups
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  icon,
  iconBg,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className={`text-xs mt-2 flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
        {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {trend}
      </p>
    </div>
  );
}
