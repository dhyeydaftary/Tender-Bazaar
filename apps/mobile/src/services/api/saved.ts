import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';
import type { Tender } from '@/types/tender';

// ─── Response Types ─────────────────────────────────────────────────────────

export interface SavedTenderResponse {
  id: string;
  tenderId: string;
  savedAt: string;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function saveTender(
  id: string,
): Promise<ApiResponse<SavedTenderResponse>> {
  return apiRequest(apiClient.post(`/saved/${id}`));
}

export function unsaveTender(id: string): Promise<ApiResponse<void>> {
  return apiRequest(apiClient.delete(`/saved/${id}`));
}

export function getSavedTenders(): Promise<ApiResponse<Tender[]>> {
  return apiRequest(apiClient.get('/saved'));
}
