'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  X,
  Bookmark,
  BookmarkCheck,
  MapPin,
  Building2,
  IndianRupee,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency, getDeadlineInfo, getCategoryInfo, formatIndianNumber } from '@/lib/utils';
import { useTenderSearch, useSavedTenders } from '@/lib/hooks/use-tenders';
import api from '@/lib/api';

const CATEGORIES = ['All', 'Works', 'Goods', 'Services', 'Consultancy'] as const;

const STATES = [
  'Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Rajasthan', 'Delhi',
  'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal', 'Kerala', 'Telangana',
  'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Odisha',
];

const VALUE_RANGES = [
  { value: 'any', label: 'Any Value' },
  { value: 'under-10l', label: 'Under 10L' },
  { value: '10l-1cr', label: '10L - 1Cr' },
  { value: '1cr-10cr', label: '1Cr - 10Cr' },
  { value: '10cr-100cr', label: '10Cr - 100Cr' },
  { value: '100cr-plus', label: 'Above 100Cr' },
];

const TENDER_TYPES = ['Open', 'Limited', 'Single Source'];

const DEADLINE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'next-30', label: 'Next 30 days' },
];

const SOURCE_PORTALS = ['GeM', 'CPPP', 'eProcure', 'Maharashtra eProc', 'TN eProcure', 'Karnataka eProc'];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest First' },
  { value: 'deadline', label: 'Deadline (Soonest)' },
  { value: 'value-high', label: 'Value (High to Low)' },
  { value: 'value-low', label: 'Value (Low to High)' },
];

/* Value-range helpers for API params */
function getValueRangeParams(range: string): { minValue?: number; maxValue?: number } {
  switch (range) {
    case 'under-10l': return { maxValue: 1000000 };
    case '10l-1cr': return { minValue: 1000000, maxValue: 10000000 };
    case '1cr-10cr': return { minValue: 10000000, maxValue: 100000000 };
    case '10cr-100cr': return { minValue: 100000000, maxValue: 1000000000 };
    case '100cr-plus': return { minValue: 1000000000 };
    default: return {};
  }
}

/* Deadline preset to API date range.
 *
 * The deadline radio group and the source-portal checkboxes were rendered and
 * counted as active filters but never sent to the API, so selecting them
 * changed nothing. Dates are sent as plain ISO instants, which is what the
 * publishedFrom/To and deadlineFrom/To parameters already accept. */
function getDeadlineParams(preset: string): { deadlineFrom?: string; deadlineTo?: string } {
  if (preset === 'any') return {};
  const now = new Date();
  const from = now.toISOString();

  if (preset === 'this-week') {
    // End of the current week (Sunday), local time.
    const end = new Date(now);
    end.setDate(end.getDate() + (7 - end.getDay()));
    end.setHours(23, 59, 59, 999);
    return { deadlineFrom: from, deadlineTo: end.toISOString() };
  }
  if (preset === 'this-month') {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { deadlineFrom: from, deadlineTo: end.toISOString() };
  }
  if (preset === 'next-30') {
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return { deadlineFrom: from, deadlineTo: end.toISOString() };
  }
  return {};
}

/* Sort option to API sortBy/sortOrder mapping */
function getSortParams(sort: string): { sortBy?: string; sortOrder?: string } {
  switch (sort) {
    case 'newest': return { sortBy: 'publishedDate', sortOrder: 'desc' };
    case 'deadline': return { sortBy: 'bidSubmissionDeadline', sortOrder: 'asc' };
    case 'value-high': return { sortBy: 'estimatedValue', sortOrder: 'desc' };
    case 'value-low': return { sortBy: 'estimatedValue', sortOrder: 'asc' };
    default: return {}; // relevance — let API decide
  }
}

/* ======================================================================
   COMPONENTS
   ====================================================================== */

function ScoreRingMini({ score, size = 32 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={3} fill="none" className="text-muted/50" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold">{score}</span>
    </div>
  );
}

function FilterSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-3 mb-3 last:border-0">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-sm font-medium text-foreground py-1 hover:text-primary-500 transition-colors">
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

/* ======================================================================
   SEARCH PAGE
   ====================================================================== */

const ITEMS_PER_PAGE = 20;

export default function SearchPage() {

  /* Tender search hook */
  const {
    filters,
    result,
    isLoading,
    error,
    updateFilters,
    search,
  } = useTenderSearch({ limit: ITEMS_PER_PAGE });

  /* Saved tenders hook */
  const { saved: savedIds, toggleSave } = useSavedTenders();

  /* Recent search history */
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await api.get('/search/history');
        const history = res.data.data || [];
        // Extract unique query strings
        const queries = Array.from(
          new Set(
            history
              .map((h: { query: string }) => h.query?.trim())
              .filter(Boolean),
          ),
        ).slice(0, 8) as string[];
        setRecentSearches(queries);
      } catch {
        // Non-critical; silently ignore
      }
    }
    fetchHistory();
  }, []);

  /* Local UI state */
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedState, setSelectedState] = useState('');
  const [selectedValueRange, setSelectedValueRange] = useState('any');
  const [selectedSort, setSelectedSort] = useState('relevance');
  const [showFilters, setShowFilters] = useState(false);

  /* Filter sidebar state.
   *
   * Every section starts collapsed on a fresh mount, so the panel opens in a
   * compact state and the user expands only the filters they want. This is
   * presentation only: the selected filter values below keep their own
   * defaults, so search results and the active-filter count are unaffected. */
  const [openSections, setOpenSections] = useState({
    category: false,
    state: false,
    value: false,
    deadline: false,
    tenderType: false,
    source: false,
  });
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterStates, setFilterStates] = useState<Set<string>>(new Set());
  const [filterValueRange, setFilterValueRange] = useState('any');
  const [filterDeadline, setFilterDeadline] = useState('any');
  const [filterTenderTypes, setFilterTenderTypes] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [stateSearch, setStateSearch] = useState('');

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  /* Active filter count */
  const activeFilterCount =
    filterCategories.size +
    filterStates.size +
    (filterValueRange !== 'any' ? 1 : 0) +
    (filterDeadline !== 'any' ? 1 : 0) +
    filterTenderTypes.size +
    filterSources.size;

  const clearAllFilters = () => {
    setFilterCategories(new Set());
    setFilterStates(new Set());
    setFilterValueRange('any');
    setFilterDeadline('any');
    setFilterTenderTypes(new Set());
    setFilterSources(new Set());
    setStateSearch('');
    // Re-run search with cleared sidebar filters
    triggerSearch({
      query: searchQuery || undefined,
      category: activeCategory,
      state: selectedState,
      valueRange: 'any',
      sort: selectedSort,
      sidebarCategories: new Set<string>(),
      sidebarStates: new Set<string>(),
      sidebarTenderTypes: new Set<string>(),
      sidebarSources: new Set<string>(),
      deadline: 'any',
      page: 1,
    });
  };

  /* Build API params from current UI state and trigger search */
  const triggerSearch = useCallback(
    (overrides: {
      query?: string;
      category?: string;
      state?: string;
      valueRange?: string;
      sort?: string;
      sidebarCategories?: Set<string>;
      sidebarStates?: Set<string>;
      sidebarTenderTypes?: Set<string>;
      sidebarSources?: Set<string>;
      deadline?: string;
      page?: number;
    } = {}) => {
      const q = overrides.query ?? searchQuery;
      const cat = overrides.category ?? activeCategory;
      const st = overrides.state ?? selectedState;
      const vr = overrides.valueRange ?? selectedValueRange;
      const sort = overrides.sort ?? selectedSort;
      const cats = overrides.sidebarCategories ?? filterCategories;
      const states = overrides.sidebarStates ?? filterStates;
      const types = overrides.sidebarTenderTypes ?? filterTenderTypes;
      const sources = overrides.sidebarSources ?? filterSources;
      const deadline = overrides.deadline ?? filterDeadline;
      const page = overrides.page ?? 1;

      // Merge category from pills and sidebar
      const allCategories: string[] = [];
      if (cat !== 'All') allCategories.push(cat.toUpperCase());
      cats.forEach((c) => { if (!allCategories.includes(c)) allCategories.push(c); });

      // Merge states from dropdown and sidebar
      const allStates: string[] = [];
      if (st) allStates.push(st);
      states.forEach((s) => { if (!allStates.includes(s)) allStates.push(s); });

      const sortParams = getSortParams(sort);
      const valueParams = getValueRangeParams(vr);
      const deadlineParams = getDeadlineParams(deadline);

      // Every key is passed on every call, using `undefined` to clear, so a
      // deselected filter is actually removed from the query rather than
      // lingering from the previous search.
      updateFilters({
        query: q || undefined,
        categories: allCategories.length > 0 ? allCategories : undefined,
        states: allStates.length > 0 ? allStates : undefined,
        tenderTypes: types.size > 0 ? Array.from(types) : undefined,
        sourcePortals: sources.size > 0 ? Array.from(sources) : undefined,
        minValue: valueParams.minValue,
        maxValue: valueParams.maxValue,
        deadlineFrom: deadlineParams.deadlineFrom,
        deadlineTo: deadlineParams.deadlineTo,
        sortBy: sortParams.sortBy,
        sortOrder: sortParams.sortOrder,
        page,
        limit: ITEMS_PER_PAGE,
      });
    },
    [searchQuery, activeCategory, selectedState, selectedValueRange, selectedSort, filterCategories, filterStates, filterTenderTypes, filterSources, filterDeadline, updateFilters],
  );

  /* Derived data from API result */
  const tenders = result?.tenders ?? [];
  const totalResults = result?.total ?? 0;
  const currentPage = filters.page || 1;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    triggerSearch({ query: query || undefined, page: 1 });
  };

  const handleSubmitSearch = () => {
    triggerSearch({ query: searchQuery || undefined, page: 1 });
  };

  const handlePageChange = (page: number) => {
    triggerSearch({ page });
  };

  const filteredStatesList = STATES.filter((s) => s.toLowerCase().includes(stateSearch.toLowerCase()));

  /* ------------------------------------------------------------------ */
  /* Filter sidebar content                                              */
  /* ------------------------------------------------------------------ */
  const filterContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-heading-sm text-foreground font-display flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-500" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500 text-white font-semibold">
              {activeFilterCount}
            </span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} className="text-caption text-primary-500 hover:text-primary-600 font-medium">
            Clear all
          </button>
        )}
      </div>

      {/* Category */}
      <FilterSection title="Category" open={openSections.category} onToggle={() => toggleSection('category')}>
        {['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'].map((cat) => {
          const catInfo = getCategoryInfo(cat);
          return (
            <label key={cat} className="flex items-center gap-2.5 py-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={filterCategories.has(cat)}
                onChange={() => {
                  const next = new Set(filterCategories);
                  if (next.has(cat)) next.delete(cat); else next.add(cat);
                  setFilterCategories(next);
                  triggerSearch({ sidebarCategories: next, page: 1 });
                }}
                className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent"
              />
              <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                {catInfo.label}
              </span>
            </label>
          );
        })}
      </FilterSection>

      {/* State */}
      <FilterSection title="State" open={openSections.state} onToggle={() => toggleSection('state')}>
        <input
          type="text"
          value={stateSearch}
          onChange={(e) => setStateSearch(e.target.value)}
          placeholder="Search states..."
          className="w-full bg-muted/50 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 placeholder:text-muted-foreground focus:ring-1 focus:ring-primary-500 outline-none mb-2"
        />
        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
          {filteredStatesList.map((state) => (
            <label key={state} className="flex items-center gap-2.5 py-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={filterStates.has(state)}
                onChange={() => {
                  const next = new Set(filterStates);
                  if (next.has(state)) next.delete(state); else next.add(state);
                  setFilterStates(next);
                  triggerSearch({ sidebarStates: next, page: 1 });
                }}
                className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent"
              />
              <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                {state}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Value Range */}
      <FilterSection title="Value Range" open={openSections.value} onToggle={() => toggleSection('value')}>
        {VALUE_RANGES.map((range) => (
          <label key={range.value} className="flex items-center gap-2.5 py-1 cursor-pointer group">
            <input
              type="radio"
              name="sidebar-value-range"
              checked={filterValueRange === range.value}
              onChange={() => { setFilterValueRange(range.value); triggerSearch({ valueRange: range.value, page: 1 }); }}
              className="w-4 h-4 border-border text-primary-500 focus:ring-primary-500 bg-transparent"
            />
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              {range.label}
            </span>
          </label>
        ))}
      </FilterSection>

      {/* Deadline */}
      <FilterSection title="Deadline" open={openSections.deadline} onToggle={() => toggleSection('deadline')}>
        {DEADLINE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2.5 py-1 cursor-pointer group">
            <input
              type="radio"
              name="sidebar-deadline"
              checked={filterDeadline === opt.value}
              onChange={() => { setFilterDeadline(opt.value); triggerSearch({ deadline: opt.value, page: 1 }); }}
              className="w-4 h-4 border-border text-primary-500 focus:ring-primary-500 bg-transparent"
            />
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              {opt.label}
            </span>
          </label>
        ))}
      </FilterSection>

      {/* Tender Type */}
      <FilterSection title="Tender Type" open={openSections.tenderType} onToggle={() => toggleSection('tenderType')}>
        {TENDER_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2.5 py-1 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterTenderTypes.has(type)}
              onChange={() => {
                const next = new Set(filterTenderTypes);
                if (next.has(type)) next.delete(type); else next.add(type);
                setFilterTenderTypes(next);
                triggerSearch({ sidebarTenderTypes: next, page: 1 });
              }}
              className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent"
            />
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              {type}
            </span>
          </label>
        ))}
      </FilterSection>

      {/* Source Portal */}
      <FilterSection title="Source Portal" open={openSections.source} onToggle={() => toggleSection('source')}>
        {SOURCE_PORTALS.map((portal) => (
          <label key={portal} className="flex items-center gap-2.5 py-1 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterSources.has(portal)}
              onChange={() => {
                const next = new Set(filterSources);
                if (next.has(portal)) next.delete(portal); else next.add(portal);
                setFilterSources(next);
                triggerSearch({ sidebarSources: next, page: 1 });
              }}
              className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent"
            />
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              {portal}
            </span>
          </label>
        ))}
      </FilterSection>
    </>
  );

  /* Shared Recent Searches card.
   *
   * Extracted so the desktop sidebar and the narrow-screen layout render the
   * same markup. It used to live only inside the `hidden md:block` sidebar,
   * which meant recent searches were unreachable below the md breakpoint. */
  const recentSearchesCard = (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-heading-sm text-foreground font-display flex items-center gap-2">
          <Star className="w-4 h-4 text-primary-500" /> Recent Searches
        </h3>
      </div>
      <div className="space-y-2 mb-3">
        {recentSearches.slice(0, 5).map((term, idx) => (
          <button
            key={idx}
            onClick={() => handleSearch(term)}
            className="w-full text-left p-2.5 rounded-lg bg-muted/50 hover:bg-primary-500/5 border border-transparent hover:border-primary-500/20 transition-all group"
          >
            <p className="text-body-sm font-medium text-foreground group-hover:text-primary-500 transition-colors">
              {term}
            </p>
          </button>
        ))}
      </div>
      <button className="w-full py-2 rounded-lg border border-dashed border-border text-caption font-medium text-muted-foreground hover:text-primary-500 hover:border-primary-500/30 transition-all flex items-center justify-center gap-1.5">
        <Bookmark className="w-3.5 h-3.5" />
        Save this search
      </button>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-heading-lg text-foreground font-display">Search Tenders</h1>
        <p className="text-body-sm text-muted-foreground mt-0.5">
          Search across {formatIndianNumber(50000)}+ active government tenders
        </p>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Prominent search bar                                            */}
      {/* -------------------------------------------------------------- */}
      <div className="bg-card border border-border rounded-xl p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmitSearch(); }}
          className="flex gap-3"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword, tender ID, organization, or location..."
              className="w-full bg-muted/50 border border-border text-foreground text-sm rounded-xl pl-11 pr-4 py-3.5 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </form>

        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-caption text-muted-foreground">Recent:</span>
            {recentSearches.map((term, idx) => (
              <button
                key={`${term}-${idx}`}
                onClick={() => handleSearch(term)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary-500/10 hover:text-primary-500 border border-border hover:border-primary-500/30 transition-all"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Quick filters row                                               */}
      {/* -------------------------------------------------------------- */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Category pills */}
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); triggerSearch({ category: cat, page: 1 }); }}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-all border',
                activeCategory === cat
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="hidden sm:block w-px h-6 bg-border" />

        {/* State dropdown */}
        <select
          value={selectedState}
          onChange={(e) => { setSelectedState(e.target.value); triggerSearch({ state: e.target.value, page: 1 }); }}
          className="bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500 outline-none"
        >
          <option value="">All States</option>
          {STATES.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>

        {/* Value range dropdown */}
        <select
          value={selectedValueRange}
          onChange={(e) => { setSelectedValueRange(e.target.value); triggerSearch({ valueRange: e.target.value, page: 1 }); }}
          className="bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500 outline-none"
        >
          {VALUE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>{range.label}</option>
          ))}
        </select>

        {/* Tender type dropdown */}
        <select
          className="bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500 outline-none hidden sm:block"
        >
          <option value="">All Types</option>
          {TENDER_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Sort dropdown */}
        <select
          value={selectedSort}
          onChange={(e) => { setSelectedSort(e.target.value); triggerSearch({ sort: e.target.value, page: 1 }); }}
          className="bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500 outline-none ml-auto"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border bg-card border-border text-muted-foreground hover:text-foreground transition-all md:hidden"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500 text-white font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Main layout: sidebar + results                                  */}
      {/* -------------------------------------------------------------- */}
      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="w-[260px] shrink-0 hidden md:block">
          {/* The sticky element is the whole column, not the filter card.
              Pinning only the filter card left Recent Searches as a static
              sibling: a stuck element is lifted out of its flow position, so
              the following sibling kept its own position and scrolled up
              underneath the pinned panel. Making the column sticky and laying
              both cards out inside it means their boxes are always stacked and
              can never overlap, whatever the panel's height.

              The column is bounded to the viewport and split with flexbox:
              the filter card takes the remaining space and scrolls internally
              (`min-h-0` is required for a flex child to be allowed to shrink
              below its content height), while Recent Searches keeps its
              natural height via `shrink-0`. No hard-coded offsets. */}
          <div className="sticky top-20 flex flex-col gap-4 max-h-[calc(100vh-6rem)]">
            <div className="bg-card border border-border rounded-xl p-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {filterContent}
            </div>
            {recentSearches.length > 0 && (
              <div className="shrink-0">{recentSearchesCard}</div>
            )}
          </div>
        </aside>

        {/* Mobile filter drawer */}
        {showFilters && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-card border-r border-border overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-heading-sm font-display text-foreground">Filters</span>
                <button onClick={() => setShowFilters(false)} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {filterContent}
              <button
                onClick={() => setShowFilters(false)}
                className="w-full mt-4 bg-primary-500 text-white py-2.5 rounded-lg text-sm font-semibold"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Results area */}
        <div className="flex-1 min-w-0">
          {/* Recent searches, narrow screens only. The sidebar that normally
              holds this card is hidden below md, so without this the section
              was simply unreachable on a phone. Stacked in normal flow above
              the results, so nothing can overlap. */}
          {recentSearches.length > 0 && (
            <div className="md:hidden mb-4">{recentSearchesCard}</div>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-body-sm text-muted-foreground">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  Showing <span className="font-mono text-foreground">{tenders.length}</span> of{' '}
                  <span className="font-mono text-foreground">{formatIndianNumber(totalResults)}</span> tenders
                </>
              )}
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-body-sm font-medium text-red-500 mb-1">Something went wrong</p>
              <p className="text-body-sm text-muted-foreground mb-3">{error}</p>
              <button
                onClick={() => search()}
                className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-20 bg-muted rounded" />
                      </div>
                      <div className="h-5 w-3/4 bg-muted rounded" />
                      <div className="h-4 w-1/2 bg-muted rounded" />
                    </div>
                    <div className="h-10 w-24 bg-muted rounded hidden sm:block" />
                    <div className="h-10 w-10 bg-muted rounded-full hidden lg:block" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Result cards */}
          {!isLoading && !error && (
          <div className="space-y-2">
            {tenders.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-body-md font-medium text-foreground mb-1">No tenders found</p>
                <p className="text-body-sm text-muted-foreground">
                  Try adjusting your search query or filters to find more results.
                </p>
              </div>
            ) : (
              tenders.map((tender) => {
                const cat = getCategoryInfo(tender.category);
                const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);
                const isSaved = savedIds.has(tender.id);
                const accentColor =
                  tender.category === 'WORKS'
                    ? '#E8593C'
                    : tender.category === 'GOODS'
                      ? '#2563EB'
                      : tender.category === 'SERVICES'
                        ? '#0D9488'
                        : '#7C3AED';

                return (
                  <div
                    key={tender.id}
                    className="group bg-card border border-border rounded-xl hover:border-border/80 hover:shadow-sm transition-all duration-200 overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      {/* Color accent bar */}
                      <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />

                      <div className="flex-1 flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          {/* Meta row */}
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>
                              {cat.label}
                            </span>
                            <span className="text-caption text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {tender.state}
                            </span>
                            <span className="text-caption text-muted-foreground font-mono hidden sm:inline">
                              {tender.referenceNumber}
                            </span>
                            <span className="text-caption text-muted-foreground flex items-center gap-1 hidden sm:inline-flex">
                              <Globe className="w-3 h-3" /> {tender.sourcePortal}
                            </span>
                          </div>

                          {/* Title */}
                          <Link
                            href={`/tenders/${tender.id}`}
                            className="text-body-sm md:text-body-md font-medium text-foreground hover:text-primary-500 transition-colors line-clamp-1"
                          >
                            {tender.title}
                          </Link>

                          {/* Organization */}
                          <p className="text-caption text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Building2 className="w-3 h-3" />
                            {tender.organization}
                          </p>

                          {/* Bottom row: value, deadline (mobile) */}
                          <div className="flex items-center gap-3 mt-1.5 sm:hidden">
                            <span className="text-caption font-mono text-foreground font-semibold flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" />
                              {formatCurrency(tender.estimatedValue ?? 0).replace('₹', '')}
                            </span>
                            <span className={cn('text-caption font-medium flex items-center gap-1', deadline.color)}>
                              <Clock className="w-3 h-3" />
                              {deadline.text}
                            </span>
                          </div>
                        </div>

                        {/* Value + deadline (desktop) */}
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-body-sm font-mono text-foreground font-semibold flex items-center justify-end gap-1">
                            <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
                            {formatCurrency(tender.estimatedValue ?? 0).replace('₹', '')}
                          </p>
                          <p className={cn('text-caption font-medium flex items-center justify-end gap-1 mt-0.5', deadline.color)}>
                            <Clock className="w-3 h-3" />
                            {deadline.text}
                          </p>
                        </div>

                        {/* AI Score */}
                        {'aiScore' in tender && typeof (tender as any).aiScore === 'number' && (
                          <div className="shrink-0 hidden lg:block">
                            <ScoreRingMini score={(tender as any).aiScore} size={38} />
                          </div>
                        )}

                        {/* Save button */}
                        <button
                          onClick={() => toggleSave(tender.id)}
                          className={cn(
                            'p-2 rounded-lg transition-all shrink-0',
                            isSaved
                              ? 'text-primary-500 hover:bg-primary-500/10'
                              : 'text-muted-foreground hover:text-primary-500 hover:bg-muted',
                          )}
                        >
                          {isSaved ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
                        </button>

                        {/* View details link */}
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="hidden sm:inline-flex items-center gap-1 text-caption font-medium text-primary-500 hover:text-primary-600 transition-colors shrink-0"
                        >
                          View Details
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && tenders.length > 0 && totalPages > 1 && (
            <>
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={cn(
                  'p-2 rounded-lg border border-border transition-colors',
                  currentPage === 1
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {(() => {
                // Show up to 5 page buttons centered around current page
                const pages: number[] = [];
                let start = Math.max(1, currentPage - 2);
                const end = Math.min(totalPages, start + 4);
                start = Math.max(1, end - 4);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages;
              })().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'h-10 w-10 rounded-lg text-sm font-medium transition-colors',
                    currentPage === page
                      ? 'bg-primary-500 text-white'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  'p-2 rounded-lg border border-border transition-colors',
                  currentPage === totalPages
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Results summary */}
            <p className="text-center text-caption text-muted-foreground mt-3">
              Page {currentPage} of {totalPages} -- Showing results{' '}
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalResults)} of{' '}
              {formatIndianNumber(totalResults)}
            </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
