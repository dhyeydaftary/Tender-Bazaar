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
  | 'createdAt'
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
  /** Outcomes counted from ScrapingRun records (authoritative). */
  runStats: ScraperRunStats;
  createdAt: string;
  updatedAt: string;
}

/** Per-portal run outcomes; `completedWithErrors` is a subset of `completed`. */
export interface ScraperRunStats {
  total: number;
  completed: number;
  completedWithErrors: number;
  failed: number;
  cancelled: number;
  inProgress: number;
}

/**
 * GET /admin/scrapers/engine — which scraper engine answers the API server.
 * `mode: 'demo'` means runs are simulated and no external portal is contacted.
 */
export interface ScraperEngineStatus {
  reachable: boolean;
  mode: 'demo' | 'live' | 'unknown';
  simulated: boolean;
  schedulerRunning: boolean | null;
  enabledPortals: number | null;
  notice: string | null;
  url: string;
  checkedAt: string;
}

/** POST /admin/scrapers/:portalName/trigger */
export interface TriggerScraperResult {
  message: string;
  jobId: string | null;
  registryKey: string;
  portalName: string;
  simulated: boolean;
  dispatch: 'engine' | 'queue';
  triggeredBy: string;
  triggeredAt: string;
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

// ── Analytics ──────────────────────────────────────────────────────────────

export interface PlatformAnalytics {
  mostViewedTenders: {
    id: string;
    title: string;
    organization: string;
    viewCount: number;
    category: string;
    state: string;
    estimatedValue: number;
  }[];
  mostSavedTenders: {
    id: string;
    title: string;
    organization: string;
    category: string;
    state: string;
    savedCount: number;
  }[];
  tendersByCategory: {
    category: string;
    count: number;
    avgValue: number;
  }[];
  tendersByState: {
    state: string;
    count: number;
  }[];
  tendersByPortal: {
    portal: string;
    count: number;
  }[];
  usersByState: {
    state: string;
    count: number;
  }[];
}

export interface SearchTrends {
  topSearches: { query: string; count: number }[];
  trendingSearches: { query: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
  totalSearches: number;
  redisKeywords: { keyword: string; score: number }[];
}

export interface TenderAnalyticsData {
  totalAdded: number;
  totalValue: number;
  dailyTenders: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
}

// ── Reports ────────────────────────────────────────────────────────────────

export interface RevenueReportData {
  totalRevenue: number;
  transactionCount: number;
  mrr: number;
  arr: number;
  dailyRevenue: { date: string; amount: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  planBreakdown: { plan: string; amount: number; count: number }[];
  cycleBreakdown: { cycle: string; amount: number; count: number }[];
  payments?: {
    id: string;
    userName: string;
    userEmail: string;
    plan: string;
    cycle: string;
    amount: number;
    currency: string;
    status: string;
    gateway: string;
    date: string;
  }[];
  dateRange: { start: string; end: string };
}

export interface UserReportData {
  totalUsers: number;
  totalNewUsers?: number;
  verifiedUsers: number;
  verificationRate: number;
  monthlySignups: { month: string; count: number }[];
  roleDistribution: { role: string; count: number }[];
  byRole?: { role: string; count: number }[];
  users?: {
    id: string;
    name: string;
    email: string;
    role: string;
    isEmailVerified: boolean;
    createdAt: string;
  }[];
  dateRange: { start: string; end: string };
}

export interface TenderReportData {
  totalTenders: number;
  totalEstimatedValue: number;
  totalViews: number;
  monthlyTenders: { month: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byPortal: { portal: string; count: number }[];
  tenders?: {
    id: string;
    referenceNumber: string | null;
    title: string;
    organization: string;
    category: string;
    state: string | null;
    status: string;
    sourcePortal: string;
    estimatedValue: number | null;
    bidSubmissionDeadline: string | null;
    viewCount: number;
    createdAt: string;
  }[];
  dateRange: { start: string; end: string };
}

export interface SubscriptionReportData {
  totalSubscriptions: number;
  monthlySubscriptions: { month: string; count: number }[];
  byPlan: { plan: string; count: number }[];
  byStatus: { status: string; count: number }[];
  subscriptions?: {
    id: string;
    userName: string;
    userEmail: string;
    plan: string;
    cycle: string;
    status: string;
    startDate: string;
    endDate: string;
  }[];
  churnRate: number;
  dateRange: { start: string; end: string };
}

// ── Audit Logs ─────────────────────────────────────────────────────────────

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: {
    ipAddress?: string;
    details?: string;
    userAgent?: string;
    [key: string]: unknown;
  } | null;
  createdAt: string;
}

export interface AuditLogStats {
  totalLogs: number;
  logsLast24h: number;
  logsLast7d: number;
  byAction: { action: string; count: number }[];
  byEntity: { entity: string; count: number }[];
}

export interface AuditLogListResponse {
  logs: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Broadcast Notifications ────────────────────────────────────────────────

export interface BroadcastRecord {
  id: string;
  title: string;
  message: string;
  channel: 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS' | 'IN_APP';
  target: 'ALL' | 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'DELIVERED' | 'PENDING' | 'FAILED';
  delivered: number;
  failed: number;
  opened: number;
  sentAt: string;
  createdAt?: string;
}

export interface BroadcastStats {
  totalBroadcasts: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  openRate: number;
}

export interface BroadcastListResponse {
  broadcasts: BroadcastRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Content Management ─────────────────────────────────────────────────────

export interface ContentStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  activeAnnouncements: number;
  totalAnnouncements: number;
  activeBanners: number;
  totalBanners: number;
  totalViews: number;
  totalLikes: number;
}

export interface BlogPostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorId: string;
  authorName: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  views: number;
  likes: number;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  targetAudience: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPinned: boolean;
  startDate: string | null;
  endDate: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BannerRecord {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  description: string | null;
  position: string;
  priority: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  startDate: string | null;
  endDate: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  impressions?: number;
  clicks?: number;
  ctaText?: string;
}

// ── Tenders (Admin) ────────────────────────────────────────────────────────

export interface TenderAdminRecord {
  id: string;
  title: string;
  referenceNumber: string;
  organization: string;
  department: string | null;
  tenderType: string;
  category: string;
  status: 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'CORRIGENDUM';
  state: string;
  district: string | null;
  estimatedValue: number | null;
  emdAmount: number | null;
  publishedDate: string;
  bidSubmissionDeadline: string;
  bidOpeningDate: string | null;
  sourcePortal: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: string;
  _count?: {
    savedBy: number;
    eligibilityChecks: number;
    documents: number;
  };
}

export interface TenderListResponse {
  tenders: TenderAdminRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface TenderStats {
  total: number;
  active: number;
  closed: number;
  addedThisMonth: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byState: { state: string; count: number }[];
  byPortal: { sourcePortal: string; count: number }[];
  avgValue: {
    _avg: { estimatedValue: number | null };
    _max: { estimatedValue: number | null };
    _min: { estimatedValue: number | null };
  };
}

// ── Support Tickets (Admin) ────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'Billing' | 'Technical' | 'Scraper Issue' | 'Account' | 'Feature Request' | 'Bug Report' | string;

export interface SupportTicketUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subscription?: {
    plan?: { name: string };
    status?: string;
  } | null;
}

export interface SupportMessageRecord {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  message: string;
  attachments?: string[];
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: SupportTicketUser;
  userPlan?: string;
  lastMessage?: string;
  messageCount?: number;
  messages?: SupportMessageRecord[];
}

export interface SupportTicketStats {
  total: number;
  byStatus: {
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    closed: number;
  };
  resolvedToday: number;
  newLast24h: number;
  newLast7d: number;
  byPriority: Array<{ priority: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  avgResolutionHours: number;
  csatScore: number;
}

