'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Eye,
  Bookmark,
  MapPin,
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building2,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getPlatformAnalytics,
  getSearchTrends,
  getTenderAnalytics,
} from '@/lib/admin-api';
import type {
  PlatformAnalytics,
  SearchTrends,
  TenderAnalyticsData,
  Period,
} from '@/lib/types';
import { useAppearance } from '@/lib/appearance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return (n || 0).toLocaleString('en-IN');
}

function formatINR(num: number | null | undefined): string {
  if (!num || num <= 0) return 'Value on Request';
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getHeatColor(val: number): string {
  if (val <= 0) return 'bg-muted/40';
  if (val < 5) return 'bg-emerald-950/40 text-emerald-300';
  if (val < 15) return 'bg-emerald-800/50 text-emerald-200';
  if (val < 30) return 'bg-emerald-600/60 text-white';
  return 'bg-emerald-500/80 text-white';
}

function ChartTooltip({ active, payload, label, unit = 'Count' }: any) {
  const { accentColor } = useAppearance();
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const value = item.value ?? 0;
  const title =
    label ||
    item.payload?.keyword ||
    item.payload?.category ||
    item.payload?.state ||
    item.payload?.name ||
    item.name ||
    '';
  const metricName = item.name === 'value' || item.name === 'count' ? unit : (item.name || unit);
  const color = item.color || item.payload?.fill || accentColor;

  return (
    <div className="bg-secondary-900/95 text-white border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-xl backdrop-blur-md min-w-[140px]">
      {title && <p className="text-xs font-semibold text-white mb-1.5 truncate max-w-[240px]">{title}</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
        <span className="text-slate-300 font-medium">{metricName}:</span>
        <span className="text-white font-bold">{formatNumber(value)}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [searchTrends, setSearchTrends] = useState<SearchTrends | null>(null);
  const [tenderAnalytics, setTenderAnalytics] = useState<TenderAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isManual = false, isBackground = false) => {
    if (isManual) setIsRefreshing(true);
    else if (!isBackground) setIsLoading(true);
    setError(null);

    try {
      const [platformData, trendsData, tenderData] = await Promise.all([
        getPlatformAnalytics(),
        getSearchTrends(),
        getTenderAnalytics(period),
      ]);
      setAnalytics(platformData);
      setSearchTrends(trendsData);
      setTenderAnalytics(tenderData);
      setSecondsAgo(0);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      if (!isBackground) {
        setError(err?.message || 'Failed to load analytics from database.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Auto-Refresh every 8 seconds
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      loadData(false, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, loadData]);

  // Live seconds elapsed ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Derived real data for keywords
  const topKeywordsData = (searchTrends?.topSearches || []).length > 0
    ? (searchTrends?.topSearches || []).slice(0, 10).map((s) => ({
        keyword: s.query,
        searches: s.count,
      }))
    : (searchTrends?.redisKeywords || []).slice(0, 10).map((k) => ({
        keyword: k.keyword,
        searches: Math.round(k.score),
      }));

  // Search volume trend
  const searchVolumeData = (searchTrends?.dailyVolume || []).map((v) => {
    const d = new Date(v.date);
    return {
      name: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      volume: v.count,
    };
  });

  // Most viewed tenders
  const viewedTenders = analytics?.mostViewedTenders || [];

  // Most saved tenders
  const savedTenders = analytics?.mostSavedTenders || [];

  // Geographic distribution by state
  const stateData = (analytics?.tendersByState || []).slice(0, 10).map((s) => ({
    state: s.state || 'Other',
    count: s.count,
  }));

  // Category breakdown
  const categoryData = (analytics?.tendersByCategory || []).map((c) => ({
    category: c.category,
    count: c.count,
    avgValue: c.avgValue,
  }));

  // New tenders per day from tenderAnalytics
  const newTendersData = (tenderAnalytics?.dailyTenders || []).map((t) => {
    const d = new Date(t.date);
    return {
      name: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      tenders: t.count,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DB
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time platform insights aggregated directly from PostgreSQL &amp; Redis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Auto-Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isAutoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
            }`}
            title={isAutoRefresh ? 'Live auto-update active (every 8s)' : 'Live updates paused (click to resume)'}
          >
            <span className={`w-2 h-2 rounded-full ${isAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span>{isAutoRefresh ? 'Auto-Update (8s)' : 'Updates Paused'}</span>
            <span className="text-[10px] font-normal opacity-75">
              • {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
            </span>
          </button>

          {/* Period selector */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Searches</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : formatNumber(searchTrends?.totalSearches || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Recorded user queries</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Tenders</p>
          <p className="text-2xl font-bold text-primary-500 mt-1">
            {isLoading ? '...' : formatNumber(analytics?.tendersByCategory.reduce((sum, c) => sum + c.count, 0) || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active in platform</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">States Covered</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : (analytics?.tendersByState || []).length}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">National &amp; state portals</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Period Tender Vol</p>
          <p className="text-2xl font-bold text-accent-500 mt-1">
            {isLoading ? '...' : formatNumber(tenderAnalytics?.totalAdded || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Added in last {period}</p>
        </div>
      </div>

      {/* ========== SEARCH ANALYTICS ========== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-bold text-foreground">Search Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top searched keywords */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Top Searched Queries</h3>
            {isLoading ? (
              <div className="h-[320px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : topKeywordsData.length === 0 ? (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Search className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No search queries logged yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topKeywordsData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis
                    dataKey="keyword"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip content={<ChartTooltip unit="Searches" />} />
                  <Bar dataKey="searches" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Search volume trend */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Search Volume Trend</h3>
            {isLoading ? (
              <div className="h-[320px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : searchVolumeData.length === 0 ? (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No volume data logged yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={searchVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip content={<ChartTooltip unit="Searches" />} />
                  <Line type="monotone" dataKey="volume" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ========== CONTENT ANALYTICS ========== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-bold text-foreground">Content &amp; Engagement</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most viewed tenders */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Most Viewed Tenders</h3>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 border border-primary-500/20 font-medium">
                <Eye className="w-3 h-3" />
                Live Views
              </span>
            </div>
            {isLoading ? (
              <div className="h-60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : viewedTenders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No tender view data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tender</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Value</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewedTenders.slice(0, 7).map((t, idx) => (
                      <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-3 max-w-[240px]">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground font-semibold mt-0.5">{idx + 1}.</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate" title={t.title}>
                                {t.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{t.organization || t.state}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-xs text-foreground font-medium text-right whitespace-nowrap">
                          {formatINR(t.estimatedValue)}
                        </td>
                        <td className="py-2.5 text-xs text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/25 text-primary-500 font-bold">
                            <Eye className="w-3 h-3 text-primary-500" />
                            {formatNumber(t.viewCount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Most saved tenders */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Most Saved Tenders</h3>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                <Bookmark className="w-3 h-3 fill-amber-500" />
                Live Bookmarks
              </span>
            </div>
            {isLoading ? (
              <div className="h-60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : savedTenders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No saved tender records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tender</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Bookmarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {savedTenders.slice(0, 7).map((t, idx) => (
                      <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-3 max-w-[260px]">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground font-semibold mt-0.5">{idx + 1}.</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate" title={t.title}>
                                {t.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{t.organization}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted border border-border">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-500 font-bold">
                            <Bookmark className="w-3 h-3 fill-amber-500" />
                            {formatNumber(t.savedCount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== TENDER & GEOGRAPHY ANALYTICS ========== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-bold text-foreground">Tender Volume &amp; Distribution</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category distribution */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Volume by Category</h3>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip content={<ChartTooltip unit="Tenders" />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* State distribution */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Top States by Tender Count</h3>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stateData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis
                    dataKey="state"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip content={<ChartTooltip unit="Tenders" />} />
                  <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Tenders Trend */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Daily Tenders Added (Last {period})
          </h3>
          {isLoading ? (
            <div className="h-[260px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : newTendersData.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No new tenders in selected period ({period})</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={newTendersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <Tooltip content={<ChartTooltip unit="Tenders" />} />
                <Line type="monotone" dataKey="tenders" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
