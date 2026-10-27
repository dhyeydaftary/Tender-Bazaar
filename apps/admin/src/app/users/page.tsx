'use client';

import { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useFetch } from '../../lib/hooks';
import { getUserList } from '../../lib/admin-api';
import type { UserListResponse } from '../../lib/types';
import {
  ROLE_OPTIONS,
  EMAIL_FILTER_OPTIONS,
  roleBadge,
  type EmailVerifiedFilter,
} from '../../lib/user-display';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function planBadge(plan: string | null) {
  if (!plan) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80">
        None
      </span>
    );
  }
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PLANS = ['free', 'starter', 'professional', 'enterprise'];
const PAGE_SIZE = 10;

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState<EmailVerifiedFilter | ''>('');
  const [page, setPage] = useState(1);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useFetch<UserListResponse>(
    () =>
      getUserList({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        plan: planFilter || undefined,
        role: roleFilter || undefined,
        emailVerified: emailFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    [page, search, planFilter, roleFilter, emailFilter],
  );

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} user{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Total: {total}</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All Plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={emailFilter}
            onChange={(e) => {
              setEmailFilter(e.target.value as EmailVerifiedFilter | '');
              setPage(1);
            }}
            aria-label="Filter by email verification"
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All email states</option>
            {EMAIL_FILTER_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-card/80">
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Company
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground/80 shrink-0">
                            {user.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <span className="text-sm text-foreground font-medium">
                              {user.name}
                            </span>
                            {(() => {
                              const badge = roleBadge(user.role);
                              return badge ? (
                                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.phone || '—'}
                      </td>
                      <td className="p-4">{planBadge(user.plan)}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.company || '—'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {user.isEmailVerified ? (
                            <span className="text-xs text-emerald-400" title="Email verified">
                              Email
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 line-through" title="Email not verified">
                              Email
                            </span>
                          )}
                          {user.isPhoneVerified ? (
                            <span className="text-xs text-emerald-400" title="Phone verified">
                              Phone
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 line-through" title="Phone not verified">
                              Phone
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from(
                  { length: Math.min(totalPages, 5) },
                  (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === page
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
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
