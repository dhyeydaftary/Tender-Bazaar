import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { TenderSearchParams } from '@/types/tender';
import * as tenderApi from '@/services/api/tenders';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const tenderKeys = {
  all: ['tenders'] as const,
  recommended: () => [...tenderKeys.all, 'recommended'] as const,
  expiring: () => [...tenderKeys.all, 'expiring'] as const,
  detail: (id: string) => [...tenderKeys.all, 'detail', id] as const,
  similar: (id: string) => [...tenderKeys.all, 'similar', id] as const,
  search: (params: TenderSearchParams) =>
    [...tenderKeys.all, 'search', params] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetch AI-recommended tenders for the current user.
 */
export function useRecommendedTenders() {
  return useQuery({
    queryKey: tenderKeys.recommended(),
    queryFn: async () => {
      const res = await tenderApi.getRecommended();
      return res.data!;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch tenders that are expiring soon.
 */
export function useExpiringTenders() {
  return useQuery({
    queryKey: tenderKeys.expiring(),
    queryFn: async () => {
      const res = await tenderApi.getExpiringTenders();
      return res.data!;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
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
