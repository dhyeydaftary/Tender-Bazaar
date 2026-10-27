import type { SubscriptionPlan, SubscriptionStatus, UsageStat } from '@/stores/subscription-store';

/**
 * Where a plan limit's numbers stand.
 *
 * `loading` — the plan or the usage has not been fetched yet.
 * `error`   — one of them failed to load; the figures are not trustworthy.
 * `ready`   — both are known, and `limit`/`used` describe this user.
 */
export type LimitStatus = 'loading' | 'error' | 'ready';

export interface LimitState {
  status: LimitStatus;
  /** The plan's allowance for this limit; -1 means unlimited. */
  limit: number;
  used: number;
  isUnlimited: boolean;
  hasCapacity: boolean;
  /** -1 when unlimited. */
  remaining: number;
  /** 0–100 for display; 100 when the plan grants none of this limit. */
  percentage: number;
  /** From the usage API: 'monthly' | 'lifetime' | … — null until loaded. */
  resetType: UsageStat['resetType'] | null;
}

/**
 * Pure calculation behind useLimitGate, so it can be tested without React.
 *
 * The allowance comes from the user's plan (GET /subscription) and `used` from
 * GET /subscription/usage — the same counter the API enforces. An empty usage
 * list is only "nothing used" once usage has actually loaded; before that the
 * status says so instead of reporting a confident 0.
 */
export function computeLimitState(input: {
  limitName: string;
  currentPlan: SubscriptionPlan | null;
  usage: UsageStat[];
  subscriptionStatus: SubscriptionStatus;
  usageStatus: SubscriptionStatus;
}): LimitState {
  const { limitName, currentPlan, usage, subscriptionStatus, usageStatus } = input;

  const rawLimit = currentPlan ? (currentPlan as unknown as Record<string, unknown>)[limitName] : undefined;
  const limit = typeof rawLimit === 'number' ? rawLimit : 0;
  const isUnlimited = limit === -1;
  const usageStat = usage.find((u) => u.feature === limitName);
  const used = Math.max(0, usageStat?.used ?? 0);

  const status: LimitStatus =
    subscriptionStatus === 'error' || usageStatus === 'error'
      ? 'error'
      : subscriptionStatus === 'loaded' && usageStatus === 'loaded' && currentPlan
        ? 'ready'
        : 'loading';

  return {
    status,
    limit,
    used,
    isUnlimited,
    hasCapacity: isUnlimited || used < limit,
    remaining: isUnlimited ? -1 : Math.max(0, limit - used),
    percentage: isUnlimited ? 0 : limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
    resetType: usageStat?.resetType ?? null,
  };
}
