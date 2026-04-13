export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;

  // Tender discovery
  tenderViewsPerPage: number;
  paginationAllowed: boolean;
  advancedFilters: boolean;

  // Alerts
  maxAlerts: number;
  emailAlerts: boolean;
  pushAlerts: boolean;
  whatsappAlerts: boolean;
  corrigendumAlerts: boolean;

  // AI features
  maxAiChecks: number;
  aiChecksResetMonthly: boolean;
  aiTenderSummary: boolean;
  aiBidAssistant: 'none' | 'basic' | 'advanced';
  tenderComparison: boolean;
  maxComparisonTenders: number;
  aiMatching: 'none' | 'basic' | 'advanced';
  competitorAnalysis: boolean;

  // Save & documents
  maxSavedTenders: number;
  documentDownload: boolean;
  bulkDownload: boolean;
  exportEnabled: boolean;

  // Platform features
  tenderCalendar: boolean;
  multiLanguage: boolean;

  // Team & support
  maxTeamMembers: number;
  eTenderingSupport: boolean;
  dedicatedManager: boolean;
  supportLevel: 'help_center' | 'email' | 'email_chat' | 'priority_phone';

  // Display
  isPopular: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;

  // Usage tracking
  aiChecksUsed: number;
  aiChecksResetDate?: Date;
  lifetimeAiChecksUsed: number;
  savedTendersCount: number;
  alertsCreatedCount: number;

  // Razorpay
  razorpaySubscriptionId?: string;
  razorpayOrderId?: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  baseAmount?: number;
  gstAmount?: number;
  currency: string;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  planSlug?: string;
  billingCycle?: BillingCycle;
  invoiceUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
