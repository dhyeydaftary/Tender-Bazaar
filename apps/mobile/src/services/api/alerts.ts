import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AlertData {
  name: string;
  keywords: string[];
  categories?: string[];
  states?: string[];
  minValue?: number;
  maxValue?: number;
  organizations?: string[];
  tenderTypes?: string[];
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
}

export interface Alert {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  categories: string[];
  states: string[];
  minValue?: number;
  maxValue?: number;
  organizations: string[];
  tenderTypes: string[];
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  isActive: boolean;
  lastMatchedAt?: string;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestAlertResponse {
  matchCount: number;
  sampleTenders: Array<{ id: string; title: string }>;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function createAlert(
  data: AlertData,
): Promise<ApiResponse<Alert>> {
  return apiRequest(apiClient.post('/alerts', data));
}

export function updateAlert(
  id: string,
  data: Partial<AlertData>,
): Promise<ApiResponse<Alert>> {
  return apiRequest(apiClient.put(`/alerts/${id}`, data));
}

export function deleteAlert(id: string): Promise<ApiResponse<void>> {
  return apiRequest(apiClient.delete(`/alerts/${id}`));
}

export function getAlerts(): Promise<ApiResponse<Alert[]>> {
  return apiRequest(apiClient.get('/alerts'));
}

export function testAlert(
  data: AlertData,
): Promise<ApiResponse<TestAlertResponse>> {
  return apiRequest(apiClient.post('/alerts/test', data));
}
