import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'TENDER_ALERT'
    | 'DEADLINE_REMINDER'
    | 'SUBSCRIPTION_EXPIRY'
    | 'NEW_CORRIGENDUM'
    | 'TENDER_RESULT'
    | 'ELIGIBILITY_RESULT'
    | 'SYSTEM';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channel: 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS' | 'IN_APP';
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

export interface UnreadCountResponse {
  count: number;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function getNotifications(
  page: number = 1,
): Promise<ApiResponse<NotificationListResponse>> {
  return apiRequest(apiClient.get('/notifications', { params: { page } }));
}

export function markRead(ids: string[]): Promise<ApiResponse<void>> {
  return apiRequest(apiClient.post('/notifications/read', { ids }));
}

export function getUnreadCount(): Promise<ApiResponse<UnreadCountResponse>> {
  return apiRequest(apiClient.get('/notifications/unread-count'));
}

export function registerDevice(
  token: string,
  platform: 'ios' | 'android',
): Promise<ApiResponse<void>> {
  return apiRequest(
    apiClient.post('/notifications/device', { token, platform }),
  );
}
