'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Award,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  IndianRupee,
  Loader2,
  Lock,
  MapPin,
  TrendingUp,
  Trophy,
  BarChart3,
  ArrowRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { ALL_STATES_AND_UTS } from '@tenderbazaar/shared';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Category = 'All' | 'Works' | 'Goods' | 'Services' | 'Consultancy';
type DateRange = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'This year';

interface TenderResult {
  id: string;
  tenderId: string;
  winnerName: string;
  winnerCompany: string | null;
  awardedValue: number | null;
  awardedDate: string | null;
  tender: {
    id: string;
    title: string;
    organization: string;
    state: string;
    category: string;
    referenceNumber: string;
  };
}

interface ResultsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const STATES: string[] = ['All States', ...ALL_STATES_AND_UTS];
const CATEGORIES: Category[] = ['All', 'Works', 'Goods', 'Services', 'Consultancy'];
const DATE_RANGES: DateRange[] = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year'];

const TOP_ORGANIZATIONS = [
  { name: 'National Highways Authority of India', count: 1245 },
  { name: 'Indian Railways', count: 1089 },
  { name: 'Ministry of Defence', count: 876 },
  { name: 'CPWD', count: 734 },
  { name: 'State PWDs (Combined)', count: 2156 },
];

const CATEGORY_DISTRIBUTION = [
  { category: 'Works', percentage: 42, value: '₹1.76L Cr' },
  { category: 'Goods', percentage: 28, value: '₹1.18L Cr' },
  { category: 'Services', percentage: 19, value: '₹79,800 Cr' },
  { category: 'Consultancy', percentage: 11, value: '₹46,200 Cr' },
];

const AVG_AWARD_VALUES = [
  { category: 'Works', value: '₹14.2 Cr' },
  { category: 'Goods', value: '₹8.7 Cr' },
  { category: 'Services', value: '₹5.3 Cr' },
  { category: 'Consultancy', value: '₹3.1 Cr' },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatContractValue(value: number): string {
  if (value >= 10000000000) return `₹${(value / 10000000000).toFixed(1)} K Cr`;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function getCategoryStyles(category: string) {
  switch (category) {
    case 'Works':
      return 'bg-[#E8593C]/10 text-[#E8593C]';
    case 'Goods':
      return 'bg-[#2563EB]/10 text-[#2563EB]';
    case 'Services':
      return 'bg-[#0D9488]/10 text-[#0D9488]';
    case 'Consultancy':
      return 'bg-[#7C3AED]/10 text-[#7C3AED]';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ value, label, icon: Icon }: { value: string; label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-4 shadow-card text-center">
      <Icon className="h-5 w-5 text-primary-500 mb-1" />
      <span className="text-xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ResultCard({ result, blurred }: { result: TenderResult; blurred: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-lg',
        blurred && 'content-blurred select-none pointer-events-none'
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 flex-1">
            {result.tender.title}
          </h3>
          <span
            className="shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          >
            Awarded
          </span>
        </div>

        {/* Organization */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{result.tender.organization}</span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', getCategoryStyles(result.tender.category))}>
            {result.tender.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {result.tender.state}
          </span>
          {result.awardedDate && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(result.awardedDate)}
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <IndianRupee className="h-3.5 w-3.5 text-primary-500" />
            <span className="text-sm font-bold text-foreground">
              {result.awardedValue ? formatContractValue(result.awardedValue) : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-accent-500" />
            <span className="text-xs font-medium text-foreground">{result.winnerCompany || result.winnerName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

function getDateFromRange(range: DateRange): string | undefined {
  const now = new Date();
  switch (range) {
    case 'Last 7 days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    }
    case 'Last 30 days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    }
    case 'Last 90 days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d.toISOString().split('T')[0];
    }
    case 'This year': {
      return `${now.getFullYear()}-01-01`;
    }
  }
}

export default function TenderResultsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('Last 30 days');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [results, setResults] = useState<TenderResult[]>([]);
  const [meta, setMeta] = useState<ResultsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: 20,
      };
      if (activeCategory !== 'All') params.category = activeCategory;
      if (selectedState !== 'All States') params.state = selectedState;
      const dateFrom = getDateFromRange(selectedDateRange);
      if (dateFrom) params.dateFrom = dateFrom;

      const res = await api.get('/results', { params });
      setResults(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch tender results');
      setResults([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, selectedState, selectedDateRange]);

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchResults(1);
  }, [activeCategory, selectedState, selectedDateRange, fetchResults]);

  // Re-fetch when page changes (but not when filters change — that resets page above)
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchResults(newPage);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* ============================================================ */}
      {/* Hero Section                                                  */}
      {/* ============================================================ */}
      <section className="pt-28 pb-8 px-4">
        <div className="mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-500 mb-4">
            <Award className="h-3.5 w-3.5" />
            Tender Results
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            Government Tender Results & Awards
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Track tender outcomes, winning bids, and contract awards across India
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Stats Bar                                                     */}
      {/* ============================================================ */}
      <section className="px-4 pb-8">
        <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value="32,500+" label="Results Published" icon={Award} />
          <StatCard value="₹4.2L Cr" label="Total Value Awarded" icon={IndianRupee} />
          <StatCard value="28" label="States Covered" icon={MapPin} />
          <StatCard value="Daily" label="Updated" icon={Clock} />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Filter Bar                                                    */}
      {/* ============================================================ */}
      <section className="px-4 pb-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-4">
            {/* Category tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    activeCategory === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Dropdowns row */}
            <div className="flex flex-wrap gap-3">
              {/* State dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowStateDropdown(!showStateDropdown); setShowDateDropdown(false); }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {selectedState}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {showStateDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
                    {STATES.map((state) => (
                      <button
                        key={state}
                        onClick={() => { setSelectedState(state); setShowStateDropdown(false); }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                          selectedState === state ? 'bg-primary-500/10 text-primary-500 font-medium' : 'text-foreground'
                        )}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date range dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowDateDropdown(!showDateDropdown); setShowStateDropdown(false); }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {selectedDateRange}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {showDateDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-lg">
                    {DATE_RANGES.map((range) => (
                      <button
                        key={range}
                        onClick={() => { setSelectedDateRange(range); setShowDateDropdown(false); }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                          selectedDateRange === range ? 'bg-primary-500/10 text-primary-500 font-medium' : 'text-foreground'
                        )}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Results Grid                                                  */}
      {/* ============================================================ */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-5xl">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <p className="text-sm text-muted-foreground">Loading tender results...</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button
                onClick={() => fetchResults(page)}
                className="mt-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Award className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No tender results found for the selected filters.</p>
            </div>
          )}

          {/* Results */}
          {!isLoading && !error && results.length > 0 && (
            <>
              <div className="relative">
                <div className="grid gap-4 sm:grid-cols-2">
                  {results.map((result, idx) => (
                    <ResultCard key={result.id} result={result} blurred={idx >= 5} />
                  ))}
                </div>

                {/* Blur overlay CTA */}
                {results.length > 5 && (
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-8 pt-32 bg-gradient-to-t from-background via-background/95 to-transparent">
                    <div className="rounded-2xl border border-border bg-card p-8 shadow-card text-center max-w-md">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
                        <Lock className="h-6 w-6 text-primary-500" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Unlock Full Results Access</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Subscribe to view all tender results, winner details, and download award letters.
                      </p>
                      <Link
                        href="/pricing"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500/90 transition-colors"
                      >
                        View Plans
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors',
                      page <= 1
                        ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= meta.totalPages}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors',
                      page >= meta.totalPages
                        ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* Insights Section                                              */}
      {/* ============================================================ */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Tender Market Insights
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Top Awarding Organizations */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary-500" />
                <h3 className="text-sm font-semibold text-foreground">Top Awarding Organizations</h3>
              </div>
              <ul className="space-y-3">
                {TOP_ORGANIZATIONS.map((org, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate pr-2">{org.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-foreground bg-muted rounded-md px-2 py-0.5">
                      {org.count.toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trending Categories */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary-500" />
                <h3 className="text-sm font-semibold text-foreground">Trending Categories</h3>
              </div>
              <div className="space-y-3">
                {CATEGORY_DISTRIBUTION.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{item.category}</span>
                      <span className="text-xs text-muted-foreground">{item.value}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          idx === 0 ? 'bg-[#E8593C]' : idx === 1 ? 'bg-[#2563EB]' : idx === 2 ? 'bg-[#0D9488]' : 'bg-[#7C3AED]'
                        )}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Average Award Values */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary-500" />
                <h3 className="text-sm font-semibold text-foreground">Average Award Values</h3>
              </div>
              <div className="space-y-3">
                {AVG_AWARD_VALUES.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', getCategoryStyles(item.category).split(' ')[0])} />
                      <span className="text-xs font-medium text-foreground">{item.category}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Bottom CTA                                                    */}
      {/* ============================================================ */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-r from-primary-500 to-primary-500/80 p-8 sm:p-12 text-center shadow-card">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Track tender results for your industry
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/80">
            Get notified when new results are published in your sector. Never miss a contract award again.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary-500 hover:bg-white/90 transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
