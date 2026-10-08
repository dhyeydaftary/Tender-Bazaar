import api, { unwrap } from './api';
import type {
  DashboardStats,
  DashboardCharts,
  RecentSignup,
  SubscriptionStats,
  SubscriptionListResponse,
  UserListResponse,
  PlanConfig,
  Period,
  ScraperHealthEntry,
  ScraperRun,
} from './types';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  return unwrap<DashboardStats>(api.get('/admin/dashboard'));
}

export async function getDashboardCharts(period: Period = '30d'): Promise<DashboardCharts> {
  return unwrap<DashboardCharts>(api.get('/admin/dashboard/charts', { params: { period } }));
}

export async function getRecentSignups(limit = 10): Promise<RecentSignup[]> {
  return unwrap<RecentSignup[]>(api.get('/admin/dashboard/recent-signups', { params: { limit } }));
}

// ---------------------------------------------------------------------------
// Subscription Analytics
// ---------------------------------------------------------------------------

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  return unwrap<SubscriptionStats>(api.get('/admin/subscriptions/stats'));
}

export async function getSubscriptionList(params: {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  status?: string;
  billingCycle?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<SubscriptionListResponse> {
  return unwrap<SubscriptionListResponse>(api.get('/admin/subscriptions', { params }));
}

export async function getExpiringSubscriptions(): Promise<SubscriptionListResponse> {
  // Subscriptions expiring in the next 7 days
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return unwrap<SubscriptionListResponse>(
    api.get('/admin/subscriptions', {
      params: {
        status: 'ACTIVE',
        sortBy: 'endDate',
        sortOrder: 'asc',
        limit: 20,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Plan Management
// ---------------------------------------------------------------------------

export async function getPlans(): Promise<PlanConfig[]> {
  return unwrap<PlanConfig[]>(api.get('/admin/subscriptions/plans'));
}

export async function updatePlan(
  planId: string,
  data: Partial<PlanConfig>,
): Promise<{ plan: PlanConfig; changes: Record<string, { old: unknown; new: unknown }> }> {
  return unwrap(api.patch(`/admin/subscriptions/plans/${planId}`, data));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUserList(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  plan?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<UserListResponse> {
  return unwrap<UserListResponse>(api.get('/admin/users', { params }));
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getRevenueAnalytics(period: Period = '30d') {
  return unwrap(api.get('/admin/analytics/revenue', { params: { period } }));
}

export async function getUserGrowthAnalytics(period: Period = '30d') {
  return unwrap(api.get('/admin/analytics/user-growth', { params: { period } }));
}

// ---------------------------------------------------------------------------
// Scrapers
// ---------------------------------------------------------------------------

/**
 * All registered scraper portals with their health and most recent run.
 *
 * This is the authoritative portal list — 13 entries, ordered by portalName.
 * `portalName` is the exact identifier the trigger and runs endpoints expect
 * (case-sensitive: 'TamilNadu', not 'Tamil Nadu'), so callers must pass it
 * through verbatim rather than deriving a display name from it.
 */
export async function getScraperHealth(): Promise<ScraperHealthEntry[]> {
  return unwrap<ScraperHealthEntry[]>(api.get('/admin/scrapers'));
}

/**
 * Paginated run history for one portal.
 *
 * `portalName` must be the exact ScraperHealth.portalName; the backend looks
 * the portal up by that value and returns 404 for anything else. `limit` is
 * capped at 100 server-side.
 *
 * The endpoint also returns the scraper's health row under `meta.scraper`,
 * which `unwrap` discards — use getScraperHealth() when that is needed.
 */
export async function getScraperRuns(
  portalName: string,
  params: { page?: number; limit?: number } = {},
): Promise<ScraperRun[]> {
  return unwrap<ScraperRun[]>(
    api.get(`/admin/scrapers/${encodeURIComponent(portalName)}/runs`, { params }),
  );
}

/**
 * Trigger a real scraping run for one portal.
 *
 * `portalName` must be the exact ScraperHealth.portalName the backend registers
 * (e.g. 'GeM', 'CPPP', 'Maharashtra') — the endpoint looks the portal up by that
 * value and returns 404 for anything else.
 *
 * The backend queues the run and returns immediately; it does not wait for the
 * scrape to finish. Callers should refetch getScraperHealth() to read real
 * results rather than predicting them.
 */
export async function triggerScraper(portalName: string) {
  return unwrap(api.post(`/admin/scrapers/${encodeURIComponent(portalName)}/trigger`));
}
