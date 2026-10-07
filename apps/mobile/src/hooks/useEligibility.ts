import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as eligibilityApi from '@/services/api/eligibility';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const eligibilityKeys = {
  all: ['eligibility'] as const,
  history: () => [...eligibilityKeys.all, 'history'] as const,
  check: (tenderId: string) =>
    [...eligibilityKeys.all, 'check', tenderId] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Run an AI eligibility check for a specific tender.
 * Uses a mutation since this is a write-like operation (costs quota).
 * On success, invalidates the eligibility history so it stays current.
 */
export function useCheckEligibility(tenderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: eligibilityKeys.check(tenderId),
    mutationFn: async () => {
      const res = await eligibilityApi.checkEligibility(tenderId);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.history() });
    },
  });
}

/**
 * Fetch the user's past eligibility check results.
 */
export function useEligibilityHistory() {
  return useQuery({
    queryKey: eligibilityKeys.history(),
    queryFn: async () => {
      const res = await eligibilityApi.getEligibilityHistory();
      return res.data!;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
