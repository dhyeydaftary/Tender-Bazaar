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

/** Card fields returned by the home-page tender lists (TENDER_CARD_SELECT on the API). */
export type TenderListItem = Pick<
  Tender,
  | 'id'
  | 'title'
  | 'organization'
  | 'category'
  | 'state'
  | 'status'
  | 'publishedDate'
  | 'bidSubmissionDeadline'
  | 'sourcePortal'
  | 'referenceNumber'
> & {
  estimatedValue: number | null;
  emdAmount: number | null;
  /** Relevance score; only on personalised recommendations. */
  aiScore?: number | null;
};

export interface TenderListResponse {
  tenders: TenderListItem[];
  total: number;
  page: number;
  limit: number;
  /** True when the user's plan pins results to page 1. */
  paginationLocked: boolean;
  /** Recommendations only: false when based on newest open tenders (no company profile). */
  personalised?: boolean;
}

export interface TenderListParams {
  page?: number;
  limit?: number;
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

/** Open tenders recommended for the user, most relevant first. */
export function getRecommended(
  params: TenderListParams = {},
): Promise<ApiResponse<TenderListResponse>> {
  return apiRequest(apiClient.get('/tenders/recommended', { params }));
}

/** Open tenders closing within the expiring-soon window, nearest deadline first. */
export function getExpiringTenders(
  params: TenderListParams = {},
): Promise<ApiResponse<TenderListResponse>> {
  return apiRequest(apiClient.get('/tenders/expiring', { params }));
}
