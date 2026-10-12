'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useDashboardStore } from '@/stores/dashboard-store';

interface TenderFilters {
  query?: string;
  categories?: string[];
  states?: string[];
  tenderTypes?: string[];
  status?: string[];
  /**
   * These four were accepted by GET /tenders all along but had no field here
   * and were never serialised, so the source-portal, organisation and
   * published/deadline-date controls in the UI silently did nothing.
   */
  organizations?: string[];
  sourcePortals?: string[];
  publishedFrom?: string;
  publishedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  minValue?: number;
  maxValue?: number;
  reservedForMSME?: boolean;
  reservedForStartups?: boolean;
  emdExemptMSME?: boolean;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

interface Tender {
  id: string;
  title: string;
  description?: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  tenderType: string;
  category: string;
  status: string;
  state: string;
  district?: string;
  estimatedValue?: number;
  emdAmount?: number;
  publishedDate: string;
  bidSubmissionDeadline: string;
  sourcePortal: string;
  sourceUrl: string;
  aiKeywords?: string[];
  viewCount: number;
  highlight?: { title?: string[]; description?: string[] };
}

interface SearchResult {
  tenders: Tender[];
  total: number;
  page: number;
  limit: number;
  aggregations: {
    categories: Record<string, number>;
    states: Record<string, number>;
    valueRanges: Record<string, number>;
    organizations: Record<string, number>;
  };
}

/** Serialise filters into the query parameters GET /tenders expects. */
function buildSearchParams(f: TenderFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.query) params.query = f.query;
  if (f.categories?.length) params.categories = f.categories.join(',');
  if (f.states?.length) params.states = f.states.join(',');
  if (f.tenderTypes?.length) params.tenderTypes = f.tenderTypes.join(',');
  if (f.status?.length) params.status = f.status.join(',');
  if (f.organizations?.length) params.organizations = f.organizations.join(',');
  if (f.sourcePortals?.length) params.sourcePortals = f.sourcePortals.join(',');
  if (f.publishedFrom) params.publishedFrom = f.publishedFrom;
  if (f.publishedTo) params.publishedTo = f.publishedTo;
  if (f.deadlineFrom) params.deadlineFrom = f.deadlineFrom;
  if (f.deadlineTo) params.deadlineTo = f.deadlineTo;
  if (f.minValue !== undefined) params.minValue = String(f.minValue);
  if (f.maxValue !== undefined) params.maxValue = String(f.maxValue);
  if (f.reservedForMSME !== undefined) params.reservedForMSME = String(f.reservedForMSME);
  if (f.reservedForStartups !== undefined) params.reservedForStartups = String(f.reservedForStartups);
  if (f.emdExemptMSME !== undefined) params.emdExemptMSME = String(f.emdExemptMSME);
  if (f.sortBy) params.sortBy = f.sortBy;
  if (f.sortOrder) params.sortOrder = f.sortOrder;
  params.page = String(f.page || 1);
  params.limit = String(f.limit || 20);
  return params;
}

/**
 * Rapid filter changes are merged into one request. Selecting three filters in
 * quick succession previously issued three searches, and because each one was
 * built from a stale `filters` closure the later ones also discarded the
 * earlier selections.
 */
const COALESCE_MS = 200;

export function useTenderSearch(initialFilters: TenderFilters = {}) {
  const [filters, setFilters] = useState<TenderFilters>(initialFilters);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The authoritative current filters. `updateFilters` must never read the
  // `filters` state through a closure: two filter clicks before the next
  // render both saw the same stale object, so the second silently dropped the
  // first one's selection. That is what made several filters look like they
  // were OR-ed or ignored.
  const filtersRef = useRef<TenderFilters>(initialFilters);
  // Monotonic request id so a slow earlier response cannot overwrite the
  // results of a newer one.
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = useCallback(async (activeFilters: TenderFilters) => {
    const seq = ++seqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/tenders', { params: buildSearchParams(activeFilters) });
      if (seq !== seqRef.current) return; // superseded
      setResult(res.data.data);
    } catch (err: any) {
      if (seq !== seqRef.current) return;
      setError(err.response?.data?.error?.message || 'Failed to fetch tenders');
    } finally {
      if (seq === seqRef.current) setIsLoading(false);
    }
  }, []);

  /** Public escape hatch: search immediately, with explicit or current filters. */
  const search = useCallback(
    (searchFilters?: TenderFilters) => runSearch(searchFilters ?? filtersRef.current),
    [runSearch],
  );

  // Fetch once on mount. The guard stops the duplicate request that React's
  // StrictMode double-invocation of effects would otherwise issue in
  // development, on top of any request a filter change already triggered.
  const didMountFetch = useRef(false);
  useEffect(() => {
    if (!didMountFetch.current) {
      didMountFetch.current = true;
      runSearch(filtersRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [runSearch]);

  const updateFilters = useCallback(
    (newFilters: Partial<TenderFilters>) => {
      // Changing any filter resets to page 1 unless the caller is paginating.
      const page = newFilters.page !== undefined ? newFilters.page : 1;
      const updated = { ...filtersRef.current, ...newFilters, page };
      filtersRef.current = updated;
      setFilters(updated);

      setIsLoading(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runSearch(filtersRef.current), COALESCE_MS);
    },
    [runSearch],
  );

  const loadMore = useCallback(() => {
    const updated = { ...filtersRef.current, page: (filtersRef.current.page || 1) + 1 };
    filtersRef.current = updated;
    setFilters(updated);
    runSearch(updated);
  }, [runSearch]);

  /** Keeps the ref in step when a caller replaces filters wholesale. */
  const replaceFilters = useCallback((next: TenderFilters) => {
    filtersRef.current = next;
    setFilters(next);
  }, []);

  return {
    filters,
    result,
    isLoading,
    error,
    updateFilters,
    loadMore,
    search,
    setFilters: replaceFilters,
  };
}

export interface TenderDocument {
  id: string;
  name: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
}

export interface TenderResult {
  id: string;
  winnerName: string;
  winnerCompany?: string | null;
  awardedValue?: number | null;
  awardedDate?: string | null;
}

/** Shape returned by GET /tenders/:id (Prisma tender + documents + results). */
export interface TenderDetail {
  id: string;
  title: string;
  description?: string | null;
  referenceNumber: string;
  organization: string;
  department?: string | null;
  tenderType: string;
  category: string;
  status: string;
  state: string;
  district?: string | null;
  city?: string | null;
  estimatedValue?: number | null;
  emdAmount?: number | null;
  publishedDate: string;
  bidSubmissionDeadline: string;
  bidOpeningDate?: string | null;
  preBidMeetingDate?: string | null;
  sourcePortal: string;
  sourceUrl: string;
  aiSummary?: string | null;
  aiKeywords?: string[];
  aiEligibilityText?: string | null;
  minTurnover?: number | null;
  minNetWorth?: number | null;
  minExperience?: number | null;
  requiredCertifications?: string[];
  reservedForMSME?: boolean;
  reservedForStartups?: boolean;
  emdExemptMSME?: boolean;
  viewCount?: number;
  documents?: TenderDocument[];
  results?: TenderResult[];
  createdAt?: string;
  updatedAt?: string;
}

export function useTenderDetail(id: string | undefined) {
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setTender(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Reset state so navigating between tender ids re-enters the loading view
    // instead of briefly showing the previously fetched tender.
    let cancelled = false;
    setTender(null);
    setError(null);
    setIsLoading(true);

    api
      .get(`/tenders/${id}`)
      .then((res) => {
        if (cancelled) return;
        setTender(res.data.data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setTender(null);
        setError(err.response?.data?.error?.message || 'Tender not found');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { tender, isLoading, error };
}

export interface SimilarTender {
  id: string;
  title: string;
  organization?: string | null;
  state?: string | null;
  estimatedValue?: number | null;
}

/** GET /tenders/:id/similar — degrades to an empty list, never blocks the page. */
export function useSimilarTenders(id: string | undefined) {
  const [similar, setSimilar] = useState<SimilarTender[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setSimilar([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setSimilar([]);
    setIsLoading(true);

    api
      .get(`/tenders/${id}/similar`)
      .then((res) => {
        if (cancelled) return;
        const list: SimilarTender[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setSimilar(list.filter((t) => t?.id && t.id !== id));
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { similar, isLoading };
}

export function useSavedTenders() {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const adjustSavedCount = useDashboardStore((s) => s.adjustSavedCount);

  // Hydrate from the server.
  //
  // This set used to start empty and was never loaded, so an already-saved
  // tender always rendered as unsaved. Clicking its bookmark then POSTed a
  // duplicate save, the API answered 409 ALREADY_SAVED, and the old empty
  // `catch {}` discarded it — so saving appeared to do nothing at all.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/saved', { params: { limit: 200 } });
        if (cancelled) return;
        const items = res.data?.data?.tenders ?? [];
        setSaved(new Set(items.map((i: { tenderId: string }) => i.tenderId)));
      } catch {
        // Not signed in, or the list could not be loaded. Leave the set empty
        // rather than guessing; toggleSave below still reports real failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSave = async (tenderId: string) => {
    const wasSaved = saved.has(tenderId);
    setError(null);

    // Optimistic, reverted below if the request fails.
    setSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(tenderId);
      else next.add(tenderId);
      return next;
    });

    try {
      if (wasSaved) await api.delete(`/saved/${tenderId}`);
      else await api.post(`/saved/${tenderId}`);

      // Sync the dashboard stat immediately so the saved-tenders card
      // reflects the change without needing a page refresh.
      adjustSavedCount(wasSaved ? -1 : 1);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;

      // 409 on save and 404 on unsave both mean the server already agrees with
      // the state we just moved to, so keep it instead of reverting.
      if ((!wasSaved && status === 409) || (wasSaved && status === 404)) {
        // Server already in target state — still sync the dashboard count.
        adjustSavedCount(wasSaved ? -1 : 1);
        return;
      }

      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(tenderId);
        else next.delete(tenderId);
        return next;
      });

      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not update your saved tenders.';
      setError(message);
    }
  };

  return { saved, toggleSave, error };
}
