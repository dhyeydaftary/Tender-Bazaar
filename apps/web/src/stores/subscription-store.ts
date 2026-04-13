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

interface SubscriptionState {
  // Data
  plans: SubscriptionPlan[];
  currentPlan: SubscriptionPlan | null;
  subscription: Subscription | null;
  isFreePlan: boolean;
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

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plans: [],
  currentPlan: null,
  subscription: null,
  isFreePlan: true,
  usage: [],
  invoices: [],
  invoiceTotal: 0,
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [plansRes, subRes, usageRes, invoicesRes] = await Promise.all([
        api.get('/plans').catch(() => null),
        api.get('/subscription').catch(() => null),
        api.get('/subscription/usage').catch(() => null),
        api.get('/subscription/invoices').catch(() => null),
      ]);

      const plans = plansRes?.data?.data || [];
      const subData = subRes?.data?.data || {};
      const usageData = usageRes?.data?.data || [];
      const invoiceData = invoicesRes?.data?.data || [];

      set({
        plans: Array.isArray(plans) ? plans : [],
        subscription: subData.subscription || null,
        currentPlan: subData.plan || null,
        isFreePlan: subData.isFreePlan !== false,
        usage: Array.isArray(usageData) ? usageData : [],
        invoices: Array.isArray(invoiceData) ? invoiceData : [],
        isLoading: false,
      });
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
      const data = res.data?.data || {};
      set({
        subscription: data.subscription || null,
        currentPlan: data.plan || null,
        isFreePlan: data.isFreePlan !== false,
      });
    } catch {
      // silent
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
      usage: [],
      invoices: [],
      invoiceTotal: 0,
      isLoading: false,
      error: null,
    });
  },
}));
