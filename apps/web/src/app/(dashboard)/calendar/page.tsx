'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Building2,
  MapPin,
  IndianRupee,
  AlertTriangle,
  X,
  Search,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { FeatureGate } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0 = Sunday
  return new Date(year, month, 1).getDay();
}

function formatValue(value: number | null): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `\u20b9${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `\u20b9${(value / 100000).toFixed(2)} L`;
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

function formatDateLabel(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a YYYY-MM-DD date string safely in local time without UTC offset shifting.
 */
function formatDeadlineDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return dateStr;
}

/**
 * Parse an ISO date or date-only string safely into YYYY-MM-DD in local time.
 * Returns null for missing or invalid dates.
 */
function parseTenderDeadline(dateVal: unknown): { dateStr: string; date: Date } | null {
  if (!dateVal || typeof dateVal !== 'string') return null;
  const trimmed = dateVal.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    return { dateStr: trimmed, date };
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${d}`, date };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface TenderDeadline {
  id: string;
  title: string;
  organization: string;
  state: string;
  category: 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY';
  estimatedValue: number | null;
  deadlineDate: string; // YYYY-MM-DD
  urgency: 'critical' | 'warning' | 'normal';
}

const URGENCY_COLORS: Record<string, { badge: string; dot: string; text: string }> = {
  critical: {
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    dot: 'bg-red-500',
    text: 'text-red-500',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
    text: 'text-amber-500',
  },
  normal: {
    badge: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
    dot: 'bg-accent-500',
    text: 'text-accent-500',
  },
};

function computeUrgency(deadlineDateStr: string): 'critical' | 'warning' | 'normal' {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parts = deadlineDateStr.split('-').map(Number);
  const deadline = parts.length === 3
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(deadlineDateStr);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 3) return 'critical';
  if (diffDays < 7) return 'warning';
  return 'normal';
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATEGORY COLORS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_STYLES: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  WORKS: { dot: 'bg-primary-500', bg: 'bg-primary-500/10', text: 'text-primary-500', label: 'Works' },
  GOODS: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Goods' },
  SERVICES: { dot: 'bg-accent-500', bg: 'bg-accent-500/10', text: 'text-accent-500', label: 'Services' },
  CONSULTANCY: { dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Consultancy' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CalendarPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [popoverDay, setPopoverDay] = useState<number | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalCategoryFilter, setModalCategoryFilter] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Data fetching state
  const [deadlines, setDeadlines] = useState<TenderDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch tenders from the dedicated calendar endpoint for the current month.
   * We also look ahead 7 days past month-end so the "Upcoming Deadlines"
   * sidebar never clips items on the last few days of the month.
   */
  const fetchDeadlines = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      // Start: first day of month; End: last day + 7 days lookahead
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 7); // 7 days into the next month

      const response = await api.get('/calendar/tenders', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      if (response.data?.success && response.data.data && typeof response.data.data === 'object') {
        // The calendar endpoint returns { "YYYY-MM-DD": { count, tenders[] }, ... }
        const grouped = response.data.data as Record<string, { count: number; tenders: Record<string, unknown>[] }>;
        const seenIds = new Set<string>();
        const mapped: TenderDeadline[] = [];

        for (const [_dateKey, dayData] of Object.entries(grouped)) {
          for (const tender of dayData.tenders) {
            const id = tender.id as string;
            if (!id || seenIds.has(id)) continue;

            const parsed = parseTenderDeadline(tender.bidSubmissionDeadline);
            if (!parsed) continue;

            seenIds.add(id);
            mapped.push({
              id,
              title: (tender.title as string) || 'Untitled Tender',
              organization: (tender.organization as string) || 'Unknown Organization',
              state: (tender.state as string) || 'All India',
              category: (tender.category || 'WORKS') as TenderDeadline['category'],
              estimatedValue: (tender.estimatedValue as number) ?? null,
              deadlineDate: parsed.dateStr,
              urgency: computeUrgency(parsed.dateStr),
            });
          }
        }
        setDeadlines(mapped);
      } else {
        setDeadlines([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load deadlines';
      setError(message);
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the displayed month changes
  useEffect(() => {
    fetchDeadlines(currentYear, currentMonth);
  }, [fetchDeadlines, currentYear, currentMonth]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  // Filter deadlines by selected category
  const filteredDeadlines = useMemo(() => {
    if (selectedCategory === 'ALL') return deadlines;
    return deadlines.filter((d) => d.category === selectedCategory);
  }, [deadlines, selectedCategory]);

  // Group deadlines by date key
  const deadlinesByDate = useMemo(() => {
    const map: Record<string, TenderDeadline[]> = {};
    for (const d of filteredDeadlines) {
      if (!map[d.deadlineDate]) map[d.deadlineDate] = [];
      map[d.deadlineDate].push(d);
    }
    return map;
  }, [filteredDeadlines]);

  // Build a date key for any given day in the current month
  const dateKey = useCallback(
    (day: number) => {
      const m = String(currentMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${currentYear}-${m}-${d}`;
    },
    [currentYear, currentMonth],
  );

  // Navigation
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
    setPopoverDay(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(null);
    setPopoverDay(null);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
    setPopoverDay(null);
  };

  // Upcoming deadlines: next 7 days from today
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    return filteredDeadlines.filter((d) => {
      const parts = d.deadlineDate.split('-').map(Number);
      const dt = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(d.deadlineDate);
      return dt >= today && dt <= weekLater;
    }).sort((a, b) => {
      const pa = a.deadlineDate.split('-').map(Number);
      const pb = b.deadlineDate.split('-').map(Number);
      const ta = pa.length === 3 ? new Date(pa[0], pa[1] - 1, pa[2]).getTime() : new Date(a.deadlineDate).getTime();
      const tb = pb.length === 3 ? new Date(pb[0], pb[1] - 1, pb[2]).getTime() : new Date(b.deadlineDate).getTime();
      return ta - tb;
    });
  }, [filteredDeadlines]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverDay(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Tenders for popover/modal day
  const popoverDayTenders = useMemo(() => {
    if (popoverDay === null) return [];
    const key = dateKey(popoverDay);
    return deadlinesByDate[key] || [];
  }, [popoverDay, dateKey, deadlinesByDate]);

  // Categories available on the selected date
  const modalAvailableCategories = useMemo(() => {
    return Array.from(new Set(popoverDayTenders.map((t) => t.category)));
  }, [popoverDayTenders]);

  // Filtered tenders inside the modal by search query and category chip
  const modalFilteredTenders = useMemo(() => {
    return popoverDayTenders.filter((t) => {
      const matchesCategory = modalCategoryFilter === 'ALL' || t.category === modalCategoryFilter;
      if (!matchesCategory) return false;
      if (!modalSearchQuery.trim()) return true;
      const q = modalSearchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.organization.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [popoverDayTenders, modalCategoryFilter, modalSearchQuery]);

  // Today marker
  const todayDate = new Date();
  const isToday = (day: number) =>
    currentYear === todayDate.getFullYear() &&
    currentMonth === todayDate.getMonth() &&
    day === todayDate.getDate();

  // Calculate days until deadline for urgency label
  const daysUntilDeadline = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dateStr.split('-').map(Number);
    const deadline = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dateStr);
    return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Calendar grid: leading blanks + days
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  // Fill trailing to complete the last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <FeatureGate feature="tenderCalendar" fallbackVariant="card">
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarIcon className="h-6 w-6 text-primary-500" />
          <h1 className="text-heading-lg text-foreground font-display">Tender Calendar</h1>
        </div>
        <p className="text-body-sm text-muted-foreground">
          Track upcoming tender deadlines and plan your bids
        </p>
      </div>

      {/* ── Loading State ────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-body-sm text-muted-foreground">Loading deadlines...</span>
        </div>
      )}

      {/* ── Error State ─────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <p className="text-body-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => fetchDeadlines(currentYear, currentMonth)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-body-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* ── Main layout: Calendar + Sidebar ────────────────────────── */}
      {!loading && !error && <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 min-w-0">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading-sm text-foreground font-display">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-caption font-medium transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goToPrevMonth}
                className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-card border border-border rounded-xl">
            <span className="text-overline text-muted-foreground uppercase tracking-widest mr-1">Categories:</span>
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-caption font-medium transition-colors',
                selectedCategory === 'ALL'
                  ? 'bg-primary-500 text-white'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              All
            </button>
            {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === key ? 'ALL' : key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-medium transition-colors',
                  selectedCategory === key
                    ? 'bg-primary-500 text-white'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', selectedCategory === key ? 'bg-white' : style.dot)} />
                <span>{style.label}</span>
              </button>
            ))}
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-overline text-muted-foreground uppercase tracking-widest py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 border border-border rounded-xl overflow-hidden bg-card">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[90px] border-b border-r border-border bg-muted/20 last:border-r-0"
                  />
                );
              }

              const key = dateKey(day);
              const dayDeadlines = deadlinesByDate[key] || [];
              const hasDots = dayDeadlines.length > 0;
              const today = isToday(day);
              const isSelected = selectedDay === day;
              const isPopover = popoverDay === day;

              // Unique categories
              const uniqueCategories = Array.from(new Set(dayDeadlines.map((t) => t.category))).slice(0, 4);

              return (
                <div
                  key={`day-${day}`}
                  className="relative"
                >
                  <button
                    onClick={() => {
                      setSelectedDay(day);
                      if (dayDeadlines.length > 0) {
                        setPopoverDay(day);
                        setModalSearchQuery('');
                        setModalCategoryFilter('ALL');
                      } else {
                        setPopoverDay(null);
                      }
                    }}
                    className={cn(
                      'w-full min-h-[90px] p-2 border-b border-r border-border text-left transition-all duration-150',
                      'hover:bg-muted/40 cursor-pointer',
                      isSelected && 'bg-primary-500/5 ring-2 ring-inset ring-primary-500',
                      today && !isSelected && 'bg-accent-500/5',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center justify-center text-body-sm font-medium',
                        today &&
                          'bg-primary-500 text-white rounded-full w-7 h-7 text-caption',
                        !today && 'text-foreground',
                      )}
                    >
                      {day}
                    </span>

                    {/* Category dots */}
                    {hasDots && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center gap-1">
                          {uniqueCategories.map((cat) => (
                            <span
                              key={cat}
                              className={cn(
                                'h-2 w-2 rounded-full',
                                CATEGORY_STYLES[cat]?.dot || 'bg-primary-500',
                              )}
                            />
                          ))}
                        </div>
                        {dayDeadlines.length > 1 && (
                          <span className="inline-block text-[10px] font-semibold font-mono text-primary-500 bg-primary-500/10 px-1.5 rounded-full">
                            {dayDeadlines.length}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sidebar: Upcoming Deadlines ───────────────────────────── */}
        <div className="w-full lg:w-[360px] shrink-0">
          <div className="sticky top-20 bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-500" />
                <h3 className="text-heading-sm text-foreground font-display">Upcoming Deadlines</h3>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                Next 7 days from today
              </p>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-border">
              {upcomingDeadlines.length === 0 ? (
                <div className="p-8 text-center">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-body-sm text-muted-foreground">No upcoming deadlines in the next 7 days</p>
                </div>
              ) : (
                upcomingDeadlines.map((tender) => {
                  const catStyle = CATEGORY_STYLES[tender.category];
                  const urgencyStyle = URGENCY_COLORS[tender.urgency];
                  const daysLeft = daysUntilDeadline(tender.deadlineDate);

                  return (
                    <Link
                      key={tender.id}
                      href={`/tenders/${tender.id}`}
                      className="block p-4 hover:bg-muted/40 transition-colors group"
                    >
                      {/* Top row: category + urgency */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            catStyle?.bg,
                            catStyle?.text,
                          )}
                        >
                          {catStyle?.label}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            urgencyStyle.badge,
                          )}
                        >
                          {tender.urgency === 'critical' && (
                            <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                          )}
                          {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-body-sm text-foreground font-medium line-clamp-2 mb-2 group-hover:text-primary-500 transition-colors">
                        {tender.title}
                      </h4>

                      {/* Meta details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{tender.organization}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{tender.state}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                            <IndianRupee className="h-3 w-3 shrink-0" />
                            <span className="font-mono font-medium text-foreground">
                              {formatValue(tender.estimatedValue)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span>
                            Deadline: {formatDeadlineDate(tender.deadlineDate)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>}

      {/* ── Modal Dialog for Selected Date Tenders ────────────────────── */}
      {popoverDay !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setPopoverDay(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between gap-4 bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-heading-sm text-foreground font-display">
                      {formatDateLabel(currentYear, currentMonth, popoverDay)}
                    </h3>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 border border-primary-500/20">
                      {popoverDayTenders.length} {popoverDayTenders.length === 1 ? 'Tender' : 'Tenders'}
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    Bid submission deadlines scheduled on this day
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPopoverDay(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search & Category Filter Bar */}
            <div className="p-4 border-b border-border bg-muted/20 space-y-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Search tenders by title, organization, or state..."
                  className="w-full pl-10 pr-9 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoFocus
                />
                {modalSearchQuery && (
                  <button
                    onClick={() => setModalSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips (if more than 1 category) */}
              {modalAvailableCategories.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setModalCategoryFilter('ALL')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-caption font-medium transition-colors',
                      modalCategoryFilter === 'ALL'
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    All ({popoverDayTenders.length})
                  </button>
                  {modalAvailableCategories.map((cat) => {
                    const style = CATEGORY_STYLES[cat];
                    const count = popoverDayTenders.filter((t) => t.category === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setModalCategoryFilter(modalCategoryFilter === cat ? 'ALL' : cat)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-medium transition-colors',
                          modalCategoryFilter === cat
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', modalCategoryFilter === cat ? 'bg-white' : style?.dot)} />
                        <span>{style?.label || cat}</span>
                        <span className="text-[10px] opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Scrollable Tender List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border p-3 space-y-2">
              {modalFilteredTenders.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-body-sm font-medium text-foreground">No matching tenders found</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    Try adjusting your search terms or category filter
                  </p>
                  {modalSearchQuery && (
                    <button
                      onClick={() => setModalSearchQuery('')}
                      className="mt-3 text-caption font-medium text-primary-500 hover:text-primary-600 underline"
                    >
                      Clear search filter
                    </button>
                  )}
                </div>
              ) : (
                modalFilteredTenders.map((tender) => {
                  const catStyle = CATEGORY_STYLES[tender.category];
                  const daysLeft = daysUntilDeadline(tender.deadlineDate);
                  return (
                    <Link
                      key={tender.id}
                      href={`/tenders/${tender.id}`}
                      className="block p-3.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', catStyle?.bg, catStyle?.text)}>
                            {catStyle?.label || tender.category}
                          </span>
                          <span className="text-caption text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {tender.state}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                            tender.urgency === 'critical' && 'bg-red-500/10 text-red-500 border border-red-500/20',
                            tender.urgency === 'warning' && 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                            tender.urgency === 'normal' && 'bg-primary-500/10 text-primary-500 border border-primary-500/20',
                          )}
                        >
                          {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                        </span>
                      </div>

                      <h4 className="text-body-sm font-medium text-foreground group-hover:text-primary-500 transition-colors line-clamp-2 mb-2">
                        {tender.title}
                      </h4>

                      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-4 text-caption text-muted-foreground pt-1.5 border-t border-border/50">
                        <div className="flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{tender.organization}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                          <IndianRupee className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>{formatValue(tender.estimatedValue)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 border-t border-border bg-muted/20 flex items-center justify-between text-caption text-muted-foreground shrink-0">
              <span>
                Showing {modalFilteredTenders.length} of {popoverDayTenders.length} tenders
              </span>
              <button
                onClick={() => setPopoverDay(null)}
                className="px-3.5 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-foreground font-medium text-caption transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
