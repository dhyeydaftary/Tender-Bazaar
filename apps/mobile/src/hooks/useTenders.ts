import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ApiResponse } from '@/types/api';
import type { TenderSearchParams } from '@/types/tender';
import * as tenderApi from '@/services/api/tenders';
import { getNextTenderListPage } from '@/utils/tenderList';

/** Home-page tender lists, each backed by its own API endpoint. */
export type TenderListKind = 'recommended' | 'expiring';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const tenderKeys = {
  all: ['tenders'] as const,
  recommended: (limit: number) => [...tenderKeys.all, 'recommended', limit] as const,
  expiring: (limit: number) => [...tenderKeys.all, 'expiring', limit] as const,
  list: (kind: TenderListKind, limit: number) =>
    [...tenderKeys.all, 'list', kind, limit] as const,
  detail: (id: string) => [...tenderKeys.all, 'detail', id] as const,
  similar: (id: string) => [...tenderKeys.all, 'similar', id] as const,
  search: (params: TenderSearchParams) =>
    [...tenderKeys.all, 'search', params] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Unwrap an API envelope, throwing on failure so React Query reports an error state. */
async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const res = await request;
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data;
}

const listFetchers = {
  recommended: tenderApi.getRecommended,
  expiring: tenderApi.getExpiringTenders,
} as const;

/**
 * Fetch the first `limit` recommended tenders for the current user (open for
 * bidding, most relevant first; filtered by the API).
 */
export function useRecommendedTenders(limit: number) {
  return useQuery({
    queryKey: tenderKeys.recommended(limit),
    queryFn: () => unwrap(tenderApi.getRecommended({ limit })),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch the first `limit` tenders that are expiring soon (open, deadline within
 * the API's expiring-soon window, nearest deadline first).
 */
export function useExpiringTenders(limit: number) {
  return useQuery({
    queryKey: tenderKeys.expiring(limit),
    queryFn: () => unwrap(tenderApi.getExpiringTenders({ limit })),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Infinite-scroll list behind a home-page "See all" button. Stops paging when
 * every result is loaded or the user's plan pins results to page 1.
 */
export function useTenderListInfinite(kind: TenderListKind, limit = 20) {
  return useInfiniteQuery({
    queryKey: tenderKeys.list(kind, limit),
    queryFn: ({ pageParam }) => unwrap(listFetchers[kind]({ page: pageParam, limit })),
    initialPageParam: 1,
    getNextPageParam: getNextTenderListPage,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch the full detail view of a single tender.
 * Only runs when `id` is truthy.
 */
export function useTenderDetail(id: string) {
  return useQuery({
    queryKey: tenderKeys.detail(id),
    queryFn: async () => {
      const res = await tenderApi.getTenderDetail(id);
      return res.data!;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Fetch tenders similar to the given tender id.
 * Only runs when `id` is truthy.
 */
export function useSimilarTenders(id: string) {
  return useQuery({
    queryKey: tenderKeys.similar(id),
    queryFn: async () => {
      const res = await tenderApi.getSimilarTenders(id);
      return res.data!;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Infinite-scroll search across all tenders.
 * Pages are loaded incrementally via `fetchNextPage()`.
 */
export function useSearchTenders(params: TenderSearchParams) {
  return useInfiniteQuery({
    queryKey: tenderKeys.search(params),
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tenderApi.searchTenders({ ...params, page: pageParam });
      return res.data!;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage;
      const totalPages = Math.ceil(total / limit);
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: !!params.query || Object.keys(params).length > 0,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Prefetch a tender detail into the query cache so navigation feels instant.
 *
 * Usage:
 * ```ts
 * const prefetch = usePrefetchTender();
 * // on press-in / hover
 * prefetch('tender-id-123');
 * ```
 */
export function usePrefetchTender() {
  const queryClient = useQueryClient();

  return (id: string) => {
    if (!id) return;
    queryClient.prefetchQuery({
      queryKey: tenderKeys.detail(id),
      queryFn: async () => {
        const res = await tenderApi.getTenderDetail(id);
        return res.data!;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
