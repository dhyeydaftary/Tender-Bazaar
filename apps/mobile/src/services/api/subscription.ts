import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  supportLevel: string;
  // Display
  isPopular: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  aiChecksUsed: number;
  lifetimeAiChecksUsed: number;
  savedTendersCount: number;
  alertsCreatedCount: number;
  razorpaySubscriptionId?: string;
}

export interface SubscriptionData {
  subscription: Subscription | null;
  plan: SubscriptionPlan;
  isFreePlan: boolean;
}

export interface UsageStat {
  feature: string;
  label: string;
  used: number;
  limit: number;
  resetType: 'monthly' | 'lifetime' | 'cumulative' | 'per_request';
  percentage: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  planName: string;
  planSlug: string;
  billingCycle: string;
  baseAmount: number | null;
  gstAmount: number | null;
  gstRate: number;
  totalAmount: number;
  currency: string;
  status: string;
  razorpayPaymentId: string | null;
  paidAt: string;
  invoiceUrl: string | null;
}

export interface CheckoutSession {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  planName: string;
}

export interface VerifyPaymentData {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ProrationPreview {
  changeType: 'new' | 'upgrade' | 'downgrade' | 'cycle_change' | 'same';
  currentPlan: string;
  currentPlanSlug: string;
  currentBillingCycle: string | null;
  targetPlan: string;
  targetPlanSlug: string;
  targetBillingCycle: string;
  pricing: {
    baseAmount: number;
    gstAmount: number;
    gstRate: number;
    totalBeforeProration: number;
    prorationCredit: number;
    finalAmount: number;
  };
  proration: {
    currentPlan: string;
    daysRemaining: number;
    totalPaid: number;
    credit: number;
  } | null;
  currentSubscriptionEnd: string | null;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

/** Get all active subscription plans */
export function getPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
  return apiRequest(apiClient.get('/plans'));
}

/** Get current user's subscription + plan info */
export function getCurrentSubscription(): Promise<ApiResponse<SubscriptionData>> {
  return apiRequest(apiClient.get('/subscription'));
}

/** Get usage statistics for the current user */
export function getUsageStats(): Promise<ApiResponse<UsageStat[]>> {
  return apiRequest(apiClient.get('/subscription/usage'));
}

/** Get invoices (successful payments) */
export function getInvoices(): Promise<ApiResponse<Invoice[]>> {
  return apiRequest(apiClient.get('/subscription/invoices'));
}

/** Create a Razorpay checkout order */
export function createCheckout(
  planSlug: string,
  billingCycle: 'MONTHLY' | 'YEARLY',
): Promise<ApiResponse<CheckoutSession>> {
  return apiRequest(
    apiClient.post('/subscription/checkout', { planSlug, billingCycle }),
  );
}

/** Preview plan change with proration */
export function previewPlanChange(
  planSlug: string,
  billingCycle: 'MONTHLY' | 'YEARLY',
): Promise<ApiResponse<ProrationPreview>> {
  return apiRequest(
    apiClient.post('/subscription/preview', { planSlug, billingCycle }),
  );
}

/** Verify a Razorpay payment after checkout */
export function verifyPayment(
  data: VerifyPaymentData,
): Promise<ApiResponse<Subscription>> {
  return apiRequest(apiClient.post('/subscription/verify', data));
}

/** Cancel subscription */
export function cancelSubscription(
  reason?: string,
  cancelImmediately: boolean = false,
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest(
    apiClient.post('/subscription/cancel', { reason, cancelImmediately }),
  );
}

/** Switch billing cycle */
export function switchBillingCycle(
  billingCycle: 'MONTHLY' | 'YEARLY',
): Promise<ApiResponse<CheckoutSession>> {
  return apiRequest(
    apiClient.post('/subscription/switch-cycle', { billingCycle }),
  );
}

/** Retry a failed payment */
export function retryPayment(
  paymentId: string,
): Promise<ApiResponse<CheckoutSession>> {
  return apiRequest(
    apiClient.post('/subscription/retry', { paymentId }),
  );
}
