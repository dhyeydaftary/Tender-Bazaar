'use client';

import { type ReactNode } from 'react';
import { useFeatureGate, type BooleanFeature } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from './UpgradeBanner';

interface FeatureGateProps {
  /** The boolean feature to check */
  feature: BooleanFeature;
  /** Content to render if the user has access */
  children: ReactNode;
  /** How to display the locked state */
  fallbackVariant?: 'inline' | 'card' | 'overlay' | 'hidden';
  /** Custom fallback content */
  fallback?: ReactNode;
  /** Additional class for the wrapper */
  className?: string;
}

/**
 * Conditionally renders children based on the user's plan.
 *
 * Usage:
 * ```tsx
 * <FeatureGate feature="tenderCalendar" fallbackVariant="card">
 *   <CalendarView />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallbackVariant = 'card',
  fallback,
  className,
}: FeatureGateProps) {
  const { hasAccess, isUnavailable, featureName, requiredPlan, currentPlan } =
    useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Entitlements could not be checked. Showing "upgrade to Starter" here would
  // be a guess — the user may already be on a paid plan — so say what actually
  // happened instead. Access is still withheld, and the API would reject the
  // request anyway.
  if (isUnavailable) {
    return (
      <div
        className={`rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground ${
          className || ''
        }`}
      >
        {featureName} is unavailable right now — we couldn&apos;t verify your subscription.
        Please refresh and try again.
      </div>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (fallbackVariant === 'hidden') {
    return null;
  }

  if (fallbackVariant === 'overlay') {
    return (
      <div className={`relative ${className || ''}`}>
        <div className="opacity-30 pointer-events-none select-none" aria-hidden>
          {children}
        </div>
        <UpgradeBanner
          feature={featureName}
          requiredPlan={requiredPlan}
          currentPlan={currentPlan}
          variant="overlay"
        />
      </div>
    );
  }

  return (
    <UpgradeBanner
      feature={featureName}
      requiredPlan={requiredPlan}
      currentPlan={currentPlan}
      variant={fallbackVariant}
      className={className}
    />
  );
}
