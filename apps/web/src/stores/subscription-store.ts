'use client';

import { create } from 'zustand';
import api from '@/lib/api';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

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
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  aiChecksUsed: number;
  lifetimeAiChecksUsed: number;
  savedTendersCount: number;
  alertsCreatedCount: number;
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

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

/**
 * Whether the user's entitlements are actually known.
 *
 * `unknown` — not fetched yet.
 * `loaded`  — the API answered; currentPlan/isFreePlan are trustworthy.
 * `error`   — the request failed for a non-auth reason, so the values below
 *             are stale or absent and must NOT be read as "this user is Free".
 */
export type SubscriptionStatus = 'unknown' | 'loaded' | 'error';

interface SubscriptionState {
  // Data
  plans: SubscriptionPlan[];
  currentPlan: SubscriptionPlan | null;
  subscription: Subscription | null;
  isFreePlan: boolean;
  subscriptionStatus: SubscriptionStatus;
  usage: UsageStat[];
  invoices: Invoice[];
  invoiceTotal: number;

  // Loading
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAll: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchInvoices: (page?: number, limit?: number) => Promise<void>;
  reset: () => void;
}

/**
 * Fold a /subscription result into the store.
 *
 * The old code did `isFreePlan: data.isFreePlan !== false` on a `{}` fallback,
 * so ANY failure — a dropped connection, a 500, a timeout — asserted "this user
 * is on Free" and every feature gate started telling a paying customer to
 * upgrade. This keeps the three cases apart:
 *
 *   success  → trust the payload (confirmed Free or confirmed paid)
 *   401      → unchanged behaviour: the user is not authenticated, so Free is
 *              the right answer and the api interceptor is already redirecting
 *   anything else → keep whatever we last knew and mark the data unavailable,
 *              so the UI can say "couldn't check" instead of "upgrade"
 *
 * Note this never *grants* anything: on an error with no prior data,
 * currentPlan stays null and gates still withhold access. The API's
 * requireLimit/requireFeature middleware remains the only authority.
 */
function applySubscriptionResult(
  set: (partial: Partial<SubscriptionState>) => void,
  res: { data?: { data?: any } } | null,
  err: any,
) {
  if (res) {
    const data = res.data?.data || {};
    set({
      subscription: data.subscription ?? null,
      currentPlan: data.plan ?? null,
      isFreePlan: data.isFreePlan !== false,
      subscriptionStatus: 'loaded',
      error: null,
    });
    return;
  }

  if (err?.response?.status === 401) {
    set({
      subscription: null,
      currentPlan: null,
      isFreePlan: true,
      subscriptionStatus: 'loaded',
    });
    return;
  }

  set({
    subscriptionStatus: 'error',
    error: 'Could not verify your subscription. Some features may be unavailable.',
  });
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plans: [],
  currentPlan: null,
  subscription: null,
  isFreePlan: true,
  subscriptionStatus: 'unknown',
  usage: [],
  invoices: [],
  invoiceTotal: 0,
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      let subError: any = null;

      const [plansRes, subRes, usageRes, invoicesRes] = await Promise.all([
        api.get('/plans').catch(() => null),
        api.get('/subscription').catch((err) => {
          subError = err;
          return null;
        }),
        api.get('/subscription/usage').catch(() => null),
        api.get('/subscription/invoices').catch(() => null),
      ]);

      const plans = plansRes?.data?.data || [];
      const usageData = usageRes?.data?.data || [];
      const invoiceData = invoicesRes?.data?.data || [];

      set({
        plans: Array.isArray(plans) ? plans : [],
        usage: Array.isArray(usageData) ? usageData : [],
        invoices: Array.isArray(invoiceData) ? invoiceData : [],
        isLoading: false,
      });

      applySubscriptionResult(set, subRes, subError);
    } catch {
      set({ isLoading: false, error: 'Failed to load subscription data' });
    }
  },

  fetchPlans: async () => {
    try {
      const res = await api.get('/plans');
      set({ plans: res.data?.data || [] });
    } catch {
      // silent
    }
  },

  fetchSubscription: async () => {
    try {
      const res = await api.get('/subscription');
      applySubscriptionResult(set, res, null);
    } catch (err) {
      // Same three-state rule as fetchAll — never downgrade on a transient failure.
      applySubscriptionResult(set, null, err);
    }
  },

  fetchUsage: async () => {
    try {
      const res = await api.get('/subscription/usage');
      set({ usage: res.data?.data || [] });
    } catch {
      // silent
    }
  },

  fetchInvoices: async (page = 1, limit = 10) => {
    try {
      const res = await api.get('/subscription/invoices');
      const data = res.data?.data || [];
      set({
        invoices: Array.isArray(data) ? data : [],
        invoiceTotal: data.length || 0,
      });
    } catch {
      // silent
    }
  },

  reset: () => {
    set({
      plans: [],
      currentPlan: null,
      subscription: null,
      isFreePlan: true,
      subscriptionStatus: 'unknown',
      usage: [],
      invoices: [],
      invoiceTotal: 0,
      isLoading: false,
      error: null,
    });
  },
}));
