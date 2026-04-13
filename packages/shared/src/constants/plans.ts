/**
 * Subscription plan definitions — single source of truth.
 * Matches the SubscriptionPlan model in prisma/schema.prisma exactly.
 * -1 means unlimited for numeric limits.
 */
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    slug: 'free',
    description: 'Get started with basic tender discovery',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    tenderViewsPerPage: 20,
    paginationAllowed: false,
    advancedFilters: false,
    maxAlerts: 0,
    emailAlerts: false,
    pushAlerts: false,
    whatsappAlerts: false,
    corrigendumAlerts: false,
    maxAiChecks: 1,
    aiChecksResetMonthly: false,
    aiTenderSummary: false,
    aiBidAssistant: 'none' as const,
    tenderComparison: false,
    maxComparisonTenders: 0,
    aiMatching: 'none' as const,
    competitorAnalysis: false,
    maxSavedTenders: 0,
    documentDownload: false,
    bulkDownload: false,
    exportEnabled: false,
    tenderCalendar: false,
    multiLanguage: false,
    maxTeamMembers: 1,
    eTenderingSupport: false,
    dedicatedManager: false,
    supportLevel: 'help_center' as const,
    isPopular: false,
    displayOrder: 0,
  },
  starter: {
    name: 'Starter',
    slug: 'starter',
    description: 'For small businesses starting with government tenders',
    monthlyPrice: 1499,
    yearlyPrice: 14999,
    currency: 'INR',
    tenderViewsPerPage: -1,
    paginationAllowed: true,
    advancedFilters: true,
    maxAlerts: 5,
    emailAlerts: true,
    pushAlerts: true,
    whatsappAlerts: false,
    corrigendumAlerts: false,
    maxAiChecks: 10,
    aiChecksResetMonthly: true,
    aiTenderSummary: true,
    aiBidAssistant: 'none' as const,
    tenderComparison: false,
    maxComparisonTenders: 0,
    aiMatching: 'basic' as const,
    competitorAnalysis: false,
    maxSavedTenders: 50,
    documentDownload: true,
    bulkDownload: false,
    exportEnabled: false,
    tenderCalendar: true,
    multiLanguage: false,
    maxTeamMembers: 1,
    eTenderingSupport: false,
    dedicatedManager: false,
    supportLevel: 'email' as const,
    isPopular: false,
    displayOrder: 1,
  },
  professional: {
    name: 'Professional',
    slug: 'professional',
    description: 'For growing businesses serious about winning tenders',
    monthlyPrice: 4999,
    yearlyPrice: 49999,
    currency: 'INR',
    tenderViewsPerPage: -1,
    paginationAllowed: true,
    advancedFilters: true,
    maxAlerts: 25,
    emailAlerts: true,
    pushAlerts: true,
    whatsappAlerts: true,
    corrigendumAlerts: true,
    maxAiChecks: 50,
    aiChecksResetMonthly: true,
    aiTenderSummary: true,
    aiBidAssistant: 'basic' as const,
    tenderComparison: true,
    maxComparisonTenders: 3,
    aiMatching: 'basic' as const,
    competitorAnalysis: false,
    maxSavedTenders: -1,
    documentDownload: true,
    bulkDownload: true,
    exportEnabled: true,
    tenderCalendar: true,
    multiLanguage: true,
    maxTeamMembers: 3,
    eTenderingSupport: false,
    dedicatedManager: false,
    supportLevel: 'email_chat' as const,
    isPopular: true,
    displayOrder: 2,
  },
  enterprise: {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations needing full-scale tender management',
    monthlyPrice: 9999,
    yearlyPrice: 99999,
    currency: 'INR',
    tenderViewsPerPage: -1,
    paginationAllowed: true,
    advancedFilters: true,
    maxAlerts: -1,
    emailAlerts: true,
    pushAlerts: true,
    whatsappAlerts: true,
    corrigendumAlerts: true,
    maxAiChecks: -1,
    aiChecksResetMonthly: true,
    aiTenderSummary: true,
    aiBidAssistant: 'advanced' as const,
    tenderComparison: true,
    maxComparisonTenders: 5,
    aiMatching: 'advanced' as const,
    competitorAnalysis: true,
    maxSavedTenders: -1,
    documentDownload: true,
    bulkDownload: true,
    exportEnabled: true,
    tenderCalendar: true,
    multiLanguage: true,
    maxTeamMembers: 5,
    eTenderingSupport: true,
    dedicatedManager: true,
    supportLevel: 'priority_phone' as const,
    isPopular: false,
    displayOrder: 3,
  },
} as const;

export type PlanSlug = keyof typeof SUBSCRIPTION_PLANS;

/** GST rate applied to all paid plans */
export const GST_RATE = 0.18;

/** Calculate total amount including GST */
export function calculatePriceWithGST(basePrice: number): {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
} {
  const gstAmount = Math.round(basePrice * GST_RATE * 100) / 100;
  return {
    baseAmount: basePrice,
    gstAmount,
    totalAmount: basePrice + gstAmount,
  };
}

/** Boolean features that can be checked with hasFeature() */
export type BooleanFeature =
  | 'paginationAllowed'
  | 'advancedFilters'
  | 'emailAlerts'
  | 'pushAlerts'
  | 'whatsappAlerts'
  | 'corrigendumAlerts'
  | 'aiChecksResetMonthly'
  | 'aiTenderSummary'
  | 'tenderComparison'
  | 'competitorAnalysis'
  | 'documentDownload'
  | 'bulkDownload'
  | 'exportEnabled'
  | 'tenderCalendar'
  | 'multiLanguage'
  | 'eTenderingSupport'
  | 'dedicatedManager';

/** Numeric limits that can be checked with checkLimit() */
export type NumericLimit =
  | 'maxAlerts'
  | 'maxAiChecks'
  | 'maxSavedTenders'
  | 'maxComparisonTenders'
  | 'maxTeamMembers'
  | 'tenderViewsPerPage';
