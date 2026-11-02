'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Trophy, MapPin, Calendar, ChevronLeft, ChevronRight, X, Filter, Loader2, RefreshCw, Play, Pause } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─── Value & date formatters ─── */
function formatValue(value?: number | null): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `\u20B9${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `\u20B9${(value / 100000).toFixed(2)} L`;
  return `\u20B9${value.toLocaleString('en-IN')}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Filter options ─── */
const CATEGORIES = ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'];
const STATES = [
  'Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Delhi',
  'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal', 'Telangana',
];

/* ─── Types matching API response ─── */
interface ApiResult {
  id: string;
  tenderId: string;
  winnerName: string;
  winnerCompany: string;
  awardedValue: number;
  awardedDate: string;
  createdAt: string;
  tender: {
    id: string;
    title: string;
    organization: string;
    category: string;
    state: string;
    referenceNumber: string;
  };
}

interface TenderResult {
  id: string;
  tenderTitle: string;
  organization: string;
  state: string;
  category: string;
  winnerName: string;
  winnerCompany: string;
  awardedValue: number;
  awardedDate: string;
  referenceNumber: string;
}

/** Map an API result to the flat shape the UI expects */
function mapApiResult(r: ApiResult): TenderResult {
  return {
    id: r.id,
    tenderTitle: r.tender.title,
    organization: r.tender.organization,
    state: r.tender.state,
    category: r.tender.category,
    winnerName: r.winnerName,
    winnerCompany: r.winnerCompany,
    awardedValue: r.awardedValue,
    awardedDate: r.awardedDate,
    referenceNumber: r.tender.referenceNumber,
  };
}

const RESULTS_PER_PAGE = 20;

export default function ResultsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedWinner, setExpandedWinner] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  /* ─── API state ─── */
  const [results, setResults] = useState<TenderResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  /* ─── Real-time Auto-refresh State ─── */
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [timeAgoText, setTimeAgoText] = useState('just now');
  const [newResultIds, setNewResultIds] = useState<Set<string>>(new Set());
  const resultsRef = useRef<TenderResult[]>([]);
  resultsRef.current = results;

  /* Debounce timer for search input */
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ─── Fetch results from API ─── */
  const fetchResults = useCallback(
    async (
      params: {
        page: number;
        search: string;
        category: string;
        state: string;
      },
      isBackground = false
    ) => {
      if (!isBackground) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsRefreshing(true);
      }

      try {
        const queryParams: Record<string, string | number> = {
          page: params.page,
          limit: RESULTS_PER_PAGE,
          sortBy: 'awardedDate',
          sortOrder: 'desc',
        };
        if (params.search) {
          queryParams.query = params.search;
          queryParams.search = params.search;
        }
        if (params.category) queryParams.category = params.category;
        if (params.state) queryParams.state = params.state;

        const res = await api.get('/results', { params: queryParams });
        const data = res.data;

        if (data.success) {
          const mapped = (data.data as ApiResult[]).map(mapApiResult);

          // Detect new items during background poll
          if (isBackground && resultsRef.current.length > 0) {
            const currentIds = new Set(resultsRef.current.map((r) => r.id));
            const fresh = mapped.filter((r) => !currentIds.has(r.id)).map((r) => r.id);
            if (fresh.length > 0) {
              setNewResultIds(new Set(fresh));
              setTimeout(() => setNewResultIds(new Set()), 4000);
            }
          }

          setResults(mapped);
          setTotal(data.meta?.total ?? mapped.length);
          setLastRefreshedAt(new Date());
        } else if (!isBackground) {
          setError(data.error?.message || 'Failed to fetch results');
          setResults([]);
        }
      } catch (err: any) {
        if (!isBackground) {
          setError(err.response?.data?.error?.message || 'Failed to fetch results');
          setResults([]);
        }
      } finally {
        if (!isBackground) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  /* Trigger fetch when filters or page change */
  useEffect(() => {
    fetchResults({ page, search: searchQuery, category: categoryFilter, state: stateFilter });
  }, [page, categoryFilter, stateFilter, fetchResults]);

  /* Real-time automatic polling effect */
  useEffect(() => {
    if (!isAutoRefresh) return;

    // Poll every 8 seconds for new tender results
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchResults(
        { page, search: searchQuery, category: categoryFilter, state: stateFilter },
        true // background poll
      );
    }, 8000);

    // Immediately poll when the tab gains focus or visibility returns
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden && isAutoRefresh) {
        fetchResults(
          { page, search: searchQuery, category: categoryFilter, state: stateFilter },
          true
        );
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAutoRefresh, page, searchQuery, categoryFilter, stateFilter, fetchResults]);

  /* Relative time ticker */
  useEffect(() => {
    const timer = setInterval(() => {
      const diffSec = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
      if (diffSec < 5) {
        setTimeAgoText('just now');
      } else if (diffSec < 60) {
        setTimeAgoText(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgoText(`${diffMin}m ago`);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  /* Debounced search — resets page to 1 */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchResults({ page: 1, search: value, category: categoryFilter, state: stateFilter });
    }, 400);
  };

  /* Client-side date filtering (applied on top of API results) */
  const filteredResults = results.filter((r) => {
    if (dateFrom && r.awardedDate < dateFrom) return false;
    if (dateTo && r.awardedDate > dateTo) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));

  const hasActiveFilters = categoryFilter || stateFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setCategoryFilter('');
    setStateFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleStateChange = (value: string) => {
    setStateFilter(value);
    setPage(1);
  };

  const toggleWinner = (companyName: string) => {
    setExpandedWinner(expandedWinner === companyName ? null : companyName);
  };

  // Get results by winner company for the profile expansion (from current page data)
  const getWinnerResults = (companyName: string) => {
    return results.filter((r) => r.winnerCompany === companyName);
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
            <Trophy className="h-6 w-6 text-primary-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tender Results</h1>
            <p className="text-sm text-muted-foreground">Track who won government tenders across India</p>
          </div>
        </div>

        {/* Real-time status badge & controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Live pulsing badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs">
            <span className="relative flex h-2 w-2">
              {isAutoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  isAutoRefresh ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                )}
              />
            </span>
            <span className="font-medium text-foreground">
              {isAutoRefresh ? 'Live' : 'Paused'}
            </span>
            <span className="text-muted-foreground text-[11px] hidden sm:inline">
              • {isRefreshing ? 'Checking...' : `Updated ${timeAgoText}`}
            </span>
          </div>

          {/* Toggle Auto-Refresh */}
          <button
            onClick={() => setIsAutoRefresh((prev) => !prev)}
            title={isAutoRefresh ? 'Pause real-time auto-refresh' : 'Resume real-time auto-refresh'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
              isAutoRefresh
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/40'
                : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
            )}
          >
            {isAutoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isAutoRefresh ? 'Auto-refresh' : 'Resume'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() =>
              fetchResults(
                { page, search: searchQuery, category: categoryFilter, state: stateFilter },
                true
              )
            }
            disabled={isRefreshing}
            title="Refresh now"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin text-primary-500')} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by organization, company, state, or tender title..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="h-2 w-2 bg-primary-500 rounded-full" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : `${total} result${total !== 1 ? 's' : ''} found`}
        </span>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-card border border-border rounded-xl">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">State</label>
            <select
              value={stateFilter}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All States</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
        {/* Table header */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">Tender</div>
          <div className="col-span-2">Winner</div>
          <div className="col-span-2 text-right">Awarded Value</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Organization</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
            <span className="ml-3 text-sm text-muted-foreground">Loading results...</span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="text-center py-16">
            <Trophy className="h-12 w-12 text-red-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground mb-1">Failed to load results</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchResults({ page, search: searchQuery, category: categoryFilter, state: stateFilter })}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results rows */}
        {!isLoading && !error && filteredResults.length > 0 && (
          filteredResults.map((result) => (
            <div key={result.id}>
              {/* Desktop row */}
              <div
                className={cn(
                  'hidden md:grid md:grid-cols-12 gap-4 px-4 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-all duration-500 items-center',
                  newResultIds.has(result.id) && 'bg-emerald-500/10 dark:bg-emerald-950/20 ring-1 ring-inset ring-emerald-500/30'
                )}
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{result.tenderTitle}</p>
                    {newResultIds.has(result.id) && (
                      <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{result.referenceNumber}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{result.category}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => toggleWinner(result.winnerCompany)}
                    className="text-left hover:text-primary-500 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{result.winnerCompany}</p>
                    <p className="text-xs text-muted-foreground">{result.winnerName}</p>
                  </button>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-semibold text-foreground">{formatValue(result.awardedValue)}</p>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(result.awardedDate)}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground line-clamp-1">{result.organization}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {result.state}
                  </div>
                </div>
              </div>

              {/* Mobile card */}
              <div
                className={cn(
                  'md:hidden p-4 border-b border-border last:border-0 transition-all duration-500',
                  newResultIds.has(result.id) && 'bg-emerald-500/10 dark:bg-emerald-950/20'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{result.tenderTitle}</p>
                  {newResultIds.has(result.id) && (
                    <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{result.organization}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleWinner(result.winnerCompany)}
                    className="text-left"
                  >
                    <p className="text-sm font-medium text-primary-500">{result.winnerCompany}</p>
                  </button>
                  <p className="text-sm font-semibold">{formatValue(result.awardedValue)}</p>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.state}</span>
                  <span>{formatDate(result.awardedDate)}</span>
                </div>
              </div>

              {/* Expanded winner profile */}
              {expandedWinner === result.winnerCompany && (
                <div className="px-4 py-4 bg-primary-50/50 dark:bg-primary-950/10 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary-500" />
                      {result.winnerCompany} — Winner Profile
                    </h4>
                    <button
                      onClick={() => setExpandedWinner(null)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    {(() => {
                      const wins = getWinnerResults(result.winnerCompany);
                      const totalVal = wins.reduce((s, w) => s + w.awardedValue, 0);
                      const statesWon = [...new Set(wins.map((w) => w.state))];
                      return (
                        <>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Total Wins (this page)</p>
                            <p className="text-lg font-bold text-foreground">{wins.length}</p>
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Total Awarded Value</p>
                            <p className="text-lg font-bold text-foreground">{formatValue(totalVal)}</p>
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">States</p>
                            <p className="text-sm font-medium text-foreground">{statesWon.join(', ')}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Wins</p>
                    {getWinnerResults(result.winnerCompany).slice(0, 3).map((w) => (
                      <div key={w.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-2.5 text-sm">
                        <span className="text-foreground line-clamp-1 flex-1 mr-2">{w.tenderTitle}</span>
                        <span className="font-medium text-foreground whitespace-nowrap">{formatValue(w.awardedValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredResults.length === 0 && (
          <div className="text-center py-16">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground mb-1">No results found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
