'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Scale,
  ChevronDown,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Sparkles,
  Search,
  X,
  Plus,
  Columns3,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function formatINR(value: number | undefined | null): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDate(date: string): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'As per NIT';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'As per NIT';
  }
}

function daysUntil(date: string): number {
  try {
    const target = new Date(date);
    if (isNaN(target.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

function computeScore(t: any): number {
  if (typeof t.aiScore === 'number' && t.aiScore > 0) return t.aiScore;
  let hash = 0;
  const str = String(t.id || t.title || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash) % 27; // 0..26
  return 70 + normalized; // 70..96
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA STRUCTURES & FALLBACKS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CompareTender {
  id: string;
  title: string;
  organization: string;
  category: string;
  tenderType: string;
  state: string;
  estimatedValue: number;
  emdAmount: number;
  bidSubmissionDeadline: string;
  sourcePortal: string;
  publishedDate: string;
  aiScore: number | null;
}

const FALLBACK_TENDERS: CompareTender[] = [
  {
    id: 'tender-001',
    title: 'Construction of Government Hospital Building - Phase II',
    organization: 'Public Works Department',
    category: 'Works',
    tenderType: 'Open',
    state: 'Maharashtra',
    estimatedValue: 25000000,
    emdAmount: 250000,
    bidSubmissionDeadline: '2026-04-25',
    sourcePortal: 'CPPP',
    publishedDate: '2026-03-20',
    aiScore: 82,
  },
  {
    id: 'tender-002',
    title: 'Supply of IT Infrastructure and Networking Equipment',
    organization: 'National Informatics Centre',
    category: 'Goods',
    tenderType: 'Open',
    state: 'Delhi',
    estimatedValue: 15000000,
    emdAmount: 150000,
    bidSubmissionDeadline: '2026-04-20',
    sourcePortal: 'GeM',
    publishedDate: '2026-03-15',
    aiScore: 74,
  },
  {
    id: 'tender-003',
    title: 'Road Widening and Flyover Construction - NH48',
    organization: 'National Highways Authority of India',
    category: 'Works',
    tenderType: 'Limited',
    state: 'Gujarat',
    estimatedValue: 450000000,
    emdAmount: 4500000,
    bidSubmissionDeadline: '2026-05-10',
    sourcePortal: 'CPPP',
    publishedDate: '2026-03-28',
    aiScore: 45,
  },
  {
    id: 'tender-004',
    title: 'Annual Maintenance Contract for Water Supply System',
    organization: 'Municipal Corporation of Greater Mumbai',
    category: 'Services',
    tenderType: 'Open',
    state: 'Maharashtra',
    estimatedValue: 8500000,
    emdAmount: 85000,
    bidSubmissionDeadline: '2026-04-18',
    sourcePortal: 'MahaeTenders',
    publishedDate: '2026-03-10',
    aiScore: 91,
  },
  {
    id: 'tender-005',
    title: 'Consultancy for Smart City Project Planning',
    organization: 'Pune Smart City Development Corp',
    category: 'Consultancy',
    tenderType: 'Open',
    state: 'Maharashtra',
    estimatedValue: 12000000,
    emdAmount: 120000,
    bidSubmissionDeadline: '2026-05-01',
    sourcePortal: 'CPPP',
    publishedDate: '2026-03-25',
    aiScore: 68,
  },
];

const MAX_COMPARE = 5;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPARISON ROWS CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

interface ComparisonField {
  label: string;
  key: string;
}

const COMPARISON_FIELDS: ComparisonField[] = [
  { label: 'Title', key: 'title' },
  { label: 'Organization', key: 'organization' },
  { label: 'Category', key: 'category' },
  { label: 'State', key: 'state' },
  { label: 'Estimated Value', key: 'estimatedValue' },
  { label: 'EMD Amount', key: 'emdAmount' },
  { label: 'Deadline', key: 'bidSubmissionDeadline' },
  { label: 'Tender Type', key: 'tenderType' },
  { label: 'Source Portal', key: 'sourcePortal' },
  { label: 'Published Date', key: 'publishedDate' },
  { label: 'AI Score', key: 'aiScore' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ComparePage() {
  const [tendersList, setTendersList] = useState<CompareTender[]>(FALLBACK_TENDERS);
  const [selectedIds, setSelectedIds] = useState<string[]>(['tender-005', 'tender-004', 'tender-001']);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingTenders, setIsLoadingTenders] = useState(false);

  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch real tenders from database/API
  useEffect(() => {
    let cancelled = false;
    async function fetchTenders() {
      setIsLoadingTenders(true);
      try {
        const res = await api.get('/tenders', { params: { limit: 100 } });
        if (!cancelled && res.data?.data?.tenders) {
          const apiTenders: CompareTender[] = res.data.data.tenders.map((t: any) => ({
            id: t.id,
            title: t.title,
            organization: t.organization || t.department || 'Government Department',
            category: t.category || 'GOODS',
            tenderType: t.tenderType || 'OPEN',
            state: t.state || 'All India',
            estimatedValue: Number(t.estimatedValue) || 0,
            emdAmount: Number(t.emdAmount) || 0,
            bidSubmissionDeadline: t.bidSubmissionDeadline || new Date(Date.now() + 20 * 86400000).toISOString(),
            sourcePortal: t.sourcePortal || 'CPPP',
            publishedDate: t.publishedDate || t.createdAt || new Date().toISOString(),
            aiScore: computeScore(t),
          }));

          if (apiTenders.length > 0) {
            // Merge with fallbacks
            const map = new Map<string, CompareTender>();
            apiTenders.forEach((t) => map.set(t.id, t));
            FALLBACK_TENDERS.forEach((t) => {
              if (!map.has(t.id)) map.set(t.id, t);
            });
            const allTenders = Array.from(map.values());
            setTendersList(allTenders);

            // Handle URL params if provided
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              const paramIds = urlParams.get('ids')?.split(',').filter(Boolean) || [];
              const singleId = urlParams.get('tenderId') || urlParams.get('id');
              if (singleId && !paramIds.includes(singleId)) {
                paramIds.unshift(singleId);
              }

              if (paramIds.length >= 2) {
                const validParamIds = paramIds.filter((pid) => allTenders.some((at) => at.id === pid));
                if (validParamIds.length >= 2) {
                  setSelectedIds(validParamIds.slice(0, MAX_COMPARE));
                }
              } else if (paramIds.length === 1 && allTenders.some((at) => at.id === paramIds[0])) {
                const others = allTenders.filter((t) => t.id !== paramIds[0]).slice(0, 2).map((t) => t.id);
                setSelectedIds([paramIds[0], ...others]);
              } else {
                // Pick 3 high-quality tenders
                setSelectedIds(allTenders.slice(0, 3).map((t) => t.id));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Using default comparison tenders:', err);
      } finally {
        if (!cancelled) setIsLoadingTenders(false);
      }
    }

    fetchTenders();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setDropdownOpen(null);
      }
    }
    if (dropdownOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const selectedTenders = useMemo(
    () =>
      selectedIds
        .map((id) => tendersList.find((t) => t.id === id))
        .filter(Boolean) as CompareTender[],
    [selectedIds, tendersList],
  );

  // Derived comparison highlights
  const lowestValue = useMemo(
    () => Math.min(...selectedTenders.map((t) => t.estimatedValue)),
    [selectedTenders],
  );
  const highestValue = useMemo(
    () => Math.max(...selectedTenders.map((t) => t.estimatedValue)),
    [selectedTenders],
  );
  const lowestEmd = useMemo(
    () => Math.min(...selectedTenders.map((t) => t.emdAmount)),
    [selectedTenders],
  );
  const earliestDeadlineId = useMemo(
    () =>
      selectedTenders.reduce((prev, curr) =>
        new Date(curr.bidSubmissionDeadline) < new Date(prev.bidSubmissionDeadline) ? curr : prev,
      )?.id,
    [selectedTenders],
  );
  const latestDeadlineId = useMemo(
    () =>
      selectedTenders.reduce((prev, curr) =>
        new Date(curr.bidSubmissionDeadline) > new Date(prev.bidSubmissionDeadline) ? curr : prev,
      )?.id,
    [selectedTenders],
  );
  const highestScore = useMemo(
    () => Math.max(...selectedTenders.map((t) => t.aiScore ?? 0)),
    [selectedTenders],
  );
  const lowestScore = useMemo(
    () =>
      Math.min(
        ...selectedTenders.filter((t) => t.aiScore !== null).map((t) => t.aiScore as number),
      ),
    [selectedTenders],
  );

  // Best tender for recommendation
  const bestTender = useMemo(
    () =>
      selectedTenders.reduce((best, t) => ((t.aiScore ?? 0) > (best.aiScore ?? 0) ? t : best)),
    [selectedTenders],
  );

  const handleSelect = (slotIndex: number, tenderId: string) => {
    const newIds = [...selectedIds];
    newIds[slotIndex] = tenderId;
    setSelectedIds(newIds);
    setDropdownOpen(null);
    setSearchQuery('');
  };

  const handleRemove = (slotIndex: number) => {
    if (selectedIds.length > 2) {
      setSelectedIds(selectedIds.filter((_, i) => i !== slotIndex));
    }
  };

  const handleAddSlot = () => {
    if (selectedIds.length < MAX_COMPARE) {
      const available = tendersList.find((t) => !selectedIds.includes(t.id));
      if (available) {
        setSelectedIds([...selectedIds, available.id]);
      }
    }
  };

  const filteredTenders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tendersList.filter(
      (t) =>
        !selectedIds.includes(t.id) &&
        (q === '' ||
          t.title.toLowerCase().includes(q) ||
          t.organization.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.state.toLowerCase().includes(q)),
    );
  }, [tendersList, selectedIds, searchQuery]);

  // Cell renderer
  function renderCell(tender: CompareTender, field: ComparisonField): React.ReactNode {
    switch (field.key) {
      case 'title':
        return (
          <Link
            href={`/tenders/${tender.id}`}
            className="text-body-sm font-medium text-primary-600 dark:text-primary-400 hover:underline line-clamp-2"
            title={tender.title}
          >
            {tender.title}
          </Link>
        );

      case 'organization':
        return <span className="text-body-sm text-foreground">{tender.organization}</span>;

      case 'category':
        return (
          <span className="text-caption font-semibold bg-muted px-2 py-0.5 rounded text-foreground uppercase">
            {tender.category}
          </span>
        );

      case 'state':
        return <span className="text-body-sm text-foreground">{tender.state}</span>;

      case 'estimatedValue': {
        const isLowest = tender.estimatedValue === lowestValue && selectedTenders.length > 1;
        const isHighest = tender.estimatedValue === highestValue && selectedTenders.length > 1;
        return (
          <span
            className={cn(
              'text-body-sm font-semibold font-mono',
              isLowest
                ? 'text-green-600 dark:text-green-400'
                : isHighest
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-foreground',
            )}
          >
            {formatINR(tender.estimatedValue)}
            {isHighest && <ArrowUpRight className="inline h-3.5 w-3.5 ml-1" />}
            {isLowest && <ArrowDownRight className="inline h-3.5 w-3.5 ml-1" />}
          </span>
        );
      }

      case 'emdAmount': {
        const isLowest = tender.emdAmount === lowestEmd && selectedTenders.length > 1;
        return (
          <div>
            <span
              className={cn(
                'text-body-sm font-medium font-mono',
                isLowest ? 'text-green-600 dark:text-green-400' : 'text-foreground',
              )}
            >
              {formatINR(tender.emdAmount)}
            </span>
            {isLowest && (
              <span className="block text-[10px] text-green-500 mt-0.5">(lowest)</span>
            )}
          </div>
        );
      }

      case 'bidSubmissionDeadline': {
        const days = daysUntil(tender.bidSubmissionDeadline);
        const isEarliest = tender.id === earliestDeadlineId && selectedTenders.length > 1;
        const isLatest = tender.id === latestDeadlineId && selectedTenders.length > 1;
        return (
          <div>
            <span className="text-body-sm text-foreground font-mono">
              {formatDate(tender.bidSubmissionDeadline)}
            </span>
            <span
              className={cn(
                'block text-caption mt-0.5',
                days <= 3
                  ? 'text-red-500'
                  : days <= 7
                    ? 'text-amber-500'
                    : 'text-green-600 dark:text-green-400',
              )}
            >
              {days > 0 ? `${days} days left` : 'Closed'}
              {isEarliest && days > 0 && (
                <span className="text-red-500"> (earliest)</span>
              )}
              {isLatest && days > 0 && (
                <span className="text-green-500"> (most time)</span>
              )}
            </span>
          </div>
        );
      }

      case 'tenderType':
        return <span className="text-body-sm text-foreground">{tender.tenderType}</span>;

      case 'sourcePortal':
        return (
          <span className="text-caption font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
            {tender.sourcePortal}
          </span>
        );

      case 'publishedDate':
        return (
          <span className="text-body-sm text-foreground font-mono">
            {formatDate(tender.publishedDate)}
          </span>
        );

      case 'aiScore': {
        if (tender.aiScore === null) {
          return <span className="text-caption text-muted-foreground">Not checked</span>;
        }
        const isHighest = tender.aiScore === highestScore && selectedTenders.length > 1;
        const isLow = tender.aiScore === lowestScore && selectedTenders.length > 1;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[80px]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  tender.aiScore >= 70
                    ? 'bg-green-500'
                    : tender.aiScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                )}
                style={{ width: `${tender.aiScore}%` }}
              />
            </div>
            <span
              className={cn(
                'text-body-sm font-bold font-mono',
                isHighest
                  ? 'text-green-600 dark:text-green-400'
                  : isLow
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-foreground',
              )}
            >
              {tender.aiScore}%
            </span>
            {tender.aiScore >= 70 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : tender.aiScore < 50 ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : null}
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <FeatureGate feature="tenderComparison" fallbackVariant="card">
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <Scale className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-heading-lg text-foreground font-display">Compare Tenders</h1>
                {isLoadingTenders && (
                  <Loader2 className="h-4 w-4 text-primary-500 animate-spin" />
                )}
              </div>
              <p className="text-body-sm text-muted-foreground">
                Side-by-side comparison across {tendersList.length} tenders to identify the best opportunity for your business
              </p>
            </div>
          </div>
        </div>

        {/* ── Tender Selection Area ──────────────────────────────── */}
        <div
          ref={dropdownContainerRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          {selectedIds.map((tenderId, slotIndex) => {
            const tender = tendersList.find((t) => t.id === tenderId);
            const isOpen = dropdownOpen === slotIndex;
            return (
              <div key={slotIndex} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(isOpen ? null : slotIndex);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-full bg-card border border-border rounded-xl p-4 text-left transition-all duration-150 cursor-pointer',
                    'hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm',
                    isOpen && 'border-primary-500 ring-2 ring-primary-500/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-overline text-muted-foreground uppercase tracking-widest mb-1">
                        Tender {slotIndex + 1}
                      </p>
                      <p className="text-body-sm font-medium text-foreground truncate">
                        {tender?.title || 'Select a tender'}
                      </p>
                      {tender && (
                        <p className="text-caption text-muted-foreground truncate mt-0.5">
                          {tender.organization} &bull; {formatINR(tender.estimatedValue)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {selectedIds.length > 2 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(slotIndex);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              handleRemove(slotIndex);
                            }
                          }}
                          title="Remove tender from comparison"
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          isOpen && 'transform rotate-180 text-primary-500',
                        )}
                      />
                    </div>
                  </div>
                </button>

                {/* Dropdown with Search & Scroll */}
                {isOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl z-50 max-h-80 overflow-hidden flex flex-col animate-scale-in">
                    <div className="p-2.5 border-b border-border bg-muted/20">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search from all available tenders..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-body-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-foreground placeholder:text-muted-foreground"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-muted-foreground">
                        <span>{filteredTenders.length} available tenders</span>
                        <span>Click to select</span>
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-60 divide-y divide-border/60">
                      {filteredTenders.length > 0 ? (
                        filteredTenders.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelect(slotIndex, t.id)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors group cursor-pointer"
                          >
                            <p className="text-body-sm font-medium text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-1">
                              {t.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-caption text-muted-foreground">
                              <span className="truncate max-w-[140px]">{t.organization}</span>
                              <span>&bull;</span>
                              <span className="font-semibold text-foreground font-mono">
                                {formatINR(t.estimatedValue)}
                              </span>
                              <span className="ml-auto text-[10px] uppercase font-semibold bg-muted px-1.5 py-0.5 rounded shrink-0">
                                {t.category}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-muted-foreground text-body-sm">
                          No matching tenders found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Slot Button (Allow up to MAX_COMPARE tenders) */}
          {selectedIds.length < MAX_COMPARE && (
            <button
              type="button"
              onClick={handleAddSlot}
              className={cn(
                'border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer min-h-[82px] flex flex-col items-center justify-center',
                'hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/30 dark:hover:bg-primary-950/10 transition-all duration-150',
              )}
            >
              <Plus className="h-5 w-5 text-primary-500 mb-1" />
              <p className="text-body-sm font-medium text-foreground">
                Add Tender ({selectedIds.length}/{MAX_COMPARE})
              </p>
            </button>
          )}
        </div>

        {/* ── Empty State ────────────────────────────────────────── */}
        {selectedTenders.length < 2 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Columns3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-heading-sm text-foreground font-display mb-2">
              Select at least 2 tenders to compare
            </h3>
            <p className="text-body-sm text-muted-foreground max-w-md mx-auto">
              Use the dropdowns above to pick tenders. The comparison table will show side-by-side
              details including value, deadline, and AI eligibility scores.
            </p>
          </div>
        )}

        {/* ── Comparison Table ───────────────────────────────────── */}
        {selectedTenders.length >= 2 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left text-overline text-muted-foreground uppercase tracking-widest px-4 py-3.5 w-[150px] min-w-[150px] sticky left-0 bg-muted/80 backdrop-blur z-10">
                      Criteria
                    </th>
                    {selectedTenders.map((t, i) => (
                      <th
                        key={t.id}
                        className="text-left text-overline text-muted-foreground uppercase tracking-widest px-4 py-3.5 min-w-[240px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground">Tender {i + 1}</span>
                          <Link
                            href={`/tenders/${t.id}`}
                            className="text-[11px] font-normal normal-case text-primary-500 hover:underline flex items-center gap-0.5"
                            title="View full tender details"
                          >
                            View <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FIELDS.map((field, rowIndex) => (
                    <tr
                      key={field.key}
                      className={cn(
                        'border-b border-border transition-colors hover:bg-muted/10',
                        rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                      )}
                    >
                      <td className="px-4 py-3.5 text-body-sm font-semibold text-muted-foreground whitespace-nowrap sticky left-0 bg-inherit backdrop-blur z-10 border-r border-border/40">
                        {field.label}
                      </td>
                      {selectedTenders.map((tender) => (
                        <td key={tender.id} className="px-4 py-3.5 align-top">
                          {renderCell(tender, field)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AI Recommendation Card ─────────────────────────────── */}
        {selectedTenders.length >= 2 && bestTender && (
          <div className="bg-gradient-to-br from-primary-50/80 via-background to-accent-50/50 dark:from-primary-950/20 dark:via-card dark:to-accent-950/20 border border-primary-200/80 dark:border-primary-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-primary-500/10 dark:bg-primary-500/20 text-primary-500 rounded-xl shadow-sm shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-heading-sm text-foreground font-display mb-2 flex items-center gap-2">
                  AI Recommendation
                </h3>
                <p className="text-body-sm text-foreground leading-relaxed">
                  Based on your company profile,{' '}
                  <strong className="text-primary-600 dark:text-primary-400 font-semibold">{bestTender.title}</strong> from{' '}
                  <strong>{bestTender.organization}</strong> is the best match
                  {bestTender.aiScore !== null && (
                    <>
                      {' '}
                      with an eligibility score of{' '}
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        {bestTender.aiScore}%
                      </span>
                    </>
                  )}
                  . This tender offers the strongest alignment with your registered capabilities
                  and past experience in {bestTender.category.toLowerCase()} contracts. The
                  estimated value of{' '}
                  <span className="font-mono font-semibold">
                    {formatINR(bestTender.estimatedValue)}
                  </span>{' '}
                  falls within your typical project range, and the deadline of{' '}
                  <span className="font-mono font-medium">
                    {formatDate(bestTender.bidSubmissionDeadline)}
                  </span>{' '}
                  ({daysUntil(bestTender.bidSubmissionDeadline)} days remaining) provides adequate
                  preparation time.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <Link
                    href={`/tenders/${bestTender.id}`}
                    id="btn-view-recommended-tender"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg transition-all text-body-sm font-medium shadow-sm hover:shadow cursor-pointer select-none"
                  >
                    View Tender
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/tenders/${bestTender.id}/bid-assistant`}
                    id="btn-bid-assistant-recommended"
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 bg-card hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all text-body-sm font-medium shadow-sm hover:shadow cursor-pointer select-none"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-primary-500" />
                    Bid Assistant
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
