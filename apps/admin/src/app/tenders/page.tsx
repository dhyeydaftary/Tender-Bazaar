'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Trash2,
  FileText,
  Calendar,
  Building2,
  Globe,
  Tag,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  X,
  Loader2,
  RefreshCw,
  FolderOpen,
  Filter,
  Sparkles,
  Download,
  Layers,
  MapPin,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useFetch } from '@/lib/hooks';
import {
  getTenderList,
  getTenderStats,
  getTenderDetail,
  deleteTender,
} from '@/lib/admin-api';
import type { TenderAdminRecord } from '@/lib/types';
import { ConfirmModal } from '@/components/confirm-modal';
import { ToastAlert } from '@/components/toast-alert';

// ---------------------------------------------------------------------------
// Constants & Options
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatINR(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num) || num <= 0) return 'Not Disclosed';
  if (num >= 1_00_00_000) {
    const crore = num / 1_00_00_000;
    return `₹${crore.toFixed(crore % 1 === 0 ? 0 : 2)} Cr`;
  }
  if (num >= 1_00_000) {
    const lakh = num / 1_00_000;
    return `₹${lakh.toFixed(lakh % 1 === 0 ? 0 : 2)} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    CLOSED: 'bg-muted text-muted-foreground border border-border',
    AWARDED: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    CANCELLED: 'bg-red-500/15 text-red-400 border border-red-500/20',
    CORRIGENDUM: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status] || 'bg-muted text-foreground/80'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'ACTIVE'
            ? 'bg-emerald-400'
            : status === 'AWARDED'
            ? 'bg-blue-400'
            : status === 'CANCELLED'
            ? 'bg-red-400'
            : status === 'CORRIGENDUM'
            ? 'bg-amber-400'
            : 'bg-gray-400'
        }`}
      />
      {status ? status.charAt(0) + status.slice(1).toLowerCase() : 'Unknown'}
    </span>
  );
}

function portalBadge(portal: string) {
  const p = (portal || '').toLowerCase();
  let color = 'bg-muted text-foreground/80 border-border';
  if (p.includes('gem')) color = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  else if (p.includes('cppp')) color = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  else if (p.includes('procure') || p.includes('gujarat')) color = 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  else if (p.includes('maha')) color = 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  else if (p.includes('rajasthan')) color = 'bg-pink-500/15 text-pink-400 border-pink-500/30';
  else if (p.includes('karnataka')) color = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  else if (p.includes('tamil') || p.includes('tn')) color = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  else if (p.includes('up') || p.includes('uttar')) color = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
  else if (p.includes('bengal')) color = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  else if (p.includes('kerala')) color = 'bg-lime-500/15 text-lime-400 border-lime-500/30';
  else if (p.includes('mp') || p.includes('madhya')) color = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  else if (p.includes('delhi')) color = 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  else if (p.includes('ireps')) color = 'bg-sky-500/15 text-sky-400 border-sky-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {portal || 'Government Portal'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TendersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [viewingTenderId, setViewingTenderId] = useState<string | null>(null);
  const [fullTenderDetail, setFullTenderDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetTender, setDeleteTargetTender] = useState<{ id: string; title: string } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({
    show: false,
    type: 'success',
    message: '',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, type, message });
  };

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch real tender statistics from PostgreSQL
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useFetch(getTenderStats);

  // Fetch live paginated tenders from PostgreSQL
  const {
    data: tenderData,
    isLoading,
    error,
    refetch,
  } = useFetch(
    () =>
      getTenderList({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sourcePortal: portalFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        state: stateFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    [page, debouncedSearch, portalFilter, categoryFilter, statusFilter, stateFilter],
  );

  const tenders = tenderData?.tenders || [];
  const totalTenders = tenderData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalTenders / PAGE_SIZE));

  // Dynamically build filter dropdown options from authoritative database stats
  const portalOptions = useMemo(() => {
    const list =
      stats?.byPortal?.map((p: any) => {
        const name = p.sourcePortal || p.portal || 'Unknown';
        return {
          label: `${name} (${p.count})`,
          value: name,
        };
      }) || [];
    return [{ label: 'All Portals', value: '' }, ...list];
  }, [stats]);

  const categoryOptions = useMemo(() => {
    const list = stats?.byCategory?.map((c) => ({
      label: `${c.category.charAt(0) + c.category.slice(1).toLowerCase()} (${c.count})`,
      value: c.category,
    })) || [];
    return [{ label: 'All Categories', value: '' }, ...list];
  }, [stats]);

  const statusOptions = useMemo(() => {
    const list = stats?.byStatus?.map((s) => ({
      label: `${s.status.charAt(0) + s.status.slice(1).toLowerCase()} (${s.count})`,
      value: s.status,
    })) || [];
    return [{ label: 'All Statuses', value: '' }, ...list];
  }, [stats]);

  const stateOptions = useMemo(() => {
    const list = stats?.byState?.map((st) => ({
      label: `${st.state} (${st.count})`,
      value: st.state,
    })) || [];
    return [{ label: 'All States', value: '' }, ...list];
  }, [stats]);

  const hasActiveFilters = Boolean(
    searchInput || portalFilter || categoryFilter || statusFilter || stateFilter,
  );

  const resetAllFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setPortalFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setStateFilter('');
    setPage(1);
  };

  // Load detailed tender data when modal opens
  useEffect(() => {
    if (!viewingTenderId) {
      setFullTenderDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getTenderDetail(viewingTenderId)
      .then((detail) => {
        if (!cancelled) {
          setFullTenderDetail(detail);
          setDetailLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load tender detail:', err);
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [viewingTenderId]);

  const confirmDeleteTender = async () => {
    if (!deleteTargetTender) return;
    try {
      setDeletingId(deleteTargetTender.id);
      await deleteTender(deleteTargetTender.id);
      showToast('Tender deleted successfully', 'success');
      await Promise.all([refetch(), refetchStats()]);
      setOpenAction(null);
      setDeleteTargetTender(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete tender', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-500" />
            Tender Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time live database monitoring across all Indian procurement portals.
          </p>
        </div>
        <button
          onClick={() => {
            void refetch();
            void refetchStats();
          }}
          disabled={isLoading || statsLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-muted border border-border text-foreground hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading || statsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total in Database
            </span>
            <FolderOpen className="w-4 h-4 text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats?.total !== undefined ? stats.total.toLocaleString() : totalTenders.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Live active PostgreSQL repository</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Tenders
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {stats?.active !== undefined ? stats.active.toLocaleString() : '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Accepting active bids</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Added This Month
            </span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {stats?.addedThisMonth !== undefined ? stats.addedThisMonth.toLocaleString() : '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Ingested via automated scrapers</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Closed / Archived
            </span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats?.closed !== undefined ? stats.closed.toLocaleString() : '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Expired deadline or awarded</p>
        </div>
      </div>

      {/* Search + Filters Row */}
      <div className="space-y-3">
        <div className="flex flex-col xl:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, ref #, organization, department, or state..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="flex gap-2.5 flex-wrap">
            {/* Portal dropdown */}
            <select
              value={portalFilter}
              onChange={(e) => {
                setPortalFilter(e.target.value);
                setPage(1);
              }}
              className="bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all cursor-pointer"
            >
              {portalOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Category dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all cursor-pointer"
            >
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all cursor-pointer"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* State dropdown */}
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all cursor-pointer"
            >
              {stateOptions.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>

            {/* Reset filters button */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Filter className="w-3 h-3" /> Active Filters:
            </span>
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-500/10 border border-primary-500/20 text-primary-400">
                Search: &quot;{debouncedSearch}&quot;
                <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => setSearchInput('')} />
              </span>
            )}
            {portalFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                Portal: {portalFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => setPortalFilter('')} />
              </span>
            )}
            {categoryFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400">
                Category: {categoryFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => setCategoryFilter('')} />
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                Status: {statusFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => setStatusFilter('')} />
              </span>
            )}
            {stateFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
                State: {stateFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-foreground" onClick={() => setStateFilter('')} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-sm text-muted-foreground">Loading real tenders from PostgreSQL repository...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm font-medium text-foreground">Failed to load tenders</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              onClick={() => void refetch()}
              className="mt-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[280px]">
                    Title & Reference
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Portal
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    State
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                    Est. Value
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Published
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tenders.map((tender) => {
                  const isOverdue =
                    tender.bidSubmissionDeadline &&
                    new Date(tender.bidSubmissionDeadline).getTime() < Date.now();
                  return (
                    <tr
                      key={tender.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-1">
                          <p
                            className="text-sm text-foreground font-medium line-clamp-2 max-w-sm cursor-pointer hover:text-primary-500 transition-colors"
                            onClick={() => setViewingTenderId(tender.id)}
                            title="Click to view full tender details"
                          >
                            {tender.title}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {tender.referenceNumber || tender.id}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[180px] truncate">
                        {tender.organization || tender.department || 'Government of India'}
                      </td>
                      <td className="p-4">{portalBadge(tender.sourcePortal)}</td>
                      <td className="p-4 text-sm text-muted-foreground capitalize">
                        {tender.category ? tender.category.toLowerCase() : '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {tender.state || 'All India'}
                      </td>
                      <td className="p-4">{statusBadge(tender.status)}</td>
                      <td className="p-4 text-sm font-medium text-right whitespace-nowrap">
                        {tender.estimatedValue && tender.estimatedValue > 0 ? (
                          <span className="text-foreground">{formatINR(tender.estimatedValue)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/70 italic">Not Disclosed</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(tender.publishedDate)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            isOverdue && tender.status === 'ACTIVE'
                              ? 'text-red-400 font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatDate(tender.bidSubmissionDeadline)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAction(openAction === tender.id ? null : tender.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="More options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openAction === tender.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenAction(null)}
                              />
                              <div className="absolute right-0 top-8 z-20 w-40 bg-card border border-border rounded-lg shadow-xl py-1 text-left animate-in fade-in-0 zoom-in-95">
                                <button
                                  onClick={() => {
                                    setViewingTenderId(tender.id);
                                    setOpenAction(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary-500" /> View Details
                                </button>
                                {tender.sourceUrl && (
                                  <a
                                    href={tender.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setOpenAction(null)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Source Link
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenAction(null);
                                    setDeleteTargetTender({ id: tender.id, title: tender.title });
                                  }}
                                  disabled={deletingId === tender.id}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-400 hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                  {deletingId === tender.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  Delete Tender
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {tenders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-16 text-center text-muted-foreground">
                      <div className="max-w-sm mx-auto space-y-2">
                        <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">No tenders match your criteria</p>
                        <p className="text-xs text-muted-foreground">
                          Try adjusting your search terms or clearing one or more active filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={resetAllFilters}
                            className="mt-3 px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20 text-xs font-medium hover:bg-primary-500/20 transition-colors"
                          >
                            Clear All Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3.5 border-t border-border gap-3 bg-card">
          <p className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">
              {totalTenders > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">
              {Math.min(page * PAGE_SIZE, totalTenders)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{totalTenders.toLocaleString()}</span> live tenders
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1 || isLoading}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-foreground px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tender Detail Modal */}
      {viewingTenderId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0">
          <div
            className="fixed inset-0"
            onClick={() => setViewingTenderId(null)}
          />
          <div className="relative bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 z-10">
            {detailLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
                <p className="text-sm">Fetching authoritative tender details...</p>
              </div>
            ) : fullTenderDetail ? (
              <>
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {portalBadge(fullTenderDetail.sourcePortal)}
                      {statusBadge(fullTenderDetail.status)}
                      {fullTenderDetail.tenderType && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
                          {fullTenderDetail.tenderType}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mt-2 leading-snug">
                      {fullTenderDetail.title}
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground">
                      Ref #{fullTenderDetail.referenceNumber || fullTenderDetail.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setViewingTenderId(null)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Key Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-primary-500" /> Organization / Authority
                    </span>
                    <p className="font-semibold text-foreground">{fullTenderDetail.organization}</p>
                    {fullTenderDetail.department && (
                      <p className="text-xs text-muted-foreground mt-0.5">{fullTenderDetail.department}</p>
                    )}
                  </div>

                  <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" /> Estimated Value & EMD
                    </span>
                    <p className="font-bold text-foreground text-base">
                      {formatINR(fullTenderDetail.estimatedValue)}
                    </p>
                    {fullTenderDetail.emdAmount ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        EMD: {formatINR(fullTenderDetail.emdAmount)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">EMD: Not Applicable / Exempt</p>
                    )}
                  </div>

                  <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-blue-400" /> Location & Classification
                    </span>
                    <p className="font-medium text-foreground">
                      {fullTenderDetail.state || 'All India'}
                      {fullTenderDetail.district ? `, ${fullTenderDetail.district}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Category: {fullTenderDetail.category || 'General'}
                    </p>
                  </div>

                  <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" /> Timeline & Deadlines
                    </span>
                    <p className="text-xs text-foreground">
                      Published: <span className="font-medium">{formatDate(fullTenderDetail.publishedDate)}</span>
                    </p>
                    <p className="text-xs text-foreground mt-1">
                      Deadline:{' '}
                      <span className="font-semibold text-amber-400">
                        {formatDate(fullTenderDetail.bidSubmissionDeadline)}
                      </span>
                    </p>
                    {fullTenderDetail.bidOpeningDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Opening: {formatDate(fullTenderDetail.bidOpeningDate)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Description / Scope */}
                {fullTenderDetail.description && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Scope of Work / Description
                    </h4>
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {fullTenderDetail.description}
                    </div>
                  </div>
                )}

                {/* AI Summary if available */}
                {fullTenderDetail.aiSummary && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-primary-400 mb-1">
                      <Sparkles className="w-3.5 h-3.5" /> AI Summary & Insights
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{fullTenderDetail.aiSummary}</p>
                  </div>
                )}

                {/* Documents List */}
                {fullTenderDetail.documents && fullTenderDetail.documents.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Official Tender Documents ({fullTenderDetail.documents.length})
                    </h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {fullTenderDetail.documents.map((doc: any, i: number) => (
                        <div
                          key={doc.id || i}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs"
                        >
                          <span className="font-medium text-foreground truncate max-w-md">{doc.name}</span>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary-500 hover:text-primary-400 font-medium shrink-0 ml-2"
                          >
                            <ExternalLink className="w-3 h-3" /> View Document
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Source: <span className="font-medium text-foreground">{fullTenderDetail.sourcePortal}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {fullTenderDetail.sourceUrl && (
                      <a
                        href={fullTenderDetail.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open Portal Tender
                      </a>
                    )}
                    <button
                      onClick={() => setViewingTenderId(null)}
                      className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <AlertCircle className="w-7 h-7 mx-auto text-red-400" />
                <p className="text-sm font-medium">Could not load tender details.</p>
                <button
                  onClick={() => setViewingTenderId(null)}
                  className="px-4 py-1.5 bg-muted rounded-lg text-xs hover:bg-muted/80 text-foreground"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern Tender Deletion Alert Modal */}
      <ConfirmModal
        isOpen={deleteTargetTender !== null}
        onClose={() => !deletingId && setDeleteTargetTender(null)}
        onConfirm={confirmDeleteTender}
        title="Delete Tender"
        itemName={deleteTargetTender?.title}
        message="Are you sure you want to delete this tender? This action cannot be undone and will permanently remove this tender from the database."
        confirmText="Delete Tender"
        variant="danger"
        isLoading={Boolean(deletingId)}
      />

      {/* Modern Toast Alert */}
      <ToastAlert
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
}
