import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   COMMON
   ═════���═════════════════════════���═══════════════════════════════ */

const paginationBase = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const periodSchema = z.enum(['7d', '30d', '90d', '1y']).default('30d');

/* ══════════════════════════════��════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */

export const chartQuerySchema = z.object({
  period: periodSchema,
});

export const recentSignupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/* ═════��═════════════════════════════════════════════════════════
   USERS
   ═══════���═══════════════════════════════════════════════════════ */

export const userListQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  plan: z.string().optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateUserBodySchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: z.boolean().optional(),
  planOverride: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const exportUsersQuerySchema = z.object({
  plan: z.string().optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/* ════���═══════════════════════════���══════════════════════════════
   TENDERS
   ═══════════════════════════════════════════════════���═══════════ */

export const tenderListQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  sourcePortal: z.string().optional(),
  category: z.enum(['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY']).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'AWARDED', 'CANCELLED', 'CORRIGENDUM']).optional(),
  state: z.string().optional(),
  sortBy: z.enum(['createdAt', 'publishedDate', 'estimatedValue', 'bidSubmissionDeadline', 'viewCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateTenderBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY']).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'AWARDED', 'CANCELLED', 'CORRIGENDUM']).optional(),
  tenderType: z.enum(['OPEN', 'LIMITED', 'SINGLE', 'TWO_PACKET', 'EOI', 'AUCTION', 'RFP', 'RFQ']).optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
  estimatedValue: z.number().optional(),
  emdAmount: z.number().optional(),
  bidSubmissionDeadline: z.string().datetime().optional(),
  bidOpeningDate: z.string().datetime().optional(),
  preBidMeetingDate: z.string().datetime().optional(),
  reservedForMSME: z.boolean().optional(),
  reservedForStartups: z.boolean().optional(),
});

/* ════��══════════════════════��═══════════════════════════════════
   SUBSCRIPTIONS
   ══════════════════════════���══════════════════════════════���═════ */

export const subscriptionListQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  plan: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE']).optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updatePlanBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice: z.number().min(0).optional(),
  // Tender discovery
  tenderViewsPerPage: z.number().int().optional(),
  paginationAllowed: z.boolean().optional(),
  advancedFilters: z.boolean().optional(),
  // Alerts
  maxAlerts: z.number().int().optional(),
  emailAlerts: z.boolean().optional(),
  pushAlerts: z.boolean().optional(),
  whatsappAlerts: z.boolean().optional(),
  corrigendumAlerts: z.boolean().optional(),
  // AI features
  maxAiChecks: z.number().int().optional(),
  aiChecksResetMonthly: z.boolean().optional(),
  aiTenderSummary: z.boolean().optional(),
  aiBidAssistant: z.enum(['none', 'basic', 'advanced']).optional(),
  tenderComparison: z.boolean().optional(),
  maxComparisonTenders: z.number().int().optional(),
  aiMatching: z.enum(['none', 'basic', 'advanced']).optional(),
  competitorAnalysis: z.boolean().optional(),
  // Save & documents
  maxSavedTenders: z.number().int().optional(),
  documentDownload: z.boolean().optional(),
  bulkDownload: z.boolean().optional(),
  exportEnabled: z.boolean().optional(),
  // Platform features
  tenderCalendar: z.boolean().optional(),
  multiLanguage: z.boolean().optional(),
  // Team & support
  maxTeamMembers: z.number().int().optional(),
  eTenderingSupport: z.boolean().optional(),
  dedicatedManager: z.boolean().optional(),
  supportLevel: z.enum(['help_center', 'email', 'email_chat', 'priority_phone']).optional(),
  // Display
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateSubscriptionBodySchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE']).optional(),
  autoRenew: z.boolean().optional(),
});

/* ═══════════════════════��═══════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════��═══════════ */

export const analyticsQuerySchema = z.object({
  period: periodSchema,
});

/* ══��════════════════════��════════════════════════════════��══════
   SCRAPERS
   ═══════════════════════════════════════════════════════���═══════ */

export const scraperRunsQuerySchema = z.object({
  ...paginationBase,
});

export const updateScraperBodySchema = z.object({
  enabled: z.boolean().optional(),
  cronExpression: z.string().optional(),
});

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ══════════��═════════════════��════════════════════════════��═════ */

export const notificationListQuerySchema = z.object({
  ...paginationBase,
  type: z.enum(['TENDER_ALERT', 'DEADLINE_REMINDER', 'SUBSCRIPTION_EXPIRY', 'NEW_CORRIGENDUM', 'TENDER_RESULT', 'ELIGIBILITY_RESULT', 'SYSTEM']).optional(),
  channel: z.enum(['EMAIL', 'PUSH', 'WHATSAPP', 'SMS', 'IN_APP']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const broadcastNotificationBodySchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  channel: z.enum(['EMAIL', 'PUSH', 'WHATSAPP', 'SMS', 'IN_APP']).default('IN_APP'),
  type: z.enum(['TENDER_ALERT', 'DEADLINE_REMINDER', 'SUBSCRIPTION_EXPIRY', 'NEW_CORRIGENDUM', 'TENDER_RESULT', 'ELIGIBILITY_RESULT', 'SYSTEM']).default('SYSTEM'),
  userFilter: z.object({
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
    planSlug: z.string().optional(),
    state: z.string().optional(),
  }).optional(),
});

/* ═══════════════════════════════���═══════════════════════════════
   CONTENT — Blog Posts
   ═══════════════════════════════════════════════════════════════ */

export const postListQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sortBy: z.enum(['createdAt', 'publishedAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createPostBodySchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1),
  coverImage: z.string().url().optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export const updatePostBodySchema = createPostBodySchema.partial();

/* ═══════════════════════════════════════════════════════════════
   CONTENT — Announcements
   ═══════════════���═══════════════════════════════���═══════════════ */

export const announcementListQuerySchema = z.object({
  ...paginationBase,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createAnnouncementBodySchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  targetAudience: z.enum(['all', 'free', 'paid', 'enterprise']).default('all'),
  isPinned: z.boolean().default(false),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateAnnouncementBodySchema = createAnnouncementBodySchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

/* ═══════════════════════════════════════════════════════════════
   CONTENT — Banners
   ═══════════════════════���════════════════════��══════════════════ */

export const bannerListQuerySchema = z.object({
  ...paginationBase,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  position: z.enum(['top', 'sidebar', 'modal', 'footer']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createBannerBodySchema = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  description: z.string().max(500).optional(),
  position: z.enum(['top', 'sidebar', 'modal', 'footer']).default('top'),
  priority: z.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateBannerBodySchema = createBannerBodySchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

/* ═══════════════════��═══════════════════════════════════════════
   SUPPORT
   ═══════════════════════���═══════════════════════════════════════ */

export const ticketListQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  assignedTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateTicketBodySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
});

export const ticketReplyBodySchema = z.object({
  message: z.string().min(1).max(5000),
});

/* ═══════════════════════════════════════════════════════════════
   REPORTS
   ���══════════════════════════════════════════════════════════════ */

export const reportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['day', 'month', 'plan']).default('month'),
});

export const exportReportBodySchema = z.object({
  reportType: z.enum(['revenue', 'users', 'tenders', 'subscriptions']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOGS
   ════════════════════════���══════════════════════════════════════ */

export const auditLogQuerySchema = z.object({
  ...paginationBase,
  search: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  actorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/* ══════════════════════════��════════════════════════════════════
   SETTINGS
   ════════════════════════════��══════════════════════════════════ */

export const updateSettingsBodySchema = z.object({
  settings: z.array(
    z.object({
      category: z.string().min(1),
      key: z.string().min(1),
      value: z.unknown().transform((v) => v as any),
    }),
  ).min(1),
});
