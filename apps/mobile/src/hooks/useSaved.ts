import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as savedApi from '@/services/api/saved';
import { useSavedStore } from '@/stores/savedStore';
import { dashboardKeys } from '@/hooks/useDashboard';
import type { Tender } from '@/types/tender';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const savedKeys = {
  all: ['saved'] as const,
  list: () => [...savedKeys.all, 'list'] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetch the list of saved tenders and sync IDs into the saved store.
 */
export function useSavedTenders() {
  const { setSavedIds } = useSavedStore();

  return useQuery({
    queryKey: savedKeys.list(),
    queryFn: async () => {
      const res = await savedApi.getSavedTenders();
      const tenders = res.data!;
      // Sync IDs into Zustand for quick lookups across the app
      setSavedIds(tenders.map((t) => t.id));
      return tenders;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Save a tender with optimistic UI.
 * Immediately adds the ID to the saved store; reverts on error.
 */
export function useSaveTender() {
  const queryClient = useQueryClient();
  const { addSaved, removeSaved } = useSavedStore();

  return useMutation({
    mutationFn: (tenderId: string) => savedApi.saveTender(tenderId),

    onMutate: (tenderId) => {
      // Optimistic: add to store immediately
      addSaved(tenderId);
    },

    onError: (_error, tenderId) => {
      // Revert optimistic update
      removeSaved(tenderId);
    },

    onSettled: () => {
      // Refetch saved list to keep server state in sync
      queryClient.invalidateQueries({ queryKey: savedKeys.list() });
      // The home "Saved" KPI counts saved tenders.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

/**
 * Remove a tender from saved list with optimistic UI.
 * Immediately removes the ID from the saved store; reverts on error.
 */
export function useUnsaveTender() {
  const queryClient = useQueryClient();
  const { addSaved, removeSaved } = useSavedStore();

  return useMutation({
    mutationFn: (tenderId: string) => savedApi.unsaveTender(tenderId),

    onMutate: (tenderId) => {
      // Optimistic: remove from store immediately
      removeSaved(tenderId);

      // Snapshot the current list for rollback
      const previous = queryClient.getQueryData<Tender[]>(savedKeys.list());
      if (previous) {
        queryClient.setQueryData<Tender[]>(
          savedKeys.list(),
          previous.filter((t) => t.id !== tenderId),
        );
      }

      return { previous };
    },

    onError: (_error, tenderId, context) => {
      // Revert optimistic updates
      addSaved(tenderId);
      if (context?.previous) {
        queryClient.setQueryData(savedKeys.list(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: savedKeys.list() });
      // The home "Saved" KPI counts saved tenders.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
