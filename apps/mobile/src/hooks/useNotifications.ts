import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as notificationsApi from '@/services/api/notifications';
import { useNotificationStore } from '@/stores/notificationStore';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (page: number) => [...notificationKeys.all, 'list', page] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of notifications.
 */
export function useNotifications(page: number = 1) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: async () => {
      const res = await notificationsApi.getNotifications(page);
      return res.data!;
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Poll the unread notification count and sync it into the notification store.
 * Automatically refetches every 30 seconds.
 */
export function useUnreadCount() {
  const { setUnreadCount } = useNotificationStore();

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await notificationsApi.getUnreadCount();
      const data = res.data!;
      setUnreadCount(data.count);
      return data;
    },
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // 30 seconds
    refetchIntervalInBackground: false,
  });
}

/**
 * Mark one or more notifications as read.
 * Invalidates the notification list and unread count, and
 * eagerly decrements the store count.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const { decrementUnread } = useNotificationStore();

  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),

    onMutate: (ids) => {
      // Eagerly decrement count in the store
      decrementUnread(ids.length);
    },

    onError: () => {
      // Refetch to get accurate count after error
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount(),
      });
    },

    onSettled: () => {
      // Refresh both lists and count
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
