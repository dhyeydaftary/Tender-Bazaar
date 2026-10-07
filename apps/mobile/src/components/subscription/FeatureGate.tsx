import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useSubscriptionStore,
  type BooleanFeature,
} from '@/stores/subscriptionStore';
import { UpgradeBanner } from './UpgradeBanner';

interface FeatureGateProps {
  /** The boolean feature to check */
  feature: BooleanFeature;
  /** Content to render if the user has access */
  children: ReactNode;
  /** How to display the locked state */
  fallbackVariant?: 'inline' | 'card' | 'hidden';
  /** Custom fallback content */
  fallback?: ReactNode;
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
}: FeatureGateProps) {
  const hasFeature = useSubscriptionStore((s) => s.hasFeature);
  const getFeatureLabel = useSubscriptionStore((s) => s.getFeatureLabel);
  const getRequiredPlan = useSubscriptionStore((s) => s.getRequiredPlan);
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);

  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (fallbackVariant === 'hidden') {
    return null;
  }

  return (
    <View style={styles.container}>
      <UpgradeBanner
        feature={getFeatureLabel(feature)}
        requiredPlan={getRequiredPlan(feature)}
        currentPlan={currentPlan?.name || 'Free'}
        variant={fallbackVariant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
