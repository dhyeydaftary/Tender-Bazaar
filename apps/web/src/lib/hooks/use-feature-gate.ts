'use client';

import { useMemo } from 'react';
import { useSubscriptionStore, type SubscriptionPlan } from '@/stores/subscription-store';
import { computeLimitState } from '@/lib/limit-state';

/* ------------------------------------------------------------------ */
/* Boolean features                                                   */
/* ------------------------------------------------------------------ */

export type BooleanFeature =
  | 'paginationAllowed'
  | 'advancedFilters'
  | 'emailAlerts'
  | 'pushAlerts'
  | 'whatsappAlerts'
  | 'corrigendumAlerts'
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

/* ------------------------------------------------------------------ */
/* Numeric limits                                                     */
/* ------------------------------------------------------------------ */

export type NumericLimit =
  | 'maxAlerts'
  | 'maxAiChecks'
  | 'maxSavedTenders'
  | 'maxComparisonTenders'
  | 'maxTeamMembers';

/* ------------------------------------------------------------------ */
/* Feature labels for upgrade CTAs                                    */
/* ------------------------------------------------------------------ */

const FEATURE_LABELS: Record<string, string> = {
  paginationAllowed: 'Pagination',
  advancedFilters: 'Advanced Filters',
  emailAlerts: 'Email Alerts',
  pushAlerts: 'Push Notifications',
  whatsappAlerts: 'WhatsApp Alerts',
  corrigendumAlerts: 'Corrigendum Alerts',
  aiTenderSummary: 'AI Tender Summary',
  tenderComparison: 'Tender Comparison',
  competitorAnalysis: 'Competitor Analysis',
  documentDownload: 'Document Download',
  bulkDownload: 'Bulk Download',
  exportEnabled: 'Export to CSV/PDF',
  tenderCalendar: 'Tender Calendar',
  multiLanguage: 'Multi-Language Support',
  eTenderingSupport: 'e-Tendering Support',
  dedicatedManager: 'Dedicated Account Manager',
  maxAlerts: 'Tender Alerts',
  maxAiChecks: 'AI Eligibility Checks',
  maxSavedTenders: 'Saved Tenders',
  maxComparisonTenders: 'Tender Comparison',
  maxTeamMembers: 'Team Members',
};

/** Minimum plan required for each boolean feature */
const MIN_PLAN_FOR_FEATURE: Record<BooleanFeature, string> = {
  paginationAllowed: 'Starter',
  advancedFilters: 'Starter',
  emailAlerts: 'Starter',
  pushAlerts: 'Starter',
  whatsappAlerts: 'Professional',
  corrigendumAlerts: 'Professional',
  aiTenderSummary: 'Starter',
  tenderComparison: 'Professional',
  competitorAnalysis: 'Enterprise',
  documentDownload: 'Starter',
  bulkDownload: 'Professional',
  exportEnabled: 'Professional',
  tenderCalendar: 'Starter',
  multiLanguage: 'Professional',
  eTenderingSupport: 'Enterprise',
  dedicatedManager: 'Enterprise',
};

/* ------------------------------------------------------------------ */
/* Hook: useFeatureGate                                               */
/* ------------------------------------------------------------------ */

export function useFeatureGate(feature: BooleanFeature) {
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);

  return useMemo(() => {
    const hasAccess = currentPlan ? !!(currentPlan as any)[feature] : false;
    const minPlan = MIN_PLAN_FOR_FEATURE[feature] || 'Starter';
    const label = FEATURE_LABELS[feature] || feature;

    return {
      hasAccess,
      // True when entitlements could not be verified. Callers should show a
      // "couldn't check" state rather than an upgrade prompt — the user may
      // well be on a paid plan. hasAccess stays false, so nothing is granted.
      isUnavailable: subscriptionStatus === 'error' && !currentPlan,
      featureName: label,
      requiredPlan: minPlan,
      currentPlan: currentPlan?.name || 'Free',
      currentPlanSlug: currentPlan?.slug || 'free',
    };
  }, [currentPlan, subscriptionStatus, feature]);
}

/* ------------------------------------------------------------------ */
/* Hook: useLimitGate                                                 */
/* ------------------------------------------------------------------ */

export function useLimitGate(limitName: NumericLimit) {
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const usage = useSubscriptionStore((s) => s.usage);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);
  const usageStatus = useSubscriptionStore((s) => s.usageStatus);
  // Used to derive the minimum plan that grants this limit. There is no static
  // map for numeric limits (unlike MIN_PLAN_FOR_FEATURE), and hardcoding one
  // would drift from the real plan data — so it is computed from the plans the
  // API actually returned.
  const plans = useSubscriptionStore((s) => s.plans);

  return useMemo(() => {
    const { status, limit, used, isUnlimited, hasCapacity, remaining, percentage, resetType } =
      computeLimitState({ limitName, currentPlan, usage, subscriptionStatus, usageStatus });
    const label = FEATURE_LABELS[limitName] || limitName;

    return {
      /** Whether the figures below are known yet ('loading' | 'error' | 'ready'). */
      status,
      resetType,
      hasCapacity,
      // Entitlements could not be verified — do not claim the user is out of
      // capacity on their plan when we simply do not know what their plan is.
      isUnavailable: subscriptionStatus === 'error' && !currentPlan,
      isUnlimited,
      limit,
      used,
      remaining,
      percentage,
      featureName: label,
      /**
       * Cheapest plan whose allowance for this limit is non-zero, by
       * displayOrder. `-1` means unlimited and therefore also counts as
       * granting access. Null when the plan list has not loaded, so callers can
       * stay silent instead of naming a plan they cannot verify.
       */
      requiredPlan:
        [...plans]
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .find((p) => {
            const value = (p as any)[limitName] as number | undefined;
            return typeof value === 'number' && value !== 0;
          })?.name ?? null,
      currentPlan: currentPlan?.name || 'Free',
      currentPlanSlug: currentPlan?.slug || 'free',
    };
  }, [currentPlan, usage, subscriptionStatus, usageStatus, limitName, plans]);
}

/* ------------------------------------------------------------------ */
/* Hook: usePlanInfo                                                  */
/* ------------------------------------------------------------------ */

export function usePlanInfo() {
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const isFreePlan = useSubscriptionStore((s) => s.isFreePlan);

  return useMemo(() => ({
    plan: currentPlan,
    planName: currentPlan?.name || 'Free',
    planSlug: currentPlan?.slug || 'free',
    isFreePlan,
    subscription,
    isActive: subscription?.status === 'ACTIVE' || isFreePlan,
    billingCycle: subscription?.billingCycle || null,
    endDate: subscription?.endDate || null,
    autoRenew: subscription?.autoRenew ?? false,
    aiBidAssistant: currentPlan?.aiBidAssistant || 'none',
    aiMatching: currentPlan?.aiMatching || 'none',
    supportLevel: currentPlan?.supportLevel || 'help_center',
  }), [currentPlan, subscription, isFreePlan]);
}

/* ------------------------------------------------------------------ */
/* Utility: get feature label                                         */
/* ------------------------------------------------------------------ */

export function getFeatureLabel(feature: string): string {
  return FEATURE_LABELS[feature] || feature;
}
