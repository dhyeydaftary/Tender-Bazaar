import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EligibilityResult {
  id: string;
  tenderId: string;
  tenderTitle: string;
  overallScore: number;
  criteria: EligibilityCriterion[];
  recommendation: string;
  checkedAt: string;
}

export interface EligibilityCriterion {
  name: string;
  required: string;
  actual: string;
  met: boolean;
  score: number;
  notes?: string;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function checkEligibility(
  tenderId: string,
): Promise<ApiResponse<EligibilityResult>> {
  return apiRequest(apiClient.post(`/eligibility/check/${tenderId}`));
}

export function getEligibilityHistory(): Promise<
  ApiResponse<EligibilityResult[]>
> {
  return apiRequest(apiClient.get('/eligibility/history'));
}
