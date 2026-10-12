'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TenderFilters {
  query?: string;
  categories?: string[];
  states?: string[];
  tenderTypes?: string[];
  status?: string[];
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

export function useTenderSearch(initialFilters: TenderFilters = {}) {
  const [filters, setFilters] = useState<TenderFilters>(initialFilters);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (searchFilters?: TenderFilters) => {
    const activeFilters = searchFilters || filters;
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (activeFilters.query) params.query = activeFilters.query;
      if (activeFilters.categories?.length) params.categories = activeFilters.categories.join(',');
      if (activeFilters.states?.length) params.states = activeFilters.states.join(',');
      if (activeFilters.tenderTypes?.length) params.tenderTypes = activeFilters.tenderTypes.join(',');
      if (activeFilters.status?.length) params.status = activeFilters.status.join(',');
      if (activeFilters.minValue !== undefined) params.minValue = String(activeFilters.minValue);
      if (activeFilters.maxValue !== undefined) params.maxValue = String(activeFilters.maxValue);
      if (activeFilters.reservedForMSME !== undefined) params.reservedForMSME = String(activeFilters.reservedForMSME);
      if (activeFilters.reservedForStartups !== undefined) params.reservedForStartups = String(activeFilters.reservedForStartups);
      if (activeFilters.emdExemptMSME !== undefined) params.emdExemptMSME = String(activeFilters.emdExemptMSME);
      if (activeFilters.sortBy) params.sortBy = activeFilters.sortBy;
      if (activeFilters.sortOrder) params.sortOrder = activeFilters.sortOrder;
      params.page = String(activeFilters.page || 1);
      params.limit = String(activeFilters.limit || 20);

      const res = await api.get('/tenders', { params });
      setResult(res.data.data);
      if (
        typeof res.data.data?.total === 'number' &&
        !activeFilters.query &&
        !activeFilters.categories?.length &&
        !activeFilters.states?.length
      ) {
        try {
          localStorage.setItem('tb_tenders_total_count', String(res.data.data.total));
          window.dispatchEvent(new CustomEvent('tb_tenders_updated'));
        } catch {}
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch tenders');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
  }, []);

  const updateFilters = (newFilters: Partial<TenderFilters>) => {
    const page = newFilters.page !== undefined ? newFilters.page : 1;
    const updated = { ...filters, ...newFilters, page };
    setFilters(updated);
    search(updated);
  };

  const loadMore = () => {
    const nextPage = (filters.page || 1) + 1;
    const updated = { ...filters, page: nextPage };
    setFilters(updated);
    search(updated);
  };

  return { filters, result, isLoading, error, updateFilters, loadMore, search, setFilters };
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
      if (wasSaved) {
        await api.delete(`/saved/${tenderId}`);
        toast.success('Tender removed from saved');
      } else {
        await api.post(`/saved/${tenderId}`);
        toast.success('Tender saved successfully!');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;

      // 409 on save and 404 on unsave both mean the server already agrees with
      // the state we just moved to, so keep it instead of reverting.
      if ((!wasSaved && status === 409) || (wasSaved && status === 404)) return;

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
      toast.error(message);
    }
  };

  return { saved, toggleSave, error };
}

/**
 * Hook to get the live, updated total tender count across the platform.
 * Hydrates immediately from localStorage cache, updates via /tenders/stats,
 * and refreshes when the tab gains focus or on periodic interval.
 */
export function useTenderCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    try {
      const saved = localStorage.getItem('tb_tenders_total_count');
      if (saved && !isNaN(Number(saved))) {
        setCount(Number(saved));
      }
    } catch {}

    const fetchCount = async () => {
      try {
        const res = await api.get('/tenders/stats');
        const total = res.data?.data?.total;
        if (!cancelled && typeof total === 'number') {
          setCount(total);
          try {
            localStorage.setItem('tb_tenders_total_count', String(total));
          } catch {}
          return;
        }
      } catch {
        // Fallback to /tenders?limit=1
        try {
          const fallbackRes = await api.get('/tenders', { params: { limit: '1' } });
          const total = fallbackRes.data?.data?.total;
          if (!cancelled && typeof total === 'number') {
            setCount(total);
            try {
              localStorage.setItem('tb_tenders_total_count', String(total));
            } catch {}
          }
        } catch {
          // Keep current state
        }
      }
    };

    fetchCount();

    const handleSync = () => {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('tb_tenders_total_count');
          if (saved && !isNaN(Number(saved))) {
            setCount(Number(saved));
          }
        } catch {}
      }
      fetchCount();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('tb_tenders_updated', handleSync);

    const interval = setInterval(fetchCount, 60000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('tb_tenders_updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  return count;
}

