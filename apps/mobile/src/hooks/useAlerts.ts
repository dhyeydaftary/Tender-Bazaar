/**
 * TenderBazaar -- Alert React Query Hooks
 *
 * TanStack React Query hooks for managing tender alert CRUD operations
 * with optimistic updates and cache invalidation.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import * as alertsApi from '../services/api/alerts';
import type { Alert, AlertData, TestAlertResponse } from '../services/api/alerts';
import type { ApiResponse } from '../types/api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
} as const;

// ---------------------------------------------------------------------------
// useAlerts
// ---------------------------------------------------------------------------

/**
 * Fetch all alerts for the authenticated user.
 * Data is considered fresh for 2 minutes.
 */
export function useAlerts(
  options?: Omit<
    UseQueryOptions<ApiResponse<Alert[]>, Error>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ApiResponse<Alert[]>, Error>({
    queryKey: alertKeys.lists(),
    queryFn: () => alertsApi.getAlerts(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useCreateAlert
// ---------------------------------------------------------------------------

/**
 * Create a new tender alert.
 * Invalidates the alerts list cache on success.
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Alert>, Error, AlertData>({
    mutationFn: (data: AlertData) => alertsApi.createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateAlert
// ---------------------------------------------------------------------------

/**
 * Update an existing tender alert.
 * Invalidates the alerts list cache on success.
 */
export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Alert>,
    Error,
    { id: string; data: Partial<AlertData> }
  >({
    mutationFn: ({ id, data }) => alertsApi.updateAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteAlert
// ---------------------------------------------------------------------------

/**
 * Delete a tender alert with optimistic removal from the cache.
 * On error the previous cache state is restored.
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<void>, Error, string, { previous: ApiResponse<Alert[]> | undefined }>({
    mutationFn: (id: string) => alertsApi.deleteAlert(id),

    onMutate: async (deletedId: string) => {
      // Cancel in-flight fetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: alertKeys.lists() });

      // Snapshot current cache for rollback
      const previous = queryClient.getQueryData<ApiResponse<Alert[]>>(
        alertKeys.lists(),
      );

      // Optimistically remove the alert from the cache
      queryClient.setQueryData<ApiResponse<Alert[]>>(
        alertKeys.lists(),
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((alert) => alert.id !== deletedId),
          };
        },
      );

      return { previous };
    },

    onError: (_error, _deletedId, context) => {
      // Rollback to the previous cache state
      if (context?.previous) {
        queryClient.setQueryData(alertKeys.lists(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// useTestAlert
// ---------------------------------------------------------------------------

/**
 * Test an alert configuration to see how many existing tenders it matches.
 * This is a fire-and-forget mutation -- it does not affect the cache.
 */
export function useTestAlert() {
  return useMutation<ApiResponse<TestAlertResponse>, Error, AlertData>({
    mutationFn: (data: AlertData) => alertsApi.testAlert(data),
  });
}

// ---------------------------------------------------------------------------
// useToggleAlert
// ---------------------------------------------------------------------------

/**
 * Toggle an alert's active/inactive state with optimistic UI update.
 * Uses `updateAlert` under the hood with `{ isActive }` in the partial data.
 */
export function useToggleAlert() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Alert>,
    Error,
    { id: string; isActive: boolean },
    { previous: ApiResponse<Alert[]> | undefined }
  >({
    mutationFn: ({ id, isActive }) =>
      alertsApi.updateAlert(id, { isActive } as Partial<AlertData>),

    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: alertKeys.lists() });

      const previous = queryClient.getQueryData<ApiResponse<Alert[]>>(
        alertKeys.lists(),
      );

      // Optimistically update the alert's active state
      queryClient.setQueryData<ApiResponse<Alert[]>>(
        alertKeys.lists(),
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((alert) =>
              alert.id === id ? { ...alert, isActive } : alert,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(alertKeys.lists(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}
