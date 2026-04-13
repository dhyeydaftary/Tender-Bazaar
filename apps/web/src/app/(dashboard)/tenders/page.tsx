'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Bookmark,
  BookmarkCheck,
  MapPin,
  Building2,
  Filter,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn, formatCurrency, getDeadlineInfo, getCategoryInfo, formatIndianNumber } from '@/lib/utils';
import { useTenderSearch, useSavedTenders } from '@/lib/hooks/use-tenders';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', sortBy: 'publishedDate', sortOrder: 'desc' },
  { value: 'deadline', label: 'Deadline (Soonest)', sortBy: 'bidSubmissionDeadline', sortOrder: 'asc' },
  { value: 'value-high', label: 'Value (High to Low)', sortBy: 'estimatedValue', sortOrder: 'desc' },
  { value: 'value-low', label: 'Value (Low to High)', sortBy: 'estimatedValue', sortOrder: 'asc' },
  { value: 'relevance', label: 'Relevance', sortBy: 'relevance', sortOrder: 'desc' },
];

const STATES = [
  'Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Rajasthan', 'Delhi',
  'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal', 'Kerala', 'Telangana',
  'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Odisha',
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   TENDERS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

const ITEMS_PER_PAGE = 20;

export default function TendersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortKey, setSortKey] = useState('newest');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [stateSearch, setStateSearch] = useState('');
  const [openSections, setOpenSections] = useState({ category: true, state: true, value: false, special: false });

  const sortOption = SORT_OPTIONS.find((o) => o.value === sortKey) || SORT_OPTIONS[0];

  const { result, isLoading, error, updateFilters, search, filters } = useTenderSearch({
    page: 1,
    limit: ITEMS_PER_PAGE,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
  });
  const { saved: savedIds, toggleSave } = useSavedTenders();

  const tenders = result?.tenders ?? [];
  const total = result?.total ?? 0;
  const currentPage = filters.page || 1;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilters({ query: value || undefined });
    }, 400);
  };

  const toggleSection = (key: keyof typeof openSections) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const handleCategoryChange = (cat: string) => {
    const next = activeCategory === cat ? 'All' : cat;
    setActiveCategory(next);
    updateFilters({ categories: next === 'All' ? undefined : [next.toUpperCase()] });
  };

  const handleSortChange = (value: string) => {
    setSortKey(value);
    const opt = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];
    updateFilters({ sortBy: opt.sortBy, sortOrder: opt.sortOrder });
  };

  const toggleState = (state: string) => {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state); else next.add(state);
      updateFilters({ states: next.size > 0 ? Array.from(next) : undefined });
      return next;
    });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    updateFilters({ page });
  };

  const activeFilters = [
    ...(activeCategory !== 'All' ? [{ key: 'cat', label: activeCategory }] : []),
    ...Array.from(selectedStates).map((s) => ({ key: `state-${s}`, label: s })),
  ];

  const clearFilter = (key: string) => {
    if (key === 'cat') handleCategoryChange(activeCategory);
    else if (key.startsWith('state-')) toggleState(key.replace('state-', ''));
  };

  const clearAllFilters = () => {
    setActiveCategory('All');
    setSelectedStates(new Set());
    updateFilters({ categories: undefined, states: undefined });
  };

  const filteredStatesList = STATES.filter((s) => s.toLowerCase().includes(stateSearch.toLowerCase()));

  /* Shared filter sidebar content */
  const filterContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-heading-sm text-foreground font-display flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-500" /> Filters
        </h3>
        {activeFilters.length > 0 && (
          <button onClick={clearAllFilters} className="text-caption text-primary-500 hover:text-primary-600 font-medium">
            Clear all
          </button>
        )}
      </div>
      <FilterSection title="Category" open={openSections.category} onToggle={() => toggleSection('category')}>
        {['Works', 'Goods', 'Services', 'Consultancy'].map((cat) => (
          <label key={cat} className="flex items-center gap-2.5 py-1 cursor-pointer group">
            <input type="checkbox" checked={activeCategory === cat} onChange={() => handleCategoryChange(cat)} className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent" />
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{cat}</span>
          </label>
        ))}
      </FilterSection>
      <FilterSection title="State" open={openSections.state} onToggle={() => toggleSection('state')}>
        <input type="text" value={stateSearch} onChange={(e) => setStateSearch(e.target.value)} placeholder="Search states..." className="w-full bg-muted/50 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 placeholder:text-muted-foreground focus:ring-1 focus:ring-primary-500 outline-none mb-2" />
        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
          {filteredStatesList.map((state) => (
            <label key={state} className="flex items-center gap-2.5 py-1 cursor-pointer group">
              <input type="checkbox" checked={selectedStates.has(state)} onChange={() => toggleState(state)} className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500 bg-transparent" />
              <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{state}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="Value Range" open={openSections.value} onToggle={() => toggleSection('value')}>
        <div className="flex flex-wrap gap-1.5">
          {['Under 10L', '10L-1Cr', '1Cr-10Cr', '10Cr-100Cr', '100Cr+'].map((range) => (
            <button key={range} className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary-500/10 hover:text-primary-500 border border-border hover:border-primary-500/30 transition-all">{range}</button>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="Special Filters" open={openSections.special} onToggle={() => toggleSection('special')}>
        {['MSME Reserved', 'Startup Reserved', 'EMD Exempt'].map((f) => (
          <label key={f} className="flex items-center justify-between py-1 cursor-pointer group">
            <span className="text-body-sm text-muted-foreground group-hover:text-foreground transition-colors">{f}</span>
            <div className="relative w-9 h-5 bg-muted rounded-full cursor-pointer"><span className="absolute top-0.5 left-0.5 w-4 h-4 bg-foreground/30 rounded-full" /></div>
          </label>
        ))}
      </FilterSection>
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading-lg text-foreground font-display">All Tenders</h1>
        <p className="text-body-sm text-muted-foreground mt-0.5">Browse and search {total > 0 ? formatIndianNumber(total) : ''} active government tenders</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search tenders by keyword, organization, or location..." className="w-full bg-card border border-border text-foreground text-sm rounded-xl pl-10 pr-4 py-3 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
        </div>
        <button onClick={() => setShowMobileFilters(true)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border bg-card border-border text-muted-foreground hover:text-foreground transition-all md:hidden">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </button>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="w-[260px] shrink-0 hidden md:block">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-20">{filterContent}</div>
        </aside>

        {/* Mobile filter drawer */}
        {showMobileFilters && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-card border-r border-border overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-heading-sm font-display text-foreground">Filters</span>
                <button onClick={() => setShowMobileFilters(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
              </div>
              {filterContent}
              <button onClick={() => setShowMobileFilters(false)} className="w-full mt-4 bg-primary-500 text-white py-2.5 rounded-lg text-sm font-semibold">Apply Filters</button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-body-sm text-muted-foreground">
                {isLoading ? 'Loading...' : <>Showing <span className="font-mono text-foreground">{tenders.length}</span> of <span className="font-mono text-foreground">{formatIndianNumber(total)}</span> tenders</>}
              </p>
              {activeFilters.map((f) => (
                <button key={f.key} onClick={() => clearFilter(f.key)} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-500 hover:bg-primary-500/15 transition-colors">
                  {f.label} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select value={sortKey} onChange={(e) => handleSortChange(e.target.value)} className="bg-card border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500 outline-none">
                {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className="flex bg-card border border-border rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('list')} className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-primary-500/10 text-primary-500' : 'text-muted-foreground hover:text-foreground')}><LayoutList className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('grid')} className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-primary-500/10 text-primary-500' : 'text-muted-foreground hover:text-foreground')}><LayoutGrid className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* ERROR STATE */}
          {error && !isLoading && (
            <div className="bg-card border border-red-500/30 rounded-xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-body-md font-medium text-foreground mb-1">Failed to load tenders</p>
              <p className="text-body-sm text-muted-foreground mb-4">{error}</p>
              <button onClick={() => search()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {/* LOADING SKELETON */}
          {isLoading && (
            viewMode === 'list' ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                    <div className="flex items-stretch">
                      <div className="w-1 shrink-0 bg-muted" />
                      <div className="flex-1 flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-16 bg-muted rounded" />
                            <div className="h-3 w-20 bg-muted rounded" />
                          </div>
                          <div className="h-5 w-3/4 bg-muted rounded" />
                          <div className="h-3 w-1/2 bg-muted rounded" />
                        </div>
                        <div className="text-right shrink-0 hidden sm:block space-y-2">
                          <div className="h-5 w-24 bg-muted rounded ml-auto" />
                          <div className="h-3 w-16 bg-muted rounded ml-auto" />
                        </div>
                        <div className="w-[38px] h-[38px] rounded-full bg-muted shrink-0 hidden lg:block" />
                        <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 w-16 bg-muted rounded" />
                      <div className="w-7 h-7 bg-muted rounded-lg" />
                    </div>
                    <div className="h-5 w-full bg-muted rounded mb-1" />
                    <div className="h-5 w-2/3 bg-muted rounded mb-2" />
                    <div className="h-3 w-1/2 bg-muted rounded mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="h-5 w-24 bg-muted rounded" />
                        <div className="h-3 w-16 bg-muted rounded" />
                      </div>
                      <div className="w-[34px] h-[34px] rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* EMPTY STATE */}
          {!isLoading && !error && tenders.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-body-md font-medium text-foreground mb-1">No tenders found</p>
              <p className="text-body-sm text-muted-foreground">Try adjusting your filters or search query</p>
            </div>
          )}

          {/* LIST VIEW */}
          {!isLoading && !error && tenders.length > 0 && viewMode === 'list' && (
            <div className="space-y-2">
              {tenders.map((tender) => {
                const cat = getCategoryInfo(tender.category);
                const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);
                const isSaved = savedIds.has(tender.id);
                const accentColor = tender.category === 'WORKS' ? '#E8593C' : tender.category === 'GOODS' ? '#2563EB' : tender.category === 'SERVICES' ? '#0D9488' : '#7C3AED';
                return (
                  <div key={tender.id} className="group bg-card border border-border rounded-xl hover:border-border/80 hover:shadow-sm transition-all duration-200 overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />
                      <div className="flex-1 flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>{cat.label}</span>
                            <span className="text-caption text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {tender.state}</span>
                            <span className="text-caption text-muted-foreground font-mono hidden sm:inline">{tender.referenceNumber}</span>
                          </div>
                          <Link href={`/tenders/${tender.id}`} className="text-body-sm md:text-body-md font-medium text-foreground hover:text-primary-500 transition-colors line-clamp-1">{tender.title}</Link>
                          <p className="text-caption text-muted-foreground mt-0.5 flex items-center gap-1.5"><Building2 className="w-3 h-3" />{tender.organization}</p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-body-sm font-mono text-foreground font-semibold">{formatCurrency(tender.estimatedValue)}</p>
                          <p className={cn('text-caption font-medium', deadline.color)}>{deadline.text}</p>
                        </div>
                        <button onClick={() => toggleSave(tender.id)} className={cn('p-2 rounded-lg transition-all shrink-0', isSaved ? 'text-primary-500 hover:bg-primary-500/10' : 'text-muted-foreground hover:text-primary-500 hover:bg-muted')}>
                          {isSaved ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* GRID VIEW */}
          {!isLoading && !error && tenders.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenders.map((tender) => {
                const cat = getCategoryInfo(tender.category);
                const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);
                const isSaved = savedIds.has(tender.id);
                return (
                  <div key={tender.id} className="bg-card border border-border rounded-xl p-5 hover:border-border/80 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>{cat.label}</span>
                      <button onClick={() => toggleSave(tender.id)} className={cn('p-1.5 rounded-lg transition-all', isSaved ? 'text-primary-500' : 'text-muted-foreground hover:text-primary-500')}>
                        {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    </div>
                    <Link href={`/tenders/${tender.id}`} className="text-body-sm font-medium text-foreground hover:text-primary-500 transition-colors line-clamp-2 mb-2 block">{tender.title}</Link>
                    <p className="text-caption text-muted-foreground mb-3 flex items-center gap-1 truncate"><Building2 className="w-3 h-3 shrink-0" /> {tender.organization}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-mono text-foreground font-semibold">{formatCurrency(tender.estimatedValue)}</p>
                        <p className="text-caption text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {tender.state}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={cn('text-caption font-medium', deadline.color)}>{deadline.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}
          {!isLoading && !error && tenders.length > 0 && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className={cn('p-2 rounded-lg border border-border bg-card text-sm transition-all', currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted text-muted-foreground hover:text-foreground')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-sm font-medium transition-all',
                      page === currentPage
                        ? 'bg-primary-500 text-white'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={cn('p-2 rounded-lg border border-border bg-card text-sm transition-all', currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted text-muted-foreground hover:text-foreground')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
