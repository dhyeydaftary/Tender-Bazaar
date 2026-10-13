import api, { unwrap, unwrapWithMeta } from './api';
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
  PlatformAnalytics,
  SearchTrends,
  TenderAnalyticsData,
  RevenueReportData,
  UserReportData,
  TenderReportData,
  SubscriptionReportData,
  AuditLogRecord,
  AuditLogStats,
  AuditLogListResponse,
  BroadcastRecord,
  BroadcastStats,
  BroadcastListResponse,
  ContentStats,
  BlogPostRecord,
  AnnouncementRecord,
  BannerRecord,
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

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  return unwrap<PlatformAnalytics>(api.get('/admin/analytics'));
}

export async function getSearchTrends(): Promise<SearchTrends> {
  return unwrap<SearchTrends>(api.get('/admin/analytics/search-trends'));
}

export async function getTenderAnalytics(period: Period = '30d'): Promise<TenderAnalyticsData> {
  return unwrap<TenderAnalyticsData>(api.get('/admin/analytics/tenders', { params: { period } }));
}

export async function getRevenueAnalytics(period: Period = '30d') {
  return unwrap(api.get('/admin/analytics/revenue', { params: { period } }));
}

export async function getUserGrowthAnalytics(period: Period = '30d') {
  return unwrap(api.get('/admin/analytics/user-growth', { params: { period } }));
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function getRevenueReport(params: { startDate?: string; endDate?: string } = {}): Promise<RevenueReportData> {
  return unwrap<RevenueReportData>(api.get('/admin/reports/revenue', { params }));
}

export async function getUserReport(params: { startDate?: string; endDate?: string } = {}): Promise<UserReportData> {
  return unwrap<UserReportData>(api.get('/admin/reports/users', { params }));
}

export async function getTenderReport(params: { startDate?: string; endDate?: string } = {}): Promise<TenderReportData> {
  return unwrap<TenderReportData>(api.get('/admin/reports/tenders', { params }));
}

export async function getSubscriptionReport(params: { startDate?: string; endDate?: string } = {}): Promise<SubscriptionReportData> {
  return unwrap<SubscriptionReportData>(api.get('/admin/reports/subscriptions', { params }));
}

export async function exportReport(
  reportType: 'revenue' | 'users' | 'tenders' | 'subscriptions',
  filters: { startDate?: string; endDate?: string } = {},
) {
  return unwrap(api.post('/admin/reports/export', { reportType, ...filters }));
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<AuditLogListResponse> {
  const res = await unwrapWithMeta<AuditLogRecord[]>(api.get('/admin/audit-logs', { params }));
  return {
    logs: res.data,
    total: res.meta?.total ?? res.data.length,
    page: res.meta?.page ?? (params.page || 1),
    limit: res.meta?.limit ?? (params.limit || 10),
  };
}

export async function getAuditLogStats(): Promise<AuditLogStats> {
  return unwrap<AuditLogStats>(api.get('/admin/audit-logs/stats'));
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

// ---------------------------------------------------------------------------
// Broadcast Notifications
// ---------------------------------------------------------------------------

export async function getBroadcastStats(): Promise<BroadcastStats> {
  return unwrap<BroadcastStats>(api.get('/admin/notifications/broadcasts/stats'));
}

export async function getBroadcastList(params: {
  page?: number;
  limit?: number;
  search?: string;
  channel?: string;
  status?: string;
  sortOrder?: string;
} = {}): Promise<BroadcastListResponse> {
  const res = await unwrapWithMeta<BroadcastRecord[]>(api.get('/admin/notifications/broadcasts', { params }));
  return {
    broadcasts: res.data || [],
    total: res.meta?.total || 0,
    page: res.meta?.page || 1,
    limit: res.meta?.limit || 10,
  };
}

export async function getAudienceEstimate(target: string): Promise<{ target: string; count: number }> {
  return unwrap<{ target: string; count: number }>(
    api.get('/admin/notifications/broadcasts/audience', { params: { target } }),
  );
}

export async function sendBroadcast(payload: {
  title: string;
  message: string;
  channel: string;
  target?: string;
}): Promise<any> {
  return unwrap(api.post('/admin/notifications/broadcast', payload));
}

// ---------------------------------------------------------------------------
// Content Management
// ---------------------------------------------------------------------------

export async function getContentStats(): Promise<ContentStats> {
  return unwrap<ContentStats>(api.get('/admin/content/stats'));
}

export async function getPostList(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
} = {}): Promise<{ posts: BlogPostRecord[]; total: number; page: number; limit: number }> {
  const res = await unwrapWithMeta<BlogPostRecord[]>(api.get('/admin/content/posts', { params }));
  return {
    posts: res.data || [],
    total: res.meta?.total || 0,
    page: res.meta?.page || 1,
    limit: res.meta?.limit || 10,
  };
}

export async function createPost(data: Partial<BlogPostRecord>): Promise<BlogPostRecord> {
  return unwrap<BlogPostRecord>(api.post('/admin/content/posts', data));
}

export async function updatePost(id: string, data: Partial<BlogPostRecord>): Promise<BlogPostRecord> {
  return unwrap<BlogPostRecord>(api.patch(`/admin/content/posts/${id}`, data));
}

export async function deletePost(id: string): Promise<any> {
  return unwrap(api.delete(`/admin/content/posts/${id}`));
}

export async function getAnnouncementList(params: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  sortOrder?: string;
} = {}): Promise<{ announcements: AnnouncementRecord[]; total: number; page: number; limit: number }> {
  const res = await unwrapWithMeta<AnnouncementRecord[]>(api.get('/admin/content/announcements', { params }));
  return {
    announcements: res.data || [],
    total: res.meta?.total || 0,
    page: res.meta?.page || 1,
    limit: res.meta?.limit || 10,
  };
}

export async function createAnnouncement(data: Partial<AnnouncementRecord>): Promise<AnnouncementRecord> {
  return unwrap<AnnouncementRecord>(api.post('/admin/content/announcements', data));
}

export async function updateAnnouncement(id: string, data: Partial<AnnouncementRecord>): Promise<AnnouncementRecord> {
  return unwrap<AnnouncementRecord>(api.patch(`/admin/content/announcements/${id}`, data));
}

export async function deleteAnnouncement(id: string): Promise<any> {
  return unwrap(api.delete(`/admin/content/announcements/${id}`));
}

export async function getBannerList(params: {
  page?: number;
  limit?: number;
  status?: string;
  position?: string;
  sortOrder?: string;
} = {}): Promise<{ banners: BannerRecord[]; total: number; page: number; limit: number }> {
  const res = await unwrapWithMeta<BannerRecord[]>(api.get('/admin/content/banners', { params }));
  return {
    banners: res.data || [],
    total: res.meta?.total || 0,
    page: res.meta?.page || 1,
    limit: res.meta?.limit || 10,
  };
}

export async function createBanner(data: Partial<BannerRecord>): Promise<BannerRecord> {
  return unwrap<BannerRecord>(api.post('/admin/content/banners', data));
}

export async function updateBanner(id: string, data: Partial<BannerRecord>): Promise<BannerRecord> {
  return unwrap<BannerRecord>(api.patch(`/admin/content/banners/${id}`, data));
}

export async function deleteBanner(id: string): Promise<any> {
  return unwrap(api.delete(`/admin/content/banners/${id}`));
}

