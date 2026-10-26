'use client';

import { useState } from 'react';
import {
  CreditCard,
  TrendingDown,
  IndianRupee,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
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
import { useFetch } from '../../lib/hooks';
import {
  getSubscriptionStats,
  getSubscriptionList,
  getExpiringSubscriptions,
} from '../../lib/admin-api';
import type { SubscriptionStats, SubscriptionRecord } from '../../lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, string> = {
  Free: '#6B7280',
  Starter: '#3B82F6',
  Professional: '#FF6B35',
  Enterprise: '#A855F7',
};

const CYCLE_COLORS: Record<string, string> = {
  MONTHLY: '#FF6B35',
  YEARLY: '#00D4AA',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  EXPIRED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-amber-500/15 text-amber-400',
  PAST_DUE: 'bg-orange-500/15 text-orange-400',
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
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[plan] || 'bg-muted text-foreground/80'}`}
    >
      {plan}
    </span>
  );
}

function statusBadge(status: string) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-muted text-foreground/80'}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : status === 'EXPIRED' ? 'bg-red-400' : status === 'CANCELLED' ? 'bg-amber-400' : 'bg-orange-400'}`}
      />
      {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PlanTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const value = item.value ?? 0;
  const color = item.payload?.color || '#3B82F6';
  const planName = label || item.payload?.name || 'Plan';
  return (
    <div className="bg-secondary-900/95 text-white border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-xl backdrop-blur-md min-w-[130px]">
      <p className="text-xs font-semibold text-white mb-1.5">{planName}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
        <span className="text-slate-300 font-medium">Subscribers:</span>
        <span className="text-white font-bold">{value} {value === 1 ? 'user' : 'users'}</span>
      </div>
    </div>
  );
}

function CycleTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const value = item.value ?? 0;
  const name = item.name || item.payload?.name || 'Cycle';
  const color = item.payload?.color || '#FF6B35';
  return (
    <div className="bg-secondary-900/95 text-white border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-xl backdrop-blur-md min-w-[130px]">
      <p className="text-xs font-semibold text-white mb-1.5">{name}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
        <span className="text-slate-300 font-medium">Active Plans:</span>
        <span className="text-white font-bold">{value} {value === 1 ? 'subscriber' : 'subscribers'}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubscriptionsPage() {
  const [subSearch, setSubSearch] = useState('');
  const [subPlanFilter, setSubPlanFilter] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [subCycleFilter, setSubCycleFilter] = useState('');
  const [subPage, setSubPage] = useState(1);
  const SUB_PAGE_SIZE = 10;

  // ── API Data ────────────────────────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useFetch<SubscriptionStats>(getSubscriptionStats);

  const {
    data: expiringData,
    isLoading: expiringLoading,
  } = useFetch(getExpiringSubscriptions);

  const {
    data: subListData,
    isLoading: subListLoading,
  } = useFetch(
    () =>
      getSubscriptionList({
        page: subPage,
        limit: SUB_PAGE_SIZE,
        search: subSearch || undefined,
        plan: subPlanFilter || undefined,
        status: subStatusFilter || undefined,
        billingCycle: subCycleFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    [subPage, subSearch, subPlanFilter, subStatusFilter, subCycleFilter],
  );

  // ── Loading ─────────────────────────────────────────────────────────────
  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (statsError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-muted-foreground">{statsError || 'Failed to load subscription data'}</p>
        <button
          onClick={refetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const churnRate =
    stats.total > 0
      ? ((stats.cancelled / stats.total) * 100).toFixed(1)
      : '0.0';

  const planDistData = stats.planDistribution.map((p) => ({
    name: p.plan,
    value: p.count,
    color: PLAN_COLORS[p.plan] || '#6B7280',
  }));

  const cycleDistData = stats.billingCycleDistribution.map((b) => ({
    name: b.cycle === 'MONTHLY' ? 'Monthly' : 'Yearly',
    value: b.count,
    color: CYCLE_COLORS[b.cycle] || '#6B7280',
  }));

  const expiringSubs: SubscriptionRecord[] =
    expiringData?.subscriptions || [];
  const subList: SubscriptionRecord[] =
    subListData?.subscriptions || [];
  const subTotal = subListData?.total || 0;
  const subTotalPages = Math.max(1, Math.ceil(subTotal / SUB_PAGE_SIZE));

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Subscription Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor subscription metrics, revenue, and churn across all plans.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          iconBg="bg-blue-500/15 text-blue-400"
          label="Active Subscribers"
          value={formatINR(stats.active)}
          sub={`${formatINR(stats.total)} total`}
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5" />}
          iconBg="bg-red-500/15 text-red-400"
          label="Churn Rate"
          value={`${churnRate}%`}
          sub={`${formatINR(stats.cancelled)} cancelled`}
        />
        <StatCard
          icon={<IndianRupee className="w-5 h-5" />}
          iconBg="bg-green-500/15 text-green-400"
          label="Monthly Recurring Revenue"
          value={`\u20B9${formatINR(Math.round(stats.mrr))}`}
          sub={`ARR: \u20B9${formatINR(Math.round(stats.arr))}`}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          iconBg="bg-purple-500/15 text-purple-400"
          label="Expiring in 7 Days"
          value={String(stats.expiringNext7Days)}
          sub={`${formatINR(stats.expired)} expired total`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Subscribers by Plan */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Active Subscribers by Plan
          </h2>
          {planDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip content={<PlanTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {planDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No plan distribution data available
            </div>
          )}
        </div>

        {/* Billing Cycle Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Billing Cycle Distribution
          </h2>
          {cycleDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cycleDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {cycleDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CycleTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-foreground/80 text-sm">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No billing cycle data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Cancellations */}
      {stats.recentCancellations.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Recent Cancellations
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cancelled
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCancellations.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80 shrink-0">
                          {c.userName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <span className="text-sm text-foreground font-medium">
                          {c.userName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground">
                      {c.userEmail}
                    </td>
                    <td className="py-3 pr-4">{planBadge(c.plan)}</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {formatDate(c.cancelledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expiring Soon */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">
            Expiring in Next 7 Days
          </h2>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
            {stats.expiringNext7Days} subscription{stats.expiringNext7Days === 1 ? '' : 's'}
          </span>
        </div>
        {expiringLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : expiringSubs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Billing
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Auto-Renew
                  </th>
                </tr>
              </thead>
              <tbody>
                {expiringSubs.map((sub) => {
                  const daysLeft = Math.ceil(
                    (new Date(sub.endDate).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80 shrink-0">
                            {sub.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <span className="text-sm text-foreground font-medium">
                            {sub.userName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {sub.userEmail}
                      </td>
                      <td className="py-3 pr-4">{planBadge(sub.plan)}</td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {sub.billingCycle === 'MONTHLY'
                          ? 'Monthly'
                          : 'Yearly'}
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(sub.endDate)}
                          </span>
                          <span
                            className={`ml-2 text-xs font-medium ${daysLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}
                          >
                            ({daysLeft}d left)
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        {sub.autoRenew ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No subscriptions expiring in the next 7 days
          </div>
        )}
      </div>

      {/* Full Subscription List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            All Subscriptions
          </h2>
          {/* Search + Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={subSearch}
                onChange={(e) => {
                  setSubSearch(e.target.value);
                  setSubPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <select
                value={subPlanFilter}
                onChange={(e) => {
                  setSubPlanFilter(e.target.value);
                  setSubPage(1);
                }}
                className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={subStatusFilter}
                onChange={(e) => {
                  setSubStatusFilter(e.target.value);
                  setSubPage(1);
                }}
                className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="PAST_DUE">Past Due</option>
              </select>
              <select
                value={subCycleFilter}
                onChange={(e) => {
                  setSubCycleFilter(e.target.value);
                  setSubPage(1);
                }}
                className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">All Cycles</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {subListLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : subList.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-card/80">
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Billing
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Start
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      End
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Auto-Renew
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subList.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80 shrink-0">
                            {sub.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="text-sm text-foreground font-medium">
                              {sub.userName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{planBadge(sub.plan)}</td>
                      <td className="p-4">{statusBadge(sub.status)}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {sub.billingCycle === 'MONTHLY'
                          ? 'Monthly'
                          : 'Yearly'}
                      </td>
                      <td className="p-4 text-sm text-foreground font-medium">
                        {`\u20B9${formatINR(sub.amount)}`}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(sub.startDate)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(sub.endDate)}
                      </td>
                      <td className="p-4">
                        {sub.autoRenew ? (
                          <span className="text-xs text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-xs text-red-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(subPage - 1) * SUB_PAGE_SIZE + 1}-
                {Math.min(subPage * SUB_PAGE_SIZE, subTotal)} of {subTotal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={subPage === 1}
                  onClick={() => setSubPage(subPage - 1)}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from(
                  { length: Math.min(subTotalPages, 5) },
                  (_, i) => {
                    let pageNum: number;
                    if (subTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (subPage <= 3) {
                      pageNum = i + 1;
                    } else if (subPage >= subTotalPages - 2) {
                      pageNum = subTotalPages - 4 + i;
                    } else {
                      pageNum = subPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setSubPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === subPage
                            ? 'bg-primary-500 text-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}
                <button
                  disabled={subPage === subTotalPages}
                  onClick={() => setSubPage(subPage + 1)}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No subscriptions found
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
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs mt-2 text-muted-foreground">{sub}</p>
    </div>
  );
}
