/**
 * TenderBazaar -- TenderMiniCard Component (Premium)
 *
 * Compact card (260x140) for horizontal scroll lists.
 * - Left urgency accent bar (4px): red <3d, amber <7d, green >7d
 * - Title: 14px SemiBold, 2 lines max
 * - Org: 12px muted, 1 line
 * - Bottom: value (left, 15px Bold) + deadline pill (right, colored)
 * - Subtle shadow, rounded 14
 * - Press animation: scale(0.97) via Reanimated
 * - React.memo
 */

import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tender {
  id: string;
  title: string;
  organization: string;
  state: string;
  category: 'Works' | 'Goods' | 'Services' | 'Consultancy';
  estimatedValue: number;
  emdAmount: number;
  submissionDeadline: string;
  publishedDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  sourcePortal: string;
  referenceNumber: string;
}

interface TenderMiniCardProps {
  tender: Tender;
  onPress?: () => void;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const URGENCY_COLORS = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#22C55E',
  gray: '#9CA3AF',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: number): string {
  if (value <= 0) return 'N/D';
  if (value >= 1_00_00_000) {
    const cr = value / 1_00_00_000;
    return `\u20B9${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
  }
  if (value >= 1_00_000) {
    const lakh = value / 1_00_000;
    return `\u20B9${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  if (value >= 1_000) {
    return `\u20B9${(value / 1_000).toFixed(0)}K`;
  }
  return `\u20B9${value.toLocaleString('en-IN')}`;
}

function getUrgencyColor(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return URGENCY_COLORS.gray;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 3) return URGENCY_COLORS.red;
  if (diffDays < 7) return URGENCY_COLORS.amber;
  return URGENCY_COLORS.green;
}

function getDeadlineLabel(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return `${diffHours}h left`;
  return `${diffDays}d left`;
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 400, mass: 0.4 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TenderMiniCard: React.FC<TenderMiniCardProps> = ({
  tender,
  onPress,
  style,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const urgencyColor = useMemo(
    () => getUrgencyColor(tender.submissionDeadline),
    [tender.submissionDeadline],
  );
  const deadlineLabel = useMemo(
    () => getDeadlineLabel(tender.submissionDeadline),
    [tender.submissionDeadline],
  );
  const formattedValue = useMemo(
    () => formatValue(tender.estimatedValue),
    [tender.estimatedValue],
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, shadows.sm, animatedStyle, style]}
      accessibilityRole="button"
      accessibilityLabel={`Tender: ${tender.title}`}
    >
      {/* Urgency accent bar (left edge) */}
      <View style={[styles.urgencyBar, { backgroundColor: urgencyColor }]} />

      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {tender.title}
        </Text>

        {/* Organization */}
        <View style={styles.orgRow}>
          <Icon name="briefcase" size={11} color="#9CA3AF" />
          <Text style={styles.orgText} numberOfLines={1}>
            {tender.organization}
          </Text>
        </View>

        {/* Bottom: Value + Deadline pill */}
        <View style={styles.bottomRow}>
          <Text style={styles.valueText} numberOfLines={1}>
            {formattedValue}
          </Text>
          <View
            style={[
              styles.deadlinePill,
              { backgroundColor: urgencyColor + '1A' },
            ]}
          >
            <MCIcon
              name="clock-outline"
              size={10}
              color={urgencyColor}
              style={styles.deadlineIcon}
            />
            <Text style={[styles.deadlineText, { color: urgencyColor }]}>
              {deadlineLabel}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    width: 260,
    height: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  urgencyBar: {
    width: 4,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F1117',
    lineHeight: 20,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  orgText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
    flexShrink: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  valueText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1117',
  },
  deadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  deadlineIcon: {
    marginRight: 3,
  },
  deadlineText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 10,
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Memo
// ---------------------------------------------------------------------------

function areEqual(
  prev: TenderMiniCardProps,
  next: TenderMiniCardProps,
): boolean {
  return (
    prev.tender.id === next.tender.id &&
    prev.tender.estimatedValue === next.tender.estimatedValue &&
    prev.tender.submissionDeadline === next.tender.submissionDeadline &&
    prev.tender.title === next.tender.title
  );
}

export default React.memo(TenderMiniCard, areEqual);
