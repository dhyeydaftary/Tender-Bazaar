'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function formatINR(value: number | undefined | null): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `\u20b9${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `\u20b9${(value / 100000).toFixed(2)} L`;
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(date: string): number {
  // From April 11, 2026
  const today = new Date(2026, 3, 11);
  return Math.ceil((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface MockTender {
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

const AVAILABLE_TENDERS: MockTender[] = [
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

const DEFAULT_SELECTED = ['tender-001', 'tender-002', 'tender-003'];

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
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTenders = useMemo(
    () =>
      selectedIds
        .map((id) => AVAILABLE_TENDERS.find((t) => t.id === id))
        .filter(Boolean) as MockTender[],
    [selectedIds],
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
    setSelectedIds(selectedIds.filter((_, i) => i !== slotIndex));
  };

  const handleAddSlot = () => {
    if (selectedIds.length < 3) {
      const available = AVAILABLE_TENDERS.find((t) => !selectedIds.includes(t.id));
      if (available) setSelectedIds([...selectedIds, available.id]);
    }
  };

  const filteredTenders = AVAILABLE_TENDERS.filter(
    (t) =>
      !selectedIds.includes(t.id) &&
      (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.organization.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Cell renderer
  function renderCell(tender: MockTender, field: ComparisonField): React.ReactNode {
    switch (field.key) {
      case 'title':
        return (
          <span className="text-body-sm font-medium text-primary-500 line-clamp-2">
            {tender.title}
          </span>
        );

      case 'organization':
        return <span className="text-body-sm text-foreground">{tender.organization}</span>;

      case 'category':
        return (
          <span className="text-caption font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
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
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-primary-500/10 rounded-lg">
            <Scale className="h-6 w-6 text-primary-500" />
          </div>
          <div>
            <h1 className="text-heading-lg text-foreground font-display">Compare Tenders</h1>
            <p className="text-body-sm text-muted-foreground">
              Side-by-side comparison to identify the best opportunity for your business
            </p>
          </div>
        </div>
      </div>

      {/* ── Tender Selection Area ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {selectedIds.map((tenderId, slotIndex) => {
          const tender = AVAILABLE_TENDERS.find((t) => t.id === tenderId);
          return (
            <div key={slotIndex} className="relative">
              <button
                onClick={() =>
                  setDropdownOpen(dropdownOpen === slotIndex ? null : slotIndex)
                }
                className={cn(
                  'w-full bg-card border border-border rounded-xl p-4 text-left transition-all duration-150',
                  'hover:border-primary-300 dark:hover:border-primary-700',
                  dropdownOpen === slotIndex && 'border-primary-500 ring-1 ring-primary-500',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-overline text-muted-foreground uppercase tracking-widest mb-1">
                      Tender {slotIndex + 1}
                    </p>
                    <p className="text-body-sm font-medium text-foreground truncate">
                      {tender?.title || 'Select a tender'}
                    </p>
                    {tender && (
                      <p className="text-caption text-muted-foreground truncate mt-0.5">
                        {tender.organization}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {selectedIds.length > 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(slotIndex);
                        }}
                        className="p-1 hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </button>

              {/* Dropdown */}
              {dropdownOpen === slotIndex && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 max-h-64 overflow-hidden animate-scale-in">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search tenders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-body-sm bg-muted rounded-lg border-none outline-none focus:ring-1 focus:ring-primary-500 text-foreground placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {filteredTenders.length > 0 ? (
                      filteredTenders.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleSelect(slotIndex, t.id)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-none"
                        >
                          <p className="text-body-sm font-medium text-foreground truncate">
                            {t.title}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {t.organization} &mdash; {formatINR(t.estimatedValue)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-body-sm text-muted-foreground text-center py-4">
                        No tenders available
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Slot */}
        {selectedIds.length < 3 && (
          <button
            onClick={handleAddSlot}
            className={cn(
              'border-2 border-dashed border-border rounded-xl p-4 text-center',
              'hover:border-primary-300 dark:hover:border-primary-700 hover:bg-muted/30 transition-all duration-150',
            )}
          >
            <Plus className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-body-sm text-muted-foreground">Add Tender</p>
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
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-overline text-muted-foreground uppercase tracking-widest px-4 py-3 w-[140px] min-w-[140px]">
                    Criteria
                  </th>
                  {selectedTenders.map((t, i) => (
                    <th
                      key={t.id}
                      className="text-left text-overline text-muted-foreground uppercase tracking-widest px-4 py-3"
                    >
                      Tender {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FIELDS.map((field, rowIndex) => (
                  <tr
                    key={field.key}
                    className={cn(
                      'border-b border-border transition-colors',
                      rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                    )}
                  >
                    <td className="px-4 py-3 text-body-sm font-medium text-muted-foreground whitespace-nowrap">
                      {field.label}
                    </td>
                    {selectedTenders.map((tender) => (
                      <td key={tender.id} className="px-4 py-3">
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
      {selectedTenders.length >= 2 && (
        <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/30 dark:to-accent-950/30 border border-primary-200 dark:border-primary-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-white dark:bg-secondary-900 rounded-full shadow-sm shrink-0">
              <Sparkles className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h3 className="text-heading-sm text-foreground font-display mb-2">
                AI Recommendation
              </h3>
              <p className="text-body-sm text-foreground leading-relaxed">
                Based on your company profile,{' '}
                <strong className="text-primary-500">{bestTender.title}</strong> from{' '}
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
                <span className="font-mono">
                  {formatDate(bestTender.bidSubmissionDeadline)}
                </span>{' '}
                ({daysUntil(bestTender.bidSubmissionDeadline)} days remaining) provides adequate
                preparation time.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-body-sm font-medium">
                  View Tender
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button className="inline-flex items-center gap-1.5 px-4 py-2 border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors text-body-sm font-medium">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Bid Assistant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
