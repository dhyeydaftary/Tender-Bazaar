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
  const deadline = new Date(deadlineDateStr);
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

  // Data fetching state
  const [deadlines, setDeadlines] = useState<TenderDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch deadlines from API
  const fetchDeadlines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/tenders', {
        params: {
          status: 'ACTIVE',
          sortBy: 'bidSubmissionDeadline',
          sortOrder: 'asc',
          limit: 50,
          page: 1,
        },
      });

      if (!response.data || response.data.success === false) {
        throw new Error(response.data?.error?.message || 'Failed to load tender deadlines');
      }

      let rawTenders: Record<string, unknown>[] = [];
      const rawData = response.data?.data;

      if (Array.isArray(rawData)) {
        rawTenders = rawData;
      } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.tenders)) {
        rawTenders = [...rawData.tenders];
        const totalPages = Number(rawData.totalPages) || 1;
        if (totalPages > 1) {
          const additionalPages = [];
          for (let p = 2; p <= Math.min(totalPages, 5); p++) {
            additionalPages.push(
              api.get('/tenders', {
                params: {
                  status: 'ACTIVE',
                  sortBy: 'bidSubmissionDeadline',
                  sortOrder: 'asc',
                  limit: 50,
                  page: p,
                },
              }).catch(() => null)
            );
          }
          const pageResponses = await Promise.all(additionalPages);
          for (const pageRes of pageResponses) {
            if (pageRes && Array.isArray(pageRes.data?.data?.tenders)) {
              rawTenders.push(...pageRes.data.data.tenders);
            }
          }
        }
      } else if (Array.isArray(response.data?.tenders)) {
        rawTenders = response.data.tenders;
      } else {
        throw new Error('Received malformed tender data from server');
      }

      const mapped: TenderDeadline[] = rawTenders
        .filter((t) => t && typeof t === 'object' && t.id)
        .map((tender: Record<string, unknown>) => {
          const deadlineDate = (tender.bidSubmissionDeadline as string || '').slice(0, 10);
          return {
            id: tender.id as string,
            title: (tender.title as string) || 'Untitled Tender',
            organization: (tender.organization as string) || 'Unknown Organization',
            state: (tender.state as string) || 'All India',
            category: (tender.category || 'WORKS') as TenderDeadline['category'],
            estimatedValue: (tender.estimatedValue as number) ?? null,
            deadlineDate,
            urgency: computeUrgency(deadlineDate),
          };
        });
      setDeadlines(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load deadlines';
      setError(message);
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  // Group deadlines by date key
  const deadlinesByDate = useMemo(() => {
    const map: Record<string, TenderDeadline[]> = {};
    for (const d of deadlines) {
      if (!map[d.deadlineDate]) map[d.deadlineDate] = [];
      map[d.deadlineDate].push(d);
    }
    return map;
  }, [deadlines]);

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

  // Upcoming deadlines: next 7 days from today
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    return deadlines.filter((d) => {
      const dt = new Date(d.deadlineDate);
      return dt >= today && dt <= weekLater;
    }).sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime());
  }, [deadlines]);

  // Tenders for popover day
  const popoverTenders = useMemo(() => {
    if (popoverDay === null) return [];
    const key = dateKey(popoverDay);
    return deadlinesByDate[key] || [];
  }, [popoverDay, dateKey, deadlinesByDate]);

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
    const deadline = new Date(dateStr);
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
            onClick={fetchDeadlines}
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
                onClick={goToPrevMonth}
                className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Category Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-card border border-border rounded-xl">
            <span className="text-overline text-muted-foreground uppercase tracking-widest">Categories:</span>
            {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
                <span className="text-caption text-foreground">{style.label}</span>
              </div>
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
                      setPopoverDay(popoverDay === day ? null : day);
                    }}
                    className={cn(
                      'w-full min-h-[90px] p-2 border-b border-r border-border text-left transition-all duration-150',
                      'hover:bg-muted/40',
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

                  {/* Popover / Tooltip */}
                  {isPopover && dayDeadlines.length > 0 && (
                    <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-card border border-border rounded-xl shadow-lg animate-scale-in">
                      <div className="p-3 border-b border-border flex items-center justify-between">
                        <p className="text-caption text-foreground font-semibold">
                          {formatDateLabel(currentYear, currentMonth, day)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverDay(null);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-border">
                        {dayDeadlines.map((tender) => {
                          const catStyle = CATEGORY_STYLES[tender.category];
                          return (
                            <Link
                              key={tender.id}
                              href={`/tenders/${tender.id}`}
                              className="block p-3 hover:bg-muted/40 transition-colors group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', catStyle?.bg, catStyle?.text)}>
                                  {catStyle?.label}
                                </span>
                              </div>
                              <p className="text-body-sm text-foreground font-medium line-clamp-2 mb-1 group-hover:text-primary-500 transition-colors">
                                {tender.title}
                              </p>
                              <p className="text-caption text-muted-foreground truncate">
                                {tender.organization}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                      className="block p-4 hover:bg-muted/30 transition-colors group"
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
                            Deadline: {new Date(tender.deadlineDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
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
    </div>
    </FeatureGate>
  );
}
