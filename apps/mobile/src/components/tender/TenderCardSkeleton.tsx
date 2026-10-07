/**
 * TenderBazaar — TenderCardSkeleton Component
 *
 * Skeleton loader matching the exact TenderCard layout.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { lightColors as colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { borderRadius, spacing } from '../../theme/spacing';
import SkeletonLoader from '../ui/SkeletonLoader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenderCardSkeletonProps {
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TenderCardSkeleton: React.FC<TenderCardSkeletonProps> = ({ style }) => {
  return (
    <View style={[styles.card, shadows.md, style]}>
      {/* Top row: Category badge + Deadline badge */}
      <View style={styles.topRow}>
        <SkeletonLoader width={72} height={22} borderRadius={11} />
        <SkeletonLoader width={64} height={22} borderRadius={11} />
      </View>

      {/* Title lines */}
      <SkeletonLoader width="100%" height={16} borderRadius={4} style={styles.titleLine1} />
      <SkeletonLoader width="70%" height={16} borderRadius={4} style={styles.titleLine2} />

      {/* Meta row: Org + State */}
      <View style={styles.metaRow}>
        <SkeletonLoader width={120} height={14} borderRadius={4} />
        <SkeletonLoader width={80} height={14} borderRadius={4} style={styles.metaRight} />
      </View>

      {/* Published date */}
      <SkeletonLoader width={100} height={12} borderRadius={4} style={styles.published} />

      {/* Bottom row: Value + Bookmark */}
      <View style={styles.bottomRow}>
        <View style={styles.valueRow}>
          <SkeletonLoader width={24} height={20} borderRadius={4} />
          <SkeletonLoader width={80} height={20} borderRadius={4} style={styles.valueAmount} />
          <SkeletonLoader width={56} height={12} borderRadius={4} style={styles.valueLabel} />
        </View>
        <SkeletonLoader width={28} height={28} borderRadius={14} />
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: colors.skeleton,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleLine1: {
    marginBottom: spacing.xs,
  },
  titleLine2: {
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaRight: {
    marginLeft: spacing.base,
  },
  published: {
    marginBottom: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueAmount: {
    marginLeft: spacing.xs,
  },
  valueLabel: {
    marginLeft: spacing.sm,
  },
});

export default React.memo(TenderCardSkeleton);
