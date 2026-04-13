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
  const { hasAccess, featureName, requiredPlan, currentPlan } = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
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
