import { useState, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchTenders } from '@/hooks/useTenders';
import {
  getObject,
  setObject,
  StorageKeys,
} from '@/services/storage/mmkv';
import type { TenderSearchParams } from '@/types/tender';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 10;
const DEBOUNCE_MS = 300;

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadRecentSearches(): string[] {
  return getObject<string[]>(StorageKeys.SEARCH_RECENT) ?? [];
}

function persistRecentSearches(searches: string[]): void {
  setObject(StorageKeys.SEARCH_RECENT, searches);
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * All-in-one search hook combining debounced input, infinite query results,
 * and recent search history backed by MMKV.
 *
 * Usage:
 * ```tsx
 * const {
 *   query, setQuery, debouncedQuery,
 *   results, isLoading, hasNextPage, fetchNextPage,
 *   recentSearches, addRecentSearch, clearRecentSearches,
 * } = useSearch();
 * ```
 */
export function useSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadRecentSearches,
  );

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Build search params from the debounced query
  const searchParams = useMemo<TenderSearchParams>(
    () => ({
      query: debouncedQuery,
      limit: 20,
    }),
    [debouncedQuery],
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSearchTenders(searchParams);

  // Flatten all pages into a single array of tenders
  const results = useMemo(
    () => data?.pages.flatMap((page) => page.tenders) ?? [],
    [data],
  );

  /**
   * Add a query to recent searches (deduplicates, keeps last 10).
   */
  const addRecentSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;

      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        persistRecentSearches(next);
        return next;
      });
    },
    [],
  );

  /**
   * Clear all recent searches from state and MMKV.
   */
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    persistRecentSearches([]);
  }, []);

  return {
    // Input state
    query,
    setQuery,
    debouncedQuery,

    // Search results
    results,
    isLoading: isLoading || isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    fetchNextPage,

    // Recent searches
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  };
}
