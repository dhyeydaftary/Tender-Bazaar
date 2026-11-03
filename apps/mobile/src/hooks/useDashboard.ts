import { useQuery } from '@tanstack/react-query';
import * as dashboardApi from '@/services/api/dashboard';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Home-page KPIs (new today, active, saved, AI score) from GET /dashboard.
 * Throws on API failure so the screen can show an error state instead of zeros.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: async () => {
      const res = await dashboardApi.getDashboard();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Could not load dashboard');
      }
      return res.data.stats;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
