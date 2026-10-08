'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  X,
  Lock,
  ArrowRight,
  MapPin,
  Building2,
  IndianRupee,
  Clock,
  Bell,
  FileText,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Tender {
  id: string;
  title: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  state: string;
  category: string;
  tenderType: string;
  status: string;
  estimatedValue?: number | null;
  bidSubmissionDeadline: string;
  publishedDate: string;
  description?: string | null;
  aiSummary?: string | null;
  highlight?: {
    title?: string[];
    description?: string[];
  };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const RESULTS_PER_PAGE = 20;

const CATEGORIES = ['Works', 'Goods', 'Services', 'Consultancy'] as const;

const STATES = [
  'Gujarat', 'Maharashtra', 'Rajasthan', 'Delhi', 'Karnataka',
  'Tamil Nadu', 'Uttar Pradesh', 'Madhya Pradesh', 'Kerala',
  'West Bengal', 'Telangana', 'Andhra Pradesh', 'Bihar', 'Odisha',
  'Punjab', 'Haryana', 'Jharkhand', 'Chhattisgarh', 'Assam', 'Goa',
] as const;

const VALUE_RANGES = [
  'Any',
  'Under ₹10 Lakh',
  '₹10L - ₹1 Crore',
  '₹1Cr - ₹10 Crore',
  '₹10Cr - ₹100 Crore',
  'Above ₹100 Crore',
] as const;

const DEADLINES = [
  'Any',
  'Today',
  'This Week',
  'This Month',
  'Next 30 Days',
] as const;

const TENDER_TYPES = [
  'Open Tender',
  'Limited Tender',
  'Single Source',
  'EOI',
  'Auction',
  'Re-tender',
] as const;

const SORT_OPTIONS = [
  'Relevance',
  'Latest',
  'Deadline',
  'Value',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Works: 'bg-[#E8593C]',
  Goods: 'bg-[#2563EB]',
  Services: 'bg-[#0D9488]',
  Consultancy: 'bg-[#7C3AED]',
};

const CATEGORY_TEXT_COLORS: Record<string, string> = {
  Works: 'text-[#E8593C]',
  Goods: 'text-[#2563EB]',
  Services: 'text-[#0D9488]',
  Consultancy: 'text-[#7C3AED]',
};

const CATEGORY_BG_COLORS: Record<string, string> = {
  Works: 'bg-[#E8593C]/10',
  Goods: 'bg-[#2563EB]/10',
  Services: 'bg-[#0D9488]/10',
  Consultancy: 'bg-[#7C3AED]/10',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatValue(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdvancedSearchPage() {
  /* Filter state */
  const [keyword, setKeyword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [showAllStates, setShowAllStates] = useState(false);
  const [selectedValueRange, setSelectedValueRange] = useState('Any');
  const [selectedDeadline, setSelectedDeadline] = useState('Any');
  const [selectedTenderTypes, setSelectedTenderTypes] = useState<string[]>([]);
  const [msmeReserved, setMsmeReserved] = useState(false);
  const [startupIndia, setStartupIndia] = useState(false);
  const [makeInIndia, setMakeInIndia] = useState(false);
  const [womenOwned, setWomenOwned] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  /* Results state */
  const [sortBy, setSortBy] = useState<string>('Relevance');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  /* Mobile filter toggle */
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  /* API data state */
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Value range → minValue/maxValue mapping                           */
  /* ---------------------------------------------------------------- */

  function getValueRangeParams(range: string): { minValue?: number; maxValue?: number } {
    switch (range) {
      case 'Under ₹10 Lakh':
        return { maxValue: 1000000 };
      case '₹10L - ₹1 Crore':
        return { minValue: 1000000, maxValue: 10000000 };
      case '₹1Cr - ₹10 Crore':
        return { minValue: 10000000, maxValue: 100000000 };
      case '₹10Cr - ₹100 Crore':
        return { minValue: 100000000, maxValue: 1000000000 };
      case 'Above ₹100 Crore':
        return { minValue: 1000000000 };
      default:
        return {};
    }
  }

  /* ---------------------------------------------------------------- */
  /* Deadline → date range mapping                                     */
  /* ---------------------------------------------------------------- */

  function getDeadlineParams(deadline: string): { deadlineFrom?: string; deadlineTo?: string } {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (deadline) {
      case 'Today': {
        return { deadlineFrom: todayStr, deadlineTo: todayStr };
      }
      case 'This Week': {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        return { deadlineFrom: todayStr, deadlineTo: endOfWeek.toISOString().split('T')[0] };
      }
      case 'This Month': {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { deadlineFrom: todayStr, deadlineTo: endOfMonth.toISOString().split('T')[0] };
      }
      case 'Next 30 Days': {
        const in30Days = new Date(now);
        in30Days.setDate(now.getDate() + 30);
        return { deadlineFrom: todayStr, deadlineTo: in30Days.toISOString().split('T')[0] };
      }
      default:
        return {};
    }
  }

  /* ---------------------------------------------------------------- */
  /* Sort mapping                                                      */
  /* ---------------------------------------------------------------- */

  function getSortParams(sort: string): { sortBy: string; sortOrder: string } {
    switch (sort) {
      case 'Latest':
        return { sortBy: 'publishedDate', sortOrder: 'desc' };
      case 'Deadline':
        return { sortBy: 'bidSubmissionDeadline', sortOrder: 'asc' };
      case 'Value':
        return { sortBy: 'estimatedValue', sortOrder: 'desc' };
      case 'Relevance':
      default:
        return { sortBy: 'relevance', sortOrder: 'desc' };
    }
  }

  /* ---------------------------------------------------------------- */
  /* Tender type display → API enum mapping                            */
  /* ---------------------------------------------------------------- */

  function mapTenderTypesToApi(types: string[]): string[] {
    const map: Record<string, string> = {
      'Open Tender': 'OPEN',
      'Limited Tender': 'LIMITED',
      'Single Source': 'SINGLE',
      'EOI': 'EOI',
      'Auction': 'AUCTION',
      'Re-tender': 'OPEN',
    };
    return types.map((t) => map[t] || t).filter((v, i, a) => a.indexOf(v) === i);
  }

  /* ---------------------------------------------------------------- */
  /* Category display → API enum mapping                               */
  /* ---------------------------------------------------------------- */

  function mapCategoriesToApi(cats: string[]): string[] {
    const map: Record<string, string> = {
      'Works': 'WORKS',
      'Goods': 'GOODS',
      'Services': 'SERVICES',
      'Consultancy': 'CONSULTANCY',
    };
    return cats.map((c) => map[c] || c);
  }

  /* ---------------------------------------------------------------- */
  /* Fetch tenders from API                                            */
  /* ---------------------------------------------------------------- */

  const fetchTenders = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);

    try {
      const { sortBy: sortField, sortOrder } = getSortParams(sortBy);
      const valueParams = getValueRangeParams(selectedValueRange);
      const deadlineParams = getDeadlineParams(selectedDeadline);

      const params: Record<string, string | number> = {
        page,
        limit: RESULTS_PER_PAGE,
        sortBy: sortField,
        sortOrder,
      };

      if (keyword.trim()) params.query = keyword.trim();
      if (selectedCategories.length > 0) params.categories = mapCategoriesToApi(selectedCategories).join(',');
      if (selectedStates.length > 0) params.states = selectedStates.join(',');
      if (selectedTenderTypes.length > 0) params.tenderTypes = mapTenderTypesToApi(selectedTenderTypes).join(',');
      if (valueParams.minValue) params.minValue = valueParams.minValue;
      if (valueParams.maxValue) params.maxValue = valueParams.maxValue;
      if (deadlineParams.deadlineFrom) params.deadlineFrom = deadlineParams.deadlineFrom;
      if (deadlineParams.deadlineTo) params.deadlineTo = deadlineParams.deadlineTo;

      const response = await api.get('/tenders', { params });
      const data = response.data.data;

      setTenders(data.tenders || []);
      setTotalResults(data.total || 0);
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to load tenders. Please try again.';
      setError(message);
      setTenders([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedCategories, selectedStates, selectedTenderTypes, selectedValueRange, selectedDeadline, sortBy]);

  /* Fetch on mount and when filters / sort / page change */
  useEffect(() => {
    fetchTenders(currentPage);
  }, [currentPage, fetchTenders]);

  /* Reset to page 1 when filters change (but not on page change itself) */
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const filterKey = JSON.stringify({
      keyword, selectedCategories, selectedStates, selectedTenderTypes,
      selectedValueRange, selectedDeadline, sortBy,
    });
    if (prevFiltersRef.current && prevFiltersRef.current !== filterKey) {
      setCurrentPage(1);
    }
    prevFiltersRef.current = filterKey;
  }, [keyword, selectedCategories, selectedStates, selectedTenderTypes, selectedValueRange, selectedDeadline, sortBy]);

  /* Total pages */
  const totalPages = Math.max(1, Math.ceil(totalResults / RESULTS_PER_PAGE));

  /* ---------------------------------------------------------------- */
  /* Filter helpers                                                    */
  /* ---------------------------------------------------------------- */

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleState(state: string) {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  }

  function toggleTenderType(type: string) {
    setSelectedTenderTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function clearAllFilters() {
    setSelectedCategories([]);
    setSelectedStates([]);
    setSelectedValueRange('Any');
    setSelectedDeadline('Any');
    setSelectedTenderTypes([]);
    setMsmeReserved(false);
    setStartupIndia(false);
    setMakeInIndia(false);
    setWomenOwned(false);
    setStateSearch('');
    setKeyword('');
  }

  /* Collect all active filter labels for pills */
  const activeFilters: { label: string; onRemove: () => void }[] = [];

  selectedCategories.forEach((c) =>
    activeFilters.push({
      label: c,
      onRemove: () => toggleCategory(c),
    })
  );
  selectedStates.forEach((s) =>
    activeFilters.push({
      label: s,
      onRemove: () => toggleState(s),
    })
  );
  if (selectedValueRange !== 'Any') {
    activeFilters.push({
      label: selectedValueRange,
      onRemove: () => setSelectedValueRange('Any'),
    });
  }
  if (selectedDeadline !== 'Any') {
    activeFilters.push({
      label: selectedDeadline,
      onRemove: () => setSelectedDeadline('Any'),
    });
  }
  selectedTenderTypes.forEach((t) =>
    activeFilters.push({
      label: t,
      onRemove: () => toggleTenderType(t),
    })
  );
  if (msmeReserved)
    activeFilters.push({ label: 'MSME Reserved', onRemove: () => setMsmeReserved(false) });
  if (startupIndia)
    activeFilters.push({ label: 'Startup India', onRemove: () => setStartupIndia(false) });
  if (makeInIndia)
    activeFilters.push({ label: 'Make in India', onRemove: () => setMakeInIndia(false) });
  if (womenOwned)
    activeFilters.push({ label: 'Women-owned', onRemove: () => setWomenOwned(false) });

  /* Filtered states for search */
  const filteredStates = STATES.filter((s) =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );
  const visibleStates = showAllStates ? filteredStates : filteredStates.slice(0, 8);

  /* ---------------------------------------------------------------- */
  /* Render helpers                                                    */
  /* ---------------------------------------------------------------- */

  const FilterPanel = (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary-500" />
          Category
        </h3>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {cat}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* State / UT */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary-500" />
          State / UT
        </h3>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={stateSearch}
            onChange={(e) => setStateSearch(e.target.value)}
            placeholder="Search states..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {visibleStates.map((state) => (
            <label key={state} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedStates.includes(state)}
                onChange={() => toggleState(state)}
                className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {state}
              </span>
            </label>
          ))}
        </div>
        {!showAllStates && filteredStates.length > 8 && (
          <button
            onClick={() => setShowAllStates(true)}
            className="mt-2 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
          >
            Show all {filteredStates.length} states
          </button>
        )}
        {showAllStates && (
          <button
            onClick={() => setShowAllStates(false)}
            className="mt-2 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
          >
            Show less
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Tender Value */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-primary-500" />
          Tender Value
        </h3>
        <div className="space-y-2">
          {VALUE_RANGES.map((range) => (
            <label key={range} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="valueRange"
                checked={selectedValueRange === range}
                onChange={() => setSelectedValueRange(range)}
                className="h-4 w-4 border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {range}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Deadline */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary-500" />
          Deadline
        </h3>
        <div className="space-y-2">
          {DEADLINES.map((dl) => (
            <label key={dl} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="deadline"
                checked={selectedDeadline === dl}
                onChange={() => setSelectedDeadline(dl)}
                className="h-4 w-4 border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {dl}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Tender Type */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary-500" />
          Tender Type
        </h3>
        <div className="space-y-2">
          {TENDER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedTenderTypes.includes(type)}
                onChange={() => toggleTenderType(type)}
                className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Special Preferences */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Special Preferences</h3>
        <div className="space-y-3">
          {[
            { label: 'MSME Reserved', value: msmeReserved, setter: setMsmeReserved },
            { label: 'Startup India', value: startupIndia, setter: setStartupIndia },
            { label: 'Make in India', value: makeInIndia, setter: setMakeInIndia },
            { label: 'Women-owned', value: womenOwned, setter: setWomenOwned },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(value)}
                onClick={() => setter(!value)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                  value ? 'bg-primary-500' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out',
                    value ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => { setCurrentPage(1); fetchTenders(1); }}
          className="w-full py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={clearAllFilters}
          className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* -------------------------------------------------------------- */}
      {/* Header                                                         */}
      {/* -------------------------------------------------------------- */}
      <div className="pt-28 pb-6 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Advanced Tender Search
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Find the perfect government tender with precision filters
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Search bar                                                     */}
      {/* -------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); fetchTenders(1); } }}
              placeholder="Search by keyword, tender ID, or organization..."
              className="w-full pl-12 pr-4 py-3.5 text-base bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground shadow-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={() => { setCurrentPage(1); fetchTenders(1); }}
            className="px-8 py-3.5 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-card flex items-center gap-2"
          >
            <Search className="h-5 w-5" />
            Search
          </button>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden px-4 py-3.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors shadow-card"
          >
            <SlidersHorizontal className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Two-column layout                                              */}
      {/* -------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex gap-8">
          {/* ---------------------------------------------------------- */}
          {/* Left sidebar - Filters (desktop)                           */}
          {/* ---------------------------------------------------------- */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24 bg-card border border-border rounded-2xl p-5 shadow-card max-h-[calc(100vh-7rem)] overflow-y-auto">
              <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </h2>
              {FilterPanel}
            </div>
          </aside>

          {/* ---------------------------------------------------------- */}
          {/* Left sidebar - Filters (mobile drawer)                     */}
          {/* ---------------------------------------------------------- */}
          {showMobileFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowMobileFilters(false)}
              />
              <div className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border p-5 overflow-y-auto shadow-elevated">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {FilterPanel}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* Right content - Results                                     */}
          {/* ---------------------------------------------------------- */}
          <div className="flex-1 min-w-0">
            {/* Result count + sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-semibold text-foreground">
                  {totalResults.toLocaleString()}
                </span>{' '}
                results
                {keyword && (
                  <>
                    {' '}for{' '}
                    <span className="font-semibold text-foreground">&quot;{keyword}&quot;</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filter pills */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {activeFilters.map((filter, idx) => (
                  <span
                    key={`${filter.label}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-primary-500/10 text-primary-500 rounded-full"
                  >
                    {filter.label}
                    <button
                      onClick={filter.onRemove}
                      className="hover:bg-primary-500/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Tender result cards */}
            <div className="space-y-4">
              {/* Loading state */}
              {loading && (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="relative bg-card border border-border rounded-xl overflow-hidden shadow-card p-5"
                    >
                      <div className="animate-pulse">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="h-5 w-16 bg-muted rounded-md" />
                          <div className="h-4 w-24 bg-muted rounded" />
                        </div>
                        <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                        <div className="flex gap-4 mb-2">
                          <div className="h-4 w-48 bg-muted rounded" />
                          <div className="h-4 w-24 bg-muted rounded" />
                        </div>
                        <div className="h-4 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error state */}
              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                    <AlertCircle className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">{error}</p>
                  <button
                    onClick={() => fetchTenders(currentPage)}
                    className="px-6 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && tenders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No tenders found</h3>
                  <p className="text-muted-foreground max-w-md">
                    Try adjusting your filters or search terms to find more results.
                  </p>
                </div>
              )}

              {/* Results */}
              {!loading && !error && tenders.map((tender) => {
                const displayCategory = tender.category
                  ? tender.category.charAt(0).toUpperCase() + tender.category.slice(1).toLowerCase()
                  : '';
                const dl = daysUntil(tender.bidSubmissionDeadline);
                const deadlineColor =
                  dl <= 3 ? 'text-red-500' : dl <= 7 ? 'text-amber-500' : 'text-accent-500';
                const excerpt = tender.description || tender.aiSummary || '';

                return (
                  <div
                    key={tender.id}
                    className="relative bg-card border border-border rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-shadow group"
                  >
                    {/* Category accent bar */}
                    <div
                      className={cn(
                        'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
                        CATEGORY_COLORS[displayCategory] || 'bg-gray-400'
                      )}
                    />

                    <div className="p-5 pl-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Top meta row */}
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md',
                                CATEGORY_BG_COLORS[displayCategory] || 'bg-gray-100',
                                CATEGORY_TEXT_COLORS[displayCategory] || 'text-gray-600'
                              )}
                            >
                              {displayCategory}
                            </span>
                            <span className="text-xs text-muted-foreground">{tender.referenceNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              {tender.tenderType}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-base font-semibold text-foreground group-hover:text-primary-500 transition-colors line-clamp-2">
                            {tender.title}
                          </h3>

                          {/* Org + State */}
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {tender.organization}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {tender.state}
                            </span>
                          </div>

                          {/* Excerpt */}
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                            {excerpt}
                          </p>
                        </div>

                        {/* Right side: value + deadline + CTA */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">
                              {tender.estimatedValue ? formatValue(tender.estimatedValue) : 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">Estimated Value</p>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-semibold', deadlineColor)}>
                              {dl > 0 ? `${dl}d left` : 'Closed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Due {formatDate(tender.bidSubmissionDeadline)}
                            </p>
                          </div>
                          <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-500 bg-primary-500/10 rounded-lg hover:bg-primary-500/20 transition-colors"
                          >
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ------------------------------------------------------ */}
            {/* Pagination                                               */}
            {/* ------------------------------------------------------ */}
            {!loading && !error && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {/* Previous button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    'inline-flex items-center justify-center h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                    currentPage === 1
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-card border border-border text-foreground hover:bg-muted'
                  )}
                >
                  Prev
                </button>

                {/* Page buttons */}
                {(() => {
                  const pages: number[] = [];
                  const maxVisible = 5;
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let end = Math.min(totalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                  }
                  for (let i = start; i <= end; i++) pages.push(i);

                  return pages.map((page) => {
                    const isActive = currentPage === page;

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          'relative inline-flex items-center justify-center h-10 w-10 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-500 text-white'
                            : 'bg-card border border-border text-foreground hover:bg-muted'
                        )}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}

                {/* Next button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    'inline-flex items-center justify-center h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                    currentPage === totalPages
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-card border border-border text-foreground hover:bg-muted'
                  )}
                >
                  Next
                </button>
              </div>
            )}

            {/* ------------------------------------------------------ */}
            {/* Upgrade modal                                            */}
            {/* ------------------------------------------------------ */}
            {showUpgradeModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setShowUpgradeModal(false)}
                />
                <div className="relative bg-card border border-border rounded-2xl p-8 shadow-elevated max-w-md w-full text-center">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>

                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/10">
                    <Lock className="h-7 w-7 text-primary-500" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Subscribe to unlock all search results
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Plans start at ₹1,499/month. Get unlimited access to all tenders.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                    >
                      View Plans
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/register?trial=true"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors"
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Bottom CTA - Smart Alerts                                      */}
      {/* -------------------------------------------------------------- */}
      <div className="border-t border-border bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10 mb-4">
            <Bell className="h-6 w-6 text-accent-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Couldn&apos;t find what you&apos;re looking for?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Set up Smart Alerts and get notified instantly when matching tenders are published across 50+ government portals.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-semibold rounded-xl hover:bg-accent-600 transition-colors"
          >
            Set up Smart Alerts
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
