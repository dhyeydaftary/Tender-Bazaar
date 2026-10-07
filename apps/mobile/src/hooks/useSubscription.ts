import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as subscriptionApi from '@/services/api/subscription';
import type {
  VerifyPaymentData,
  SubscriptionPlan,
  SubscriptionData,
  UsageStat,
  Invoice,
  ProrationPreview,
} from '@/services/api/subscription';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const subscriptionKeys = {
  all: ['subscription'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  usage: () => [...subscriptionKeys.all, 'usage'] as const,
  invoices: () => [...subscriptionKeys.all, 'invoices'] as const,
};

// ─── Plan Hooks ────────────────────────────────────────────────────────────

/**
 * Fetch all available subscription plans.
 * Plans rarely change, so a long staleTime is appropriate.
 */
export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: async () => {
      const res = await subscriptionApi.getPlans();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to load plans');
      }
      return res.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Fetch the current user's subscription + plan info.
 */
export function useCurrentSubscription() {
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async () => {
      const res = await subscriptionApi.getCurrentSubscription();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to load subscription');
      }
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Fetch usage statistics.
 */
export function useUsageStats() {
  return useQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: async () => {
      const res = await subscriptionApi.getUsageStats();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to load usage stats');
      }
      return res.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch invoices (payment history).
 */
export function useInvoices() {
  return useQuery({
    queryKey: subscriptionKeys.invoices(),
    queryFn: async () => {
      const res = await subscriptionApi.getInvoices();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to load invoices');
      }
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────────────────

/**
 * Create a Razorpay checkout session for a given plan.
 */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({
      planSlug,
      billingCycle,
    }: {
      planSlug: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
    }) =>
      subscriptionApi
        .createCheckout(planSlug, billingCycle)
        .then((res) => {
          if (!res.success || !res.data) {
            throw new Error(res.error?.message || 'Failed to create checkout');
          }
          return res.data;
        }),
  });
}

/**
 * Preview plan change with proration details.
 */
export function usePreviewPlanChange() {
  return useMutation({
    mutationFn: ({
      planSlug,
      billingCycle,
    }: {
      planSlug: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
    }) =>
      subscriptionApi
        .previewPlanChange(planSlug, billingCycle)
        .then((res) => {
          if (!res.success || !res.data) {
            throw new Error(res.error?.message || 'Failed to load pricing preview');
          }
          return res.data;
        }),
  });
}

/**
 * Verify a Razorpay payment after the user completes checkout.
 * On success, invalidates subscription queries so the UI reflects the upgrade.
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyPaymentData) =>
      subscriptionApi.verifyPayment(data).then((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.error?.message || 'Payment verification failed');
        }
        return res.data;
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.invoices() });
    },
  });
}

/**
 * Cancel the current subscription.
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reason,
      cancelImmediately = false,
    }: {
      reason?: string;
      cancelImmediately?: boolean;
    }) =>
      subscriptionApi
        .cancelSubscription(reason, cancelImmediately)
        .then((res) => {
          if (!res.success) {
            throw new Error(res.error?.message || 'Failed to cancel subscription');
          }
          return res.data;
        }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
    },
  });
}

// ─── Backward Compat ──────────────────────────────────────────────────────

/** @deprecated Use useCurrentSubscription instead */
export const useCurrentPlan = useCurrentSubscription;
