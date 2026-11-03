import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';

// ─── Response Types ─────────────────────────────────────────────────────────

/** Home-page KPIs, computed by the API (GET /dashboard → stats). */
export interface DashboardStats {
  /** Open tenders added today. */
  newToday: number;
  newTodayChangePct: number | null;
  /** Tenders open for bidding (ACTIVE + CORRIGENDUM). */
  activeTenders: number;
  closedTenders: number;
  totalTenders: number;
  activeAddedThisWeek: number;
  /** Tenders the user has saved. */
  savedCount: number;
  savedExpiringSoon: number;
  /** Average AI eligibility score; null until the user has run an AI check. */
  avgAiScore: number | null;
  aiChecksCount: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function getDashboard(): Promise<ApiResponse<DashboardResponse>> {
  return apiRequest(apiClient.get('/dashboard'));
}
