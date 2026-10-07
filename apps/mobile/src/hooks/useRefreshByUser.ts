import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh handler.
 *
 * Wraps an async refetch function and provides `isRefreshing` / `onRefresh`
 * props ready to pass straight into a FlatList or ScrollView.
 *
 * Usage:
 * ```tsx
 * const { data, refetch } = useQuery(...);
 * const { isRefreshing, onRefresh } = useRefreshByUser(refetch);
 *
 * <FlatList
 *   refreshing={isRefreshing}
 *   onRefresh={onRefresh}
 *   ...
 * />
 * ```
 */
export function useRefreshByUser(refetch: () => Promise<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return { isRefreshing, onRefresh };
}
