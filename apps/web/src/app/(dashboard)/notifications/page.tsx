'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

/* ─── Types ─── */

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
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
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TENDER_ALERT':
    case 'ALERT_MATCH':
    case 'ALERT':
      return Bell;
    case 'DEADLINE':
    case 'DEADLINE_REMINDER':
      return Clock;
    case 'SUBSCRIPTION':
    case 'SUBSCRIPTION_EXPIRY':
    case 'PAYMENT':
      return CreditCard;
    case 'SYSTEM':
    case 'WARNING':
      return AlertTriangle;
    case 'SUCCESS':
    case 'ELIGIBILITY':
    case 'ELIGIBILITY_RESULT':
    case 'TENDER_RESULT':
      return CheckCircle2;
    default:
      return Bell;
  }
}

function getNotificationRoute(notification: Notification): string | null {
  const meta = (notification.data || notification.metadata) as Record<string, string> | undefined;
  switch (notification.type) {
    case 'TENDER_ALERT':
    case 'ALERT_MATCH':
    case 'ALERT':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : meta?.alertId ? '/alerts' : '/alerts';
    case 'DEADLINE':
    case 'DEADLINE_REMINDER':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/tenders';
    case 'SUBSCRIPTION':
    case 'SUBSCRIPTION_EXPIRY':
    case 'PAYMENT':
      return '/settings';
    case 'ELIGIBILITY':
    case 'ELIGIBILITY_RESULT':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/eligibility';
    case 'TENDER_RESULT':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/results';
    case 'NEW_CORRIGENDUM':
      return meta?.tenderId ? `/tenders/${meta.tenderId}` : '/tenders';
    default:
      return null;
  }
}

/* ─── Main Page Component ─── */

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  /* ─── Fetch ─── */

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/notifications', {
        params: { page, limit, unreadOnly },
      });
      const rawData = res.data?.data;
      const list = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.notifications)
        ? rawData.notifications
        : Array.isArray(res.data?.notifications)
        ? res.data.notifications
        : [];
      setNotifications(list);
      const totalCount =
        rawData?.total ??
        res.data?.meta?.total ??
        res.data?.total ??
        (Array.isArray(rawData) ? rawData.length : 0);
      setTotal(totalCount);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [unreadOnly]);

  /* ─── Mark as read ─── */

  const markAsRead = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch {
        // Silent fail
      }
    }

    const route = getNotificationRoute(notification);
    if (route) {
      router.push(route);
    }
  };

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to mark all as read');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  /* ─── Render ─── */

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Notifications</h1>
          <p className="text-muted-foreground">Stay updated on your tenders and alerts</p>
        </div>
        {hasUnread && (
          <button
            onClick={markAllAsRead}
            disabled={isMarkingAll}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {isMarkingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setUnreadOnly(false)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            !unreadOnly
              ? 'bg-primary-500 text-white'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            unreadOnly
              ? 'bg-primary-500 text-white'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Unread only
        </button>
      </div>

      {/* Notification list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {unreadOnly
                ? 'You are all caught up!'
                : 'Notifications about your alerts, deadlines, and more will appear here.'}
            </p>
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
                    'w-full flex items-start gap-4 px-6 py-4 text-left hover:bg-muted/50 transition-colors',
                    !notification.isRead && 'bg-primary-50 dark:bg-primary-950/20'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      !notification.isRead
                        ? 'bg-primary-100 text-primary-500 dark:bg-primary-900/30'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={cn(
                          'text-sm',
                          !notification.isRead
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-foreground'
                        )}
                      >
                        {notification.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.isRead && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary-500 shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
