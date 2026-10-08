// ---------------------------------------------------------------------------
// Admin API Response Types — aligned with backend services
// ---------------------------------------------------------------------------

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  users: {
    total: number;
    newThisWeek: number;
    weekOverWeekChange: number;
  };
  subscriptions: {
    active: number;
    byPlan: { plan: string; slug: string; count: number }[];
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    thisYear: number;
    mrr: number;
    monthOverMonthChange: number;
  };
  tenders: {
    total: number;
    addedToday: number;
    addedYesterday: number;
    addedThisWeek: number;
    todayVsYesterday: number;
  };
  totalPayments: number;
  topKeywords: { keyword: string; score: number }[];
}

export interface ChartDataPoint {
  date: string;
  amount?: number;
  count?: number;
}

export interface DashboardCharts {
  revenue: { date: string; amount: number }[];
  users: { date: string; count: number }[];
  tenders: { date: string; count: number }[];
}

export interface RecentSignup {
  id: string;
  name: string;
  email: string;
  plan: string;
  company: string | null;
  joined: string;
}

// ── Subscription Analytics ─────────────────────────────────────────────────

export interface SubscriptionStats {
  active: number;
  expired: number;
  cancelled: number;
  total: number;
  planDistribution: { plan: string; slug: string; count: number }[];
  billingCycleDistribution: { cycle: string; count: number }[];
  expiringNext7Days: number;
  mrr: number;
  arr: number;
  recentCancellations: {
    id: string;
    userName: string;
    userEmail: string;
    plan: string;
    cancelledAt: string;
  }[];
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  plan: string;
  planSlug: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  aiChecksUsed: number;
  lifetimeAiChecksUsed: number;
  savedTendersCount: number;
  alertsCreatedCount: number;
  amount: number;
  createdAt: string;
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  plan: string | null;
  planSlug: string | null;
  status: string;
  company: string | null;
}

export interface UserListResponse {
  users: UserRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Scrapers ───────────────────────────────────────────────────────────────

export interface ScraperHealth {
  id: string;
  name: string;
  portal: string;
  status: 'healthy' | 'slow' | 'error' | 'offline';
  lastRun: string | null;
  successRate: number;
  tendersScraped: number;
  avgDuration: number;
}

/** Prisma `ScraperHealthStatus`. */
export type ScraperHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DISABLED';

/** Prisma `ScrapingRunStatus`. */
export type ScrapingRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * One row from `GET /api/v1/admin/scrapers/:portalName/runs` — a full
 * `ScrapingRun`. Dates arrive as ISO strings, not Date objects.
 */
export interface ScraperRun {
  id: string;
  portalName: string;
  status: ScrapingRunStatus;
  /** 'schedule' | 'manual' | 'retry' — a free-text column, not an enum. */
  triggeredBy: string;
  priority: number;
  startedAt: string | null;
  completedAt: string | null;
  /** Milliseconds; null while the run is still in flight. */
  duration: number | null;
  totalFound: number;
  newTenders: number;
  updatedTenders: number;
  duplicates: number;
  errors: number;
  pagesScraped: number;
  maxPages: number | null;
  errorMessage: string | null;
  errorStack: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * The `latestRun` object embedded in each `GET /api/v1/admin/scrapers` entry.
 *
 * A strict subset of {@link ScraperRun}: the backend projects only these
 * columns, so anything outside this list (maxPages, errorMessage, createdAt…)
 * must be read from the runs endpoint instead.
 */
export type ScraperLatestRun = Pick<
  ScraperRun,
  | 'id'
  | 'portalName'
  | 'status'
  | 'triggeredBy'
  | 'totalFound'
  | 'newTenders'
  | 'updatedTenders'
  | 'duplicates'
  | 'pagesScraped'
  | 'errors'
  | 'duration'
  | 'startedAt'
  | 'completedAt'
>;

/**
 * One entry of `GET /api/v1/admin/scrapers` — a `ScraperHealth` row plus its
 * most recent run. `portalName` is the authoritative portal identifier and is
 * what the trigger and runs endpoints expect, case-sensitively.
 */
export interface ScraperHealthEntry {
  id: string;
  portalName: string;
  status: ScraperHealthStatus;
  enabled: boolean;
  cronExpression: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalRuns: number;
  totalSuccessRuns: number;
  totalFailedRuns: number;
  consecutiveFailures: number;
  totalTendersFound: number;
  totalTendersNew: number;
  avgDurationMs: number;
  errorRate: number;
  lastError: string | null;
  /** null when the portal has never run. */
  latestRun: ScraperLatestRun | null;
  createdAt: string;
  updatedAt: string;
}

// ── Plan Config ────────────────────────────────────────────────────────────

export interface PlanConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
  activeSubscriptions: number;
}

// ── Shared ─────────────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | '1y';
