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
