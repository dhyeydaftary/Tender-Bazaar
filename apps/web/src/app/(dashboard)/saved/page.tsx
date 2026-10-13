'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  BookmarkX,
  Search,
  Filter,
  Clock,
  Building2,
  MapPin,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  CheckSquare,
  Square,
  ArrowUpRight,
  AlertTriangle,
  Tag,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn, formatCurrency, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';
import { useDashboardStore } from '@/stores/dashboard-store';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface SavedTender {
  id: string;
  tenderId: string;
  title: string;
  organization: string;
  category: string;
  state: string;
  estimatedValue: number | null;
  bidSubmissionDeadline: string;
  isSaved: boolean;
  notes: string;
  savedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILTER TABS
   ═══════════════════════════════════════════════════════════════════════════ */

type FilterTab = 'all' | 'expiring' | 'category';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'category', label: 'By Category' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SAVED TENDER CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function SavedTenderCard({
  tender,
  isSelected,
  isRemoving,
  onToggleSelect,
  onToggleSave,
  onUpdateNotes,
}: {
  tender: SavedTender;
  isSelected: boolean;
  isRemoving: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSave: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(tender.notes);
  const cat = getCategoryInfo(tender.category);
  const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);

  return (
    <div
      className={cn(
        'bg-card border rounded-xl transition-all duration-200 hover:shadow-md',
        isSelected ? 'border-primary-500 ring-1 ring-primary-500/20' : 'border-border',
      )}
    >
      {/* Top row: checkbox + title + save */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggleSelect(tender.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isSelected ? 'Deselect tender' : 'Select tender'}
          >
            {isSelected ? (
              <CheckSquare className="h-4.5 w-4.5 text-primary-500" />
            ) : (
              <Square className="h-4.5 w-4.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <Link
              href={`/tenders/${tender.tenderId}`}
              className="text-body-sm font-medium text-foreground hover:text-primary-500 transition-colors line-clamp-2 block"
            >
              {tender.title}
            </Link>

            <div className="flex items-center gap-2 mt-2">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>
                {cat.label}
              </span>
              <span className="text-caption text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {tender.state}
              </span>
            </div>
          </div>

          <button
            onClick={() => onToggleSave(tender.id)}
            disabled={isRemoving}
            className="shrink-0 p-1.5 rounded-lg text-primary-500 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
            aria-label="Remove from saved"
          >
            {isRemoving ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Bookmark className="h-4.5 w-4.5 fill-current" />
            )}
          </button>
        </div>
      </div>

      {/* Organization */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{tender.organization}</span>
        </div>
      </div>

      {/* Value + Deadline row */}
      <div className="flex items-center justify-between px-5 pb-4 gap-3">
        <div>
          <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px] mb-0.5">
            Value
          </p>
          <p className="text-body-sm font-mono font-semibold text-foreground">
            {formatCurrency(tender.estimatedValue)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px] mb-0.5">
            Deadline
          </p>
          <div className="flex items-center gap-1.5">
            {deadline.urgency === 'critical' && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            )}
            <span className={cn('text-body-sm font-semibold font-mono', deadline.color)}>
              {deadline.text}
            </span>
          </div>
        </div>
      </div>

      {/* Notes area */}
      <div className="border-t border-border">
        <button
          onClick={() => setNotesOpen(!notesOpen)}
          className="flex items-center justify-between w-full px-5 py-2.5 text-caption text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            {tender.notes ? 'View Notes' : 'Add Notes'}
          </span>
          {notesOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {notesOpen && (
          <div className="px-5 pb-4">
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => onUpdateNotes(tender.id, localNotes)}
              placeholder="Add your notes about this tender..."
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-caption focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
        {hasSearch ? (
          <Search className="h-8 w-8 text-muted-foreground/40" />
        ) : (
          <BookmarkX className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
      <h3 className="text-heading-sm font-display text-foreground mb-2">
        {hasSearch ? 'No matching tenders' : 'No saved tenders'}
      </h3>
      <p className="text-body-sm text-muted-foreground max-w-sm mx-auto mb-6">
        {hasSearch
          ? 'Try adjusting your search query or switching filter tabs.'
          : 'Save tenders you are interested in to keep track of opportunities and deadlines.'}
      </p>
      {!hasSearch && (
        <Link
          href="/tenders"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Browse Tenders
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SavedTendersPage() {
  const [tenders, setTenders] = useState<SavedTender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Plan limit gate
  const savedLimit = useLimitGate('maxSavedTenders');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const adjustSavedCount = useDashboardStore((s) => s.adjustSavedCount);

  /* ─── Fetch saved tenders from API ─── */

  const fetchSavedTenders = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      // Fetch all saved tenders (high limit to avoid pagination for now)
      const res = await api.get('/saved', { params: { limit: 200 } });
      const data = res.data?.data;
      const items: SavedTender[] = (data?.tenders ?? []).map((item: any) => ({
        id: item.id,
        tenderId: item.tenderId,
        title: item.tender?.title ?? '',
        organization: item.tender?.organization ?? '',
        category: item.tender?.category ?? '',
        state: item.tender?.state ?? '',
        estimatedValue: item.tender?.estimatedValue ?? null,
        bidSubmissionDeadline: item.tender?.bidSubmissionDeadline ?? '',
        isSaved: true,
        notes: item.notes ?? '',
        savedAt: item.createdAt,
      }));
      setTenders(items);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load saved tenders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedTenders();
  }, [fetchSavedTenders]);

  /* ─── Filtering ─── */

  const filtered = tenders.filter((t) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        t.title.toLowerCase().includes(q) ||
        t.organization.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Tab filter
    if (activeTab === 'expiring') {
      const deadline = getDeadlineInfo(t.bidSubmissionDeadline);
      if (deadline.urgency !== 'critical' && deadline.urgency !== 'warning') return false;
    }

    if (activeTab === 'category' && selectedCategory) {
      if (t.category !== selectedCategory) return false;
    }

    return true;
  });

  /* ─── Sorted: expiring soonest first when on expiring tab ─── */

  const sorted = [...filtered].sort((a, b) => {
    if (activeTab === 'expiring') {
      return new Date(a.bidSubmissionDeadline).getTime() - new Date(b.bidSubmissionDeadline).getTime();
    }
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

  /* ─── Category counts for filter ─── */

  const categoryCounts = tenders.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});

  /* ─── Handlers ─── */

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((t) => t.id)));
    }
  };

  const handleToggleSave = async (id: string) => {
    const tender = tenders.find((t) => t.id === id);
    if (!tender) return;

    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/saved/${tender.tenderId}`);
      setTenders((prev) => prev.filter((t) => t.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Keep dashboard stat in sync without a page refresh.
      adjustSavedCount(-1);
    } catch {
      // Silently fail — tender stays in list
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const exportTendersList = (list: SavedTender[], filenamePrefix: string) => {
    if (list.length === 0) {
      toast.error('No tenders available to export');
      return;
    }

    const headers = [
      'Title',
      'Organization',
      'Category',
      'State',
      'Estimated Value',
      'Deadline',
      'Notes',
      'Saved At',
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map((t) => [
      escapeCsv(t.title),
      escapeCsv(t.organization),
      escapeCsv(t.category),
      escapeCsv(t.state),
      escapeCsv(t.estimatedValue ? formatCurrency(t.estimatedValue) : 'N/A'),
      escapeCsv(t.bidSubmissionDeadline),
      escapeCsv(t.notes || ''),
      escapeCsv(t.savedAt ? new Date(t.savedAt).toLocaleDateString('en-IN') : ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${list.length} tender${list.length > 1 ? 's' : ''} to CSV`);
  };

  const handleExportSelected = () => {
    const selectedTenders = tenders.filter((t) => selectedIds.has(t.id));
    if (selectedTenders.length === 0) {
      toast.error('No tenders selected for export');
      return;
    }
    exportTendersList(selectedTenders, 'selected-saved-tenders');
  };

  const handleExportAll = () => {
    const listToExport = selectedIds.size > 0 ? tenders.filter((t) => selectedIds.has(t.id)) : tenders;
    exportTendersList(listToExport, 'saved-tenders');
  };

  const handleBulkRemove = async () => {
    const idsToRemove = Array.from(selectedIds);
    const tendersToRemove = tenders.filter((t) => idsToRemove.includes(t.id));

    setRemovingIds(new Set(idsToRemove));
    try {
      const results = await Promise.allSettled(
        tendersToRemove.map((t) => api.delete(`/saved/${t.tenderId}`))
      );
      // Count how many actually succeeded so the dashboard stays accurate.
      const removedCount = results.filter((r) => r.status === 'fulfilled').length;
      setTenders((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      if (removedCount > 0) adjustSavedCount(-removedCount);
    } catch {
      // Partial failures are handled by allSettled
    } finally {
      setRemovingIds(new Set());
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    const tender = tenders.find((t) => t.id === id);
    if (!tender) return;

    // Optimistic update
    setTenders((prev) => prev.map((t) => (t.id === id ? { ...t, notes } : t)));
    try {
      await api.patch(`/saved/${tender.tenderId}/notes`, { notes });
    } catch {
      // Revert on failure — refetch to get correct state
      fetchSavedTenders();
    }
  };

  /* ─── Stats ─── */

  const expiringCount = tenders.filter((t) => {
    const d = getDeadlineInfo(t.bidSubmissionDeadline);
    return d.urgency === 'critical' || d.urgency === 'warning';
  }).length;

  /* ─── Loading state ─── */

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500 mb-4" />
        <p className="text-body-sm text-muted-foreground">Loading saved tenders...</p>
      </div>
    );
  }

  /* ─── Error state ─── */

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-heading-sm font-display text-foreground mb-2">
          Something went wrong
        </h3>
        <p className="text-body-sm text-muted-foreground max-w-sm mx-auto mb-6">
          {error}
        </p>
        <button
          onClick={fetchSavedTenders}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Limit banner */}
      {!savedLimit.hasCapacity && !savedLimit.isUnlimited && (
        <div className="mb-6">
          <UpgradeBanner
            feature="Saved Tenders"
            requiredPlan="Starter"
            currentPlan={savedLimit.currentPlan}
            variant="inline"
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-heading-lg text-foreground font-display">Saved Tenders</h1>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold text-foreground">{tenders.length}</span> tenders saved
            {!savedLimit.isUnlimited && (
              <span className="text-muted-foreground"> / {savedLimit.limit}</span>
            )}
            {expiringCount > 0 && (
              <>
                {' '}&middot;{' '}
                <span className="text-amber-500 font-medium">{expiringCount} expiring soon</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAll}
            disabled={tenders.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-body-sm font-medium bg-card border border-border text-foreground hover:bg-muted rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="h-4 w-4 text-primary-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search saved tenders by name, organization, state, or notes..."
          className="w-full pl-10 pr-10 py-2.5 border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              if (tab.value !== 'category') setSelectedCategory(null);
            }}
            className={cn(
              'px-4 py-2 text-body-sm font-medium rounded-lg transition-colors',
              activeTab === tab.value
                ? 'bg-primary-500 text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20',
            )}
          >
            {tab.label}
            {tab.value === 'expiring' && expiringCount > 0 && (
              <span className="ml-1.5 font-mono text-[11px]">({expiringCount})</span>
            )}
          </button>
        ))}

        {/* Category sub-filters */}
        {activeTab === 'category' && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const info = getCategoryInfo(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-caption font-medium rounded-lg border transition-colors',
                    selectedCategory === cat
                      ? cn(info.bgColor, info.color, 'border-transparent')
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Tag className="h-3 w-3" />
                  {info.label}
                  <span className="font-mono text-[10px] ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-card border border-primary-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="text-caption text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              {selectedIds.size === sorted.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-caption text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{selectedIds.size}</span> selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={handleBulkRemove}
              disabled={removingIds.size > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {removingIds.size > 0 ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Tender Grid */}
      {sorted.length === 0 ? (
        <EmptyState hasSearch={!!searchQuery || activeTab !== 'all'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((tender) => (
            <SavedTenderCard
              key={tender.id}
              tender={tender}
              isSelected={selectedIds.has(tender.id)}
              isRemoving={removingIds.has(tender.id)}
              onToggleSelect={handleToggleSelect}
              onToggleSave={handleToggleSave}
              onUpdateNotes={handleUpdateNotes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
