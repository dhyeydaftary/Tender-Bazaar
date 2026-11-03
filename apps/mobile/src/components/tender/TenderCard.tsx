/**
 * TenderBazaar -- TenderCard Component (Premium)
 *
 * The MOST IMPORTANT UI component in the app. Full-width tender card with:
 *
 * Layout (full width, 16px horizontal margin):
 *  - Left accent border (4px, category-colored)
 *  - Top row: CategoryBadge pill (left) + DeadlineBadge (right)
 *  - Title: 15px SemiBold, max 2 lines, ellipsis, #0F1117
 *  - Meta row: building icon + org | map-pin icon + state (dot separator)
 *  - Published: "Posted 2 days ago" (12px, #9CA3AF)
 *  - Separator (1px #E8ECF1)
 *  - Bottom row: value (left) + eligibility score (center) + SaveButton (right)
 *
 * Animations:
 *  - Pressable: scale(0.98) on press via Reanimated withSpring
 *  - Tap -> onPress, Long press -> onLongPress
 *
 * Performance:
 *  - React.memo with custom comparator
 *  - useCallback for handlers
 *  - useMemo for computed values
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
import Badge from '../ui/Badge';
import DeadlineBadge from './DeadlineBadge';
import SaveButton from './SaveButton';
import { timeAgo } from '../../utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenderCardData {
  id: string;
  title: string;
  organization: string;
  state: string;
  category: 'Works' | 'Goods' | 'Services' | 'Consultancy';
  /** null when the issuing authority did not publish an estimate. */
  estimatedValue: number | null;
  emdAmount: number | null;
  submissionDeadline: string;
  publishedDate: string;
  status: 'ACTIVE' | 'CORRIGENDUM' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  sourcePortal: string;
  referenceNumber: string;
}

type Tender = TenderCardData;

interface TenderCardProps {
  tender: Tender;
  onPress?: () => void;
  onLongPress?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  eligibilityScore?: number;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Category accent colors
// ---------------------------------------------------------------------------

const CATEGORY_ACCENT: Record<Tender['category'], string> = {
  Works: '#E8593C',
  Goods: '#2563EB',
  Services: '#0D9488',
  Consultancy: '#7C3AED',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value <= 0) return 'Not Disclosed';
  if (value >= 1_00_00_000) {
    const cr = value / 1_00_00_000;
    return `${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
  }
  if (value >= 1_00_000) {
    const lakh = value / 1_00_000;
    return `${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} Lakh`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString('en-IN');
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.4,
};

// ---------------------------------------------------------------------------
// Mini Eligibility Score Ring
// ---------------------------------------------------------------------------

const EligibilityScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const scoreColor = getScoreColor(score);

  return (
    <View style={scoreStyles.container}>
      <View style={scoreStyles.ringWrapper}>
        {/* Background track */}
        <View
          style={[
            scoreStyles.ringTrack,
            { borderColor: scoreColor + '20' },
          ]}
        />
        {/* We use a simpler approach: colored border based on percentage */}
        <View
          style={[
            scoreStyles.ring,
            {
              borderColor: scoreColor,
              borderTopColor: score >= 75 ? scoreColor : 'transparent',
              borderRightColor: score >= 50 ? scoreColor : 'transparent',
              borderBottomColor: score >= 25 ? scoreColor : 'transparent',
              borderLeftColor: scoreColor,
            },
          ]}
        />
        <Text style={[scoreStyles.scoreText, { color: scoreColor }]}>
          {score}
        </Text>
      </View>
      <Text style={scoreStyles.label}>Match</Text>
    </View>
  );
};

const scoreStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
  },
  ring: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    transform: [{ rotate: '-90deg' }],
  },
  scoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: '700',
  },
  label: {
    fontFamily: fontFamilies.medium,
    fontSize: 9,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 1,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TenderCard: React.FC<TenderCardProps> = ({
  tender,
  onPress,
  onLongPress,
  onSave,
  isSaved = false,
  eligibilityScore,
  style,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const accentColor = CATEGORY_ACCENT[tender.category];
  const formattedValue = useMemo(
    // formatCurrency renders a missing value as ₹0, which reads as a real amount.
    () => (tender.estimatedValue == null ? 'Not disclosed' : formatCurrency(tender.estimatedValue)),
    [tender.estimatedValue],
  );
  const postedAgo = useMemo(
    () => timeAgo(tender.publishedDate),
    [tender.publishedDate],
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        shadows.md,
        { borderLeftWidth: 4, borderLeftColor: accentColor },
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Tender: ${tender.title}`}
    >
      {/* ---- Top row: Category + Deadline ---- */}
      <View style={styles.topRow}>
        <Badge variant="category" category={tender.category} size="sm" />
        <DeadlineBadge deadline={tender.submissionDeadline} />
      </View>

      {/* ---- Title ---- */}
      <Text style={styles.title} numberOfLines={2}>
        {tender.title}
      </Text>

      {/* ---- Meta row: Org + State ---- */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="briefcase" size={13} color="#9CA3AF" />
          <Text style={styles.metaText} numberOfLines={1}>
            {tender.organization}
          </Text>
        </View>
        <Text style={styles.metaDot}>{'\u00B7'}</Text>
        <View style={styles.metaItem}>
          <Icon name="map-pin" size={13} color="#9CA3AF" />
          <Text style={styles.metaText} numberOfLines={1}>
            {tender.state}
          </Text>
        </View>
      </View>

      {/* ---- Published date ---- */}
      <Text style={styles.published}>Posted {postedAgo}</Text>

      {/* ---- Separator ---- */}
      <View style={styles.separator} />

      {/* ---- Bottom row: Value + Score + Save ---- */}
      <View style={styles.bottomRow}>
        {/* Value section */}
        <View style={styles.valueSection}>
          <View style={styles.valueTop}>
            <MCIcon name="currency-inr" size={16} color="#FF6B35" />
            <Text style={styles.valueAmount}>{formattedValue}</Text>
          </View>
          <Text style={styles.valueLabel}>Est. value</Text>
        </View>

        {/* Eligibility score (optional) */}
        {eligibilityScore !== undefined && eligibilityScore > 0 && (
          <EligibilityScoreBadge score={eligibilityScore} />
        )}

        {/* Save button */}
        {onSave && <SaveButton isSaved={isSaved} onToggle={onSave} />}
      </View>
    </AnimatedPressable>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F1117',
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  metaText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    flexShrink: 1,
  },
  metaDot: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#9CA3AF',
    marginHorizontal: 8,
    lineHeight: 16,
  },
  published: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#E8ECF1',
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueSection: {
    flexShrink: 1,
  },
  valueTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1117',
    marginLeft: 2,
  },
  valueLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
    marginLeft: 18, // align under the amount (past the rupee icon)
  },
});

// ---------------------------------------------------------------------------
// Custom comparator for React.memo
// ---------------------------------------------------------------------------

function areEqual(
  prevProps: TenderCardProps,
  nextProps: TenderCardProps,
): boolean {
  return (
    prevProps.tender.id === nextProps.tender.id &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.tender.status === nextProps.tender.status &&
    prevProps.tender.submissionDeadline === nextProps.tender.submissionDeadline &&
    prevProps.tender.estimatedValue === nextProps.tender.estimatedValue &&
    prevProps.eligibilityScore === nextProps.eligibilityScore
  );
}

export default React.memo(TenderCard, areEqual);
