'use client';

import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSubscriptionStore } from '@/stores/subscription-store';
import {
  useFeatureGate,
  useLimitGate,
  type BooleanFeature,
  type NumericLimit,
} from '@/lib/hooks/use-feature-gate';

/**
 * Which entitlement a nav item depends on.
 *
 * `feature` is a boolean plan flag (e.g. tenderCalendar); `limit` is a numeric
 * allowance (e.g. maxAlerts), where a plan granting 0 means no access at all.
 */
export type NavGate =
  | { kind: 'feature'; name: BooleanFeature }
  | { kind: 'limit'; name: NumericLimit };

/**
 * Upgrade badge for a gated navigation item.
 *
 * Renders the minimum plan that unlocks the item, and renders *nothing* when:
 *
 *   - the user already has access (no nagging paying customers),
 *   - entitlements are still loading or were never requested (guessing a plan
 *     would flash a wrong badge on every page load), or
 *   - entitlements failed to load (`isUnavailable`) — the user may well be on a
 *     paid plan, so claiming they need to upgrade would be a lie.
 *
 * This is presentation only. The authoritative checks remain the server-side
 * `requireFeature`/`requireLimit` middleware and the page-level `FeatureGate`.
 */
export function NavPlanBadge({ gate, className }: { gate: NavGate; className?: string }) {
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);

  // Both hooks run unconditionally to respect the rules of hooks; only the
  // relevant result is read below.
  const featureGate = useFeatureGate(gate.kind === 'feature' ? gate.name : 'tenderCalendar');
  const limitGate = useLimitGate(gate.kind === 'limit' ? gate.name : 'maxAlerts');

  // Entitlements not yet known — stay silent rather than guess.
  if (subscriptionStatus !== 'loaded') return null;

  const hasAccess = gate.kind === 'feature' ? featureGate.hasAccess : limitGate.limit !== 0;
  const isUnavailable = gate.kind === 'feature' ? featureGate.isUnavailable : limitGate.isUnavailable;
  const requiredPlan = gate.kind === 'feature' ? featureGate.requiredPlan : limitGate.requiredPlan;

  if (isUnavailable || hasAccess) return null;
  // Limit gates derive the plan name from the loaded plan list; if that has not
  // arrived we do not know what to name, so show nothing rather than a guess.
  if (!requiredPlan) return null;

  return (
    <span
      // Spoken as e.g. "Tender Calendar requires the Starter plan" rather than
      // just the bare plan name.
      aria-label={`Requires the ${requiredPlan} plan`}
      title={`Requires the ${requiredPlan} plan`}
      className={cn(
        'inline-flex items-center gap-1 shrink-0 rounded-full px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wide',
        'bg-primary-500/10 text-primary-500',
        className,
      )}
    >
      <Lock className="h-2.5 w-2.5" aria-hidden="true" />
      {requiredPlan}
    </span>
  );
}
