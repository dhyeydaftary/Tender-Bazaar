'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

/* ─── Types ─── */

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'ALERT_MATCH':
    case 'ALERT':
      return Bell;
    case 'DEADLINE':
    case 'DEADLINE_REMINDER':
      return Clock;
    case 'SUBSCRIPTION':
    case 'PAYMENT':
      return CreditCard;
    case 'SYSTEM':
    case 'WARNING':
      return AlertTriangle;
    case 'SUCCESS':
    case 'ELIGIBILITY':
      return CheckCircle2;
    default:
      return Bell;
  }
}

function getNotificationRoute(notification: Notification): string | null {
  const meta = notification.metadata as Record<string, string> | undefined;
  switch (notification.type) {
    case 'ALERT_MATCH':
    case 'ALERT':
      return meta?.alertId ? '/alerts' : '/alerts';
    case 'DEADLINE':
    case 'DEADLINE_REMINDER':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/tenders';
    case 'SUBSCRIPTION':
    case 'PAYMENT':
      return '/settings';
    case 'ELIGIBILITY':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/eligibility';
    default:
      return null;
  }
}

/* ─── Component ─── */

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.data?.count ?? res.data.data?.unreadCount ?? 0);
    } catch {
      // Silent fail - non-critical
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch latest notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/notifications', { params: { page: 1, limit: 10 } });
      setNotifications(res.data.data?.notifications ?? []);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark single notification as read
  const markAsRead = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silent fail
      }
    }

    const route = getNotificationRoute(notification);
    if (route) {
      setIsOpen(false);
      router.push(route);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[1.25rem] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors sm:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <button
                      key={notification.id}
                      onClick={() => markAsRead(notification)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                        !notification.isRead && 'bg-primary-50 dark:bg-primary-950/20'
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          !notification.isRead
                            ? 'bg-primary-100 text-primary-500 dark:bg-primary-900/30'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm truncate',
                            !notification.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="w-full text-center text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
