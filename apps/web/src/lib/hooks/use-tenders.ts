'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface TenderFilters {
  query?: string;
  categories?: string[];
  states?: string[];
  tenderTypes?: string[];
  status?: string[];
  minValue?: number;
  maxValue?: number;
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
      if (activeFilters.minValue) params.minValue = String(activeFilters.minValue);
      if (activeFilters.maxValue) params.maxValue = String(activeFilters.maxValue);
      if (activeFilters.sortBy) params.sortBy = activeFilters.sortBy;
      if (activeFilters.sortOrder) params.sortOrder = activeFilters.sortOrder;
      params.page = String(activeFilters.page || 1);
      params.limit = String(activeFilters.limit || 20);

      const res = await api.get('/tenders', { params });
      setResult(res.data.data);
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
    const updated = { ...filters, ...newFilters, page: 1 };
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

export function useTenderDetail(id: string) {
  const [tender, setTender] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get(`/tenders/${id}`);
        setTender(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Tender not found');
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [id]);

  return { tender, isLoading, error };
}

export function useSavedTenders() {
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const toggleSave = async (tenderId: string) => {
    try {
      if (saved.has(tenderId)) {
        await api.delete(`/saved/${tenderId}`);
        setSaved((prev) => { const n = new Set(prev); n.delete(tenderId); return n; });
      } else {
        await api.post(`/saved/${tenderId}`);
        setSaved((prev) => new Set(prev).add(tenderId));
      }
    } catch {
      // User might not be authenticated
    }
  };

  return { saved, toggleSave };
}
