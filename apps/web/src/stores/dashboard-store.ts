'use client';

import { create } from 'zustand';
import api from '@/lib/api';

/* ------------------------------------------------------------------ */
/* Types — mirror GET /api/v1/dashboard                               */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  newToday: number;
  /** Day-over-day change; null when yesterday had no intake to compare against. */
  newTodayChangePct: number | null;
  activeTenders: number;
  activeAddedThisWeek: number;
  savedCount: number;
  savedExpiringSoon: number;
  /** null when the user has run no eligibility checks yet. */
  avgAiScore: number | null;
  aiChecksCount: number;
}

export interface RecommendedTender {
  id: string;
  title: string;
  organization: string;
  category: string;
  state: string;
  estimatedValue: number | null;
  bidSubmissionDeadline: string;
  aiScore: number | null;
  matchReasons: string[];
}

export interface DashboardAlert {
  id: string;
  name: string;
  matchCount: number;
  isActive: boolean;
  lastMatchedAt: string | null;
}

export interface UsageItem {
  feature: string;
  label: string;
  used: number;
  /** -1 means unlimited. */
  limit: number;
  resetType: string;
  percentage: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  resultCount: number | null;
  createdAt: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recommendedTenders: {
    personalised: boolean;
    tenders: RecommendedTender[];
  };
  alerts: DashboardAlert[];
  planUsage: {
    planName: string;
    usage: UsageItem[];
  };
  recentSearches: SearchHistoryItem[];
}

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchDashboard: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * Dashboard figures are aggregate counts that do not change second to second,
 * so a short client-side TTL stops remounts (sidebar navigation, tab focus)
 * from re-requesting on every click. Combined with the single aggregated
 * endpoint this keeps the dashboard well clear of the API rate limit.
 */
const TTL_MS = 60_000;

/** Shared so concurrent callers (page + sidebar badge) issue one request. */
let inFlight: Promise<void> | null = null;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchDashboard: async (options) => {
    const { lastFetchedAt, data } = get();

    if (!options?.force && data && lastFetchedAt && Date.now() - lastFetchedAt < TTL_MS) {
      return;
    }
    if (inFlight) return inFlight;

    set({ isLoading: true, error: null });

    inFlight = (async () => {
      try {
        const res = await api.get('/dashboard');
        set({
          data: res.data.data as DashboardData,
          isLoading: false,
          error: null,
          lastFetchedAt: Date.now(),
        });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message ?? 'Could not load dashboard data';
        set({ isLoading: false, error: message });
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  },
}));
