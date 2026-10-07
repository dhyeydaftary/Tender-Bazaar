import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';
import type { Tender, TenderDetail, TenderSearchParams } from '@/types/tender';

// ─── Response Types ─────────────────────────────────────────────────────────

export interface TenderSearchResponse {
  tenders: Tender[];
  total: number;
  page: number;
  limit: number;
  aggregations?: {
    categories: Record<string, number>;
    states: Record<string, number>;
    valueRanges: Record<string, number>;
    organizations: Record<string, number>;
  };
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function searchTenders(
  params: TenderSearchParams,
): Promise<ApiResponse<TenderSearchResponse>> {
  return apiRequest(apiClient.get('/tenders/search', { params }));
}

export function getTenderDetail(
  id: string,
): Promise<ApiResponse<TenderDetail>> {
  return apiRequest(apiClient.get(`/tenders/${id}`));
}

export function getSimilarTenders(
  id: string,
): Promise<ApiResponse<Tender[]>> {
  return apiRequest(apiClient.get(`/tenders/${id}/similar`));
}

export function getRecommended(): Promise<ApiResponse<Tender[]>> {
  return apiRequest(apiClient.get('/tenders/recommended'));
}

export function getExpiringTenders(): Promise<ApiResponse<Tender[]>> {
  return apiRequest(apiClient.get('/tenders/expiring'));
}
