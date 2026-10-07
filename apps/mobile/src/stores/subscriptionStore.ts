import { create } from 'zustand';
import type {
  SubscriptionPlan,
  Subscription,
  SubscriptionData,
  UsageStat,
} from '@/services/api/subscription';

/* ------------------------------------------------------------------ */
/* Types                                                              */
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
/* Store                                                              */
/* ------------------------------------------------------------------ */

interface SubscriptionState {
  // Data
  currentPlan: SubscriptionPlan | null;
  subscription: Subscription | null;
  isFreePlan: boolean;
  usage: UsageStat[];

  // Actions
  setSubscriptionData: (data: SubscriptionData) => void;
  setUsage: (usage: UsageStat[]) => void;
  reset: () => void;

  // Feature gate helpers
  hasFeature: (feature: BooleanFeature) => boolean;
  getFeatureLabel: (feature: string) => string;
  getRequiredPlan: (feature: BooleanFeature) => string;
  checkLimit: (limitName: NumericLimit) => {
    hasCapacity: boolean;
    isUnlimited: boolean;
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
  };
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  currentPlan: null,
  subscription: null,
  isFreePlan: true,
  usage: [],

  setSubscriptionData: (data: SubscriptionData) => {
    set({
      currentPlan: data.plan,
      subscription: data.subscription,
      isFreePlan: data.isFreePlan,
    });
  },

  setUsage: (usage: UsageStat[]) => {
    set({ usage });
  },

  reset: () => {
    set({
      currentPlan: null,
      subscription: null,
      isFreePlan: true,
      usage: [],
    });
  },

  hasFeature: (feature: BooleanFeature): boolean => {
    const plan = get().currentPlan;
    if (!plan) return false;
    return !!(plan as any)[feature];
  },

  getFeatureLabel: (feature: string): string => {
    return FEATURE_LABELS[feature] || feature;
  },

  getRequiredPlan: (feature: BooleanFeature): string => {
    return MIN_PLAN_FOR_FEATURE[feature] || 'Starter';
  },

  checkLimit: (limitName: NumericLimit) => {
    const plan = get().currentPlan;
    const usage = get().usage;

    const limit = plan ? ((plan as any)[limitName] as number) : 0;
    const isUnlimited = limit === -1;
    const usageStat = usage.find((u) => u.feature === limitName);
    const used = usageStat?.used ?? 0;
    const hasCapacity = isUnlimited || used < limit;
    const remaining = isUnlimited ? -1 : Math.max(0, limit - used);
    const percentage = isUnlimited
      ? 0
      : limit === 0
        ? 100
        : Math.round((used / limit) * 100);

    return { hasCapacity, isUnlimited, limit, used, remaining, percentage };
  },
}));

/** Get the feature label for a feature key */
export function getFeatureLabel(feature: string): string {
  return FEATURE_LABELS[feature] || feature;
}
