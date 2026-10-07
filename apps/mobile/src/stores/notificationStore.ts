import { create } from 'zustand';

// ─── State & Actions ────────────────────────────────────────────────────────

interface NotificationState {
  unreadCount: number;

  setUnreadCount: (count: number) => void;
  incrementUnread: (by?: number) => void;
  decrementUnread: (by?: number) => void;
  resetUnread: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,

  setUnreadCount: (count) => {
    set({ unreadCount: Math.max(0, count) });
  },

  incrementUnread: (by = 1) => {
    set({ unreadCount: get().unreadCount + by });
  },

  decrementUnread: (by = 1) => {
    set({ unreadCount: Math.max(0, get().unreadCount - by) });
  },

  resetUnread: () => {
    set({ unreadCount: 0 });
  },
}));
