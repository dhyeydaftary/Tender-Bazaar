'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTenderSearch } from '@/lib/hooks/use-tenders';
import {
  Search,
  MapPin,
  Clock,
  IndianRupee,
  Lock,
  ArrowRight,
  Wrench,
  Package,
  Settings,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TenderCategory = 'Works' | 'Goods' | 'Services' | 'Consultancy';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: ('All' | TenderCategory)[] = [
  'All',
  'Works',
  'Goods',
  'Services',
  'Consultancy',
];

const STATES = [
  'Gujarat',
  'Maharashtra',
  'Rajasthan',
  'Delhi',
  'Karnataka',
  'Tamil Nadu',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Kerala',
  'West Bengal',
  'Telangana',
  'Andhra Pradesh',
  'Bihar',
  'Odisha',
  'Punjab',
  'Haryana',
  'Jharkhand',
  'Chhattisgarh',
  'Assam',
  'Goa',
];

const VALUE_RANGES = [
  'Under ₹10L',
  '₹10L-₹1Cr',
  '₹1Cr-₹10Cr',
  '₹10Cr-₹100Cr',
  '₹100Cr+',
];

const SORT_OPTIONS = ['Latest', 'Deadline Soon', 'Value High→Low'];

const CATEGORY_COLORS: Record<TenderCategory, { badge: string; border: string }> = {
  Works: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-l-red-500' },
  Goods: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-l-blue-500' },
  Services: { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', border: 'border-l-teal-500' },
  Consultancy: { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', border: 'border-l-purple-500' },
};

// ─── Sort Mapping ───────────────────────────────────────────────────────────

const SORT_MAP: Record<string, { sortBy: string; sortOrder: string }> = {
  Latest: { sortBy: 'publishedDate', sortOrder: 'desc' },
  'Deadline Soon': { sortBy: 'bidSubmissionDeadline', sortOrder: 'asc' },
  'Value High→Low': { sortBy: 'estimatedValue', sortOrder: 'desc' },
};

const VALUE_RANGE_MAP: Record<string, { minValue?: number; maxValue?: number }> = {
  'Under ₹10L': { maxValue: 10_00_000 },
  '₹10L-₹1Cr': { minValue: 10_00_000, maxValue: 1_00_00_000 },
  '₹1Cr-₹10Cr': { minValue: 1_00_00_000, maxValue: 10_00_00_000 },
  '₹10Cr-₹100Cr': { minValue: 10_00_00_000, maxValue: 100_00_00_000 },
  '₹100Cr+': { minValue: 100_00_00_000 },
};

const ITEMS_PER_PAGE = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: number): string {
  if (value >= 1_00_00_000) {
    const crores = value / 1_00_00_000;
    return `₹${crores % 1 === 0 ? crores.toFixed(0) : crores.toFixed(1)} Cr`;
  }
  if (value >= 1_00_000) {
    const lakhs = value / 1_00_000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
}

function getDaysLeft(deadline: string): number {
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDeadlineColor(daysLeft: number): string {
  if (daysLeft < 7) return 'text-red-600 dark:text-red-400';
  if (daysLeft < 14) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TendersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | TenderCategory>('All');
  const [selectedState, setSelectedState] = useState('');
  const [selectedValueRange, setSelectedValueRange] = useState('');
  const [selectedSort, setSelectedSort] = useState('Latest');
  const [showPaywall, setShowPaywall] = useState(false);

  const { result, isLoading, error, updateFilters, filters, search, setFilters } =
    useTenderSearch({
      limit: ITEMS_PER_PAGE,
      page: 1,
      sortBy: 'publishedDate',
      sortOrder: 'desc',
    });

  const tenders = result?.tenders ?? [];
  const totalResults = result?.total ?? 0;
  const currentPage = filters.page || 1;
  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  // ─── Filter handlers ─────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    updateFilters({ query: searchQuery || undefined });
  }, [searchQuery, updateFilters]);

  const handleCategoryChange = useCallback(
    (cat: 'All' | TenderCategory) => {
      setActiveCategory(cat);
      updateFilters({
        // The API filters on Elasticsearch's `category` keyword field, which holds
        // the Prisma TenderCategory enum values (WORKS / GOODS / SERVICES /
        // CONSULTANCY). Keyword matching is exact and case-sensitive, so sending
        // the display label ('Works') matched nothing and every category filter
        // returned 0 results. Same conversion as the dashboard tender and search
        // pages already do.
        categories: cat === 'All' ? undefined : [cat.toUpperCase()],
      });
    },
    [updateFilters]
  );

  const handleStateChange = useCallback(
    (state: string) => {
      setSelectedState(state);
      updateFilters({
        states: state ? [state] : undefined,
      });
    },
    [updateFilters]
  );

  const handleValueRangeChange = useCallback(
    (range: string) => {
      setSelectedValueRange(range);
      const mapped = range ? VALUE_RANGE_MAP[range] : {};
      updateFilters({
        minValue: mapped?.minValue,
        maxValue: mapped?.maxValue,
      });
    },
    [updateFilters]
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      setSelectedSort(sort);
      const mapped = SORT_MAP[sort] || SORT_MAP['Latest'];
      updateFilters(mapped);
    },
    [updateFilters]
  );

  const goToPage = useCallback(
    (page: number) => {
      const updated = { ...filters, page };
      setFilters(updated);
      search(updated);
    },
    [filters, setFilters, search]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero / Header ─────────────────────────────────────────────── */}
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Government Tenders Across India
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Browse 50,000+ active tenders from GeM, CPPP, and 28 state portals
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tenders by keyword, organization, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50 focus:border-[#FF6B35]"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-medium rounded-lg transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* ─── Category Tabs ─────────────────────────────────────────────── */}
      <section className="px-4 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative',
                  activeCategory === cat
                    ? 'text-[#FF6B35]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {cat}
                {activeCategory === cat && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35] rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Filter Bar ────────────────────────────────────────────────── */}
      <section className="px-4 py-4 bg-muted/50 border-b border-border">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          {/* State */}
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50"
          >
            <option value="">All States</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Value Range */}
          <select
            value={selectedValueRange}
            onChange={(e) => handleValueRangeChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50"
          >
            <option value="">Value Range</option>
            {VALUE_RANGES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={selectedSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Results count */}
          <span className="ml-auto text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `Showing ${tenders.length} of ${totalResults} tenders`}
          </span>
        </div>
      </section>

      {/* ─── Tender Cards List ─────────────────────────────────────────── */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-lg p-5 border-l-4 border-l-muted animate-pulse"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-16 bg-muted rounded-full" />
                        <div className="h-4 w-24 bg-muted rounded" />
                      </div>
                      <div className="h-5 w-3/4 bg-muted rounded" />
                      <div className="h-4 w-1/2 bg-muted rounded" />
                      <div className="h-6 w-32 bg-muted rounded-full" />
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="h-6 w-20 bg-muted rounded" />
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 text-lg font-medium mb-2">
                Something went wrong
              </p>
              <p className="text-muted-foreground mb-4">{error}</p>
              <button
                onClick={() => updateFilters({})}
                className="px-5 py-2 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Tender Cards */}
          {!isLoading &&
            !error &&
            tenders.map((tender) => {
              const daysLeft = getDaysLeft(tender.bidSubmissionDeadline);
              const category = tender.category as TenderCategory;
              const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Services'];

              return (
                <div
                  key={tender.id}
                  className={cn(
                    'bg-card border border-border rounded-lg p-5 shadow-card hover-lift transition-all border-l-4',
                    colors.border
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            colors.badge
                          )}
                        >
                          {tender.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tender.referenceNumber}
                        </span>
                      </div>

                      <h3 className="font-semibold text-foreground text-base mb-1 line-clamp-2">
                        {tender.title}
                      </h3>

                      <p className="text-sm text-muted-foreground mb-3">
                        {tender.organization}
                      </p>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {tender.state}
                          {tender.district ? `, ${tender.district}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Right content */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {tender.estimatedValue != null && (
                        <div className="flex items-center gap-1 text-lg font-bold text-foreground">
                          <IndianRupee className="h-4 w-4" />
                          <span>
                            {formatValue(tender.estimatedValue).replace('₹', '')}
                          </span>
                        </div>
                      )}

                      <div
                        className={cn(
                          'flex items-center gap-1 text-sm font-medium',
                          getDeadlineColor(daysLeft)
                        )}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                        </span>
                      </div>

                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1 text-sm font-medium text-[#FF6B35] hover:text-[#FF6B35]/80 transition-colors mt-1"
                      >
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Empty State */}
          {!isLoading && !error && tenders.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                No tenders found matching your criteria.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <section className="px-4 pb-8">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              className={cn(
                'p-2 rounded-lg border border-border text-muted-foreground transition-colors',
                currentPage <= 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-muted'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={cn(
                    'w-10 h-10 rounded-lg font-medium text-sm transition-colors',
                    page === currentPage
                      ? 'bg-[#FF6B35] text-white'
                      : 'border border-border text-muted-foreground hover:bg-muted',
                    page > 5 && 'hidden md:flex md:items-center md:justify-center'
                  )}
                >
                  {page}
                </button>
              )
            )}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
              className={cn(
                'p-2 rounded-lg border border-border text-muted-foreground transition-colors',
                currentPage >= totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-muted'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ─── Paywall Modal ─────────────────────────────────────────────── */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPaywall(false)}
          />

          {/* Modal */}
          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <button
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#FF6B35]/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-[#FF6B35]" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">
                Unlock all results
              </h3>

              <p className="text-muted-foreground mb-6">
                Subscribe to access all tender listings, advanced filters, and
                document downloads. Plans start at ₹1,499/mo.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/pricing"
                  className="flex-1 px-5 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors text-center"
                >
                  View Plans
                </Link>
                <Link
                  href="/register"
                  className="flex-1 px-5 py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white rounded-lg font-medium transition-colors text-center"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Browse by Category ────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
            Browse by Category
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Works */}
            <Link
              href="/explore-tenders/category/works"
              className="bg-card border border-border rounded-xl p-6 shadow-card hover-lift transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wrench className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Works Tenders</h3>
              <p className="text-sm text-muted-foreground">18,420 active tenders</p>
            </Link>

            {/* Goods */}
            <Link
              href="/explore-tenders/category/goods"
              className="bg-card border border-border rounded-xl p-6 shadow-card hover-lift transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Goods Tenders</h3>
              <p className="text-sm text-muted-foreground">12,850 active tenders</p>
            </Link>

            {/* Services */}
            <Link
              href="/explore-tenders/category/services"
              className="bg-card border border-border rounded-xl p-6 shadow-card hover-lift transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Services Tenders</h3>
              <p className="text-sm text-muted-foreground">11,340 active tenders</p>
            </Link>

            {/* Consultancy */}
            <Link
              href="/explore-tenders/category/consultancy"
              className="bg-card border border-border rounded-xl p-6 shadow-card hover-lift transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Consultancy</h3>
              <p className="text-sm text-muted-foreground">8,190 active tenders</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ────────────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-[#1B2845] to-[#1B2845]/90 rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Find tenders tailored to your business
            </h2>
            <p className="text-white/70 mb-6 max-w-xl mx-auto">
              Get AI-powered recommendations, eligibility checks, and instant
              alerts for tenders that match your company profile.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold rounded-lg transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
