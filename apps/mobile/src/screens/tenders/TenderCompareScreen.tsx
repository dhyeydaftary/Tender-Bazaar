import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { FeatureGate } from '../../components/subscription';

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------
const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CompareRoute = RouteProp<RootStackParamList, 'TenderCompare'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type HighlightWinner = 'a' | 'b' | 'none';

interface CompareField {
  label: string;
  icon: string;
  valueA: string;
  valueB: string;
  highlight: HighlightWinner;
}

interface TenderSummary {
  title: string;
  organization: string;
  category: string;
  badgeColor: string;
}

// ---------------------------------------------------------------------------
// Mock tender headers
// ---------------------------------------------------------------------------
const TENDER_A: TenderSummary = {
  title: 'Construction of 4-Lane Highway on NH-48',
  organization: 'NHAI (National Highways Authority)',
  category: 'Works',
  badgeColor: PRIMARY,
};

const TENDER_B: TenderSummary = {
  title: 'Road Widening & Strengthening NH-17',
  organization: 'NHAI (National Highways Authority)',
  category: 'Works',
  badgeColor: ACCENT,
};

// ---------------------------------------------------------------------------
// Mock comparison fields (12 rows)
// ---------------------------------------------------------------------------
const COMPARE_FIELDS: CompareField[] = [
  {
    label: 'Title',
    icon: 'text-box-outline',
    valueA: 'Construction of 4-Lane Highway on NH-48',
    valueB: 'Road Widening & Strengthening NH-17',
    highlight: 'none',
  },
  {
    label: 'Organization',
    icon: 'domain',
    valueA: 'NHAI',
    valueB: 'NHAI',
    highlight: 'none',
  },
  {
    label: 'Category',
    icon: 'tag-outline',
    valueA: 'Works',
    valueB: 'Works',
    highlight: 'none',
  },
  {
    label: 'State',
    icon: 'map-marker-outline',
    valueA: 'Gujarat',
    valueB: 'Maharashtra',
    highlight: 'none',
  },
  {
    label: 'Estimated Value',
    icon: 'currency-inr',
    valueA: '₹45.2 Cr',
    valueB: '₹32 Cr',
    highlight: 'b',
  },
  {
    label: 'EMD Amount',
    icon: 'shield-check-outline',
    valueA: '₹45 Lakh',
    valueB: '₹32 Lakh',
    highlight: 'b',
  },
  {
    label: 'Tender Fee',
    icon: 'receipt',
    valueA: '₹10,000',
    valueB: '₹15,000',
    highlight: 'a',
  },
  {
    label: 'Deadline',
    icon: 'calendar-clock',
    valueA: '15 Apr 2026',
    valueB: '22 Apr 2026',
    highlight: 'b',
  },
  {
    label: 'Published Date',
    icon: 'calendar-check-outline',
    valueA: '28 Mar 2026',
    valueB: '01 Apr 2026',
    highlight: 'none',
  },
  {
    label: 'Source Portal',
    icon: 'web',
    valueA: 'CPPP',
    valueB: 'GeM',
    highlight: 'none',
  },
  {
    label: 'Status',
    icon: 'information-outline',
    valueA: 'Open',
    valueB: 'Open',
    highlight: 'none',
  },
  {
    label: 'Eligibility Score',
    icon: 'chart-arc',
    valueA: '87%',
    valueB: '92%',
    highlight: 'b',
  },
];

// ---------------------------------------------------------------------------
// CompareRow (memoized, animated)
// ---------------------------------------------------------------------------
interface CompareRowProps {
  field: CompareField;
  index: number;
  isEven: boolean;
}

const CompareRow = React.memo(function CompareRow({
  field,
  index,
  isEven,
}: CompareRowProps) {
  const translateX = useSharedValue(40);
  const opacity = useSharedValue(0);
  const pulseA = useSharedValue(0);
  const pulseB = useSharedValue(0);

  useEffect(() => {
    const delay = 200 + index * 60;
    translateX.value = withDelay(
      delay,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    // Pulse highlight on better value
    if (field.highlight === 'a') {
      pulseA.value = withDelay(
        delay + 300,
        withSpring(1, { damping: 12, stiffness: 100 }),
      );
    } else if (field.highlight === 'b') {
      pulseB.value = withDelay(
        delay + 300,
        withSpring(1, { damping: 12, stiffness: 100 }),
      );
    }
  }, [index, field.highlight, translateX, opacity, pulseA, pulseB]);

  const rowAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const highlightAnimA = useAnimatedStyle(() => ({
    backgroundColor:
      field.highlight === 'a'
        ? `rgba(255, 107, 53, ${interpolate(pulseA.value, [0, 1], [0, 0.08])})`
        : 'transparent',
    transform: [{ scale: interpolate(pulseA.value, [0, 0.5, 1], [0.97, 1.02, 1]) }],
  }));

  const highlightAnimB = useAnimatedStyle(() => ({
    backgroundColor:
      field.highlight === 'b'
        ? `rgba(255, 107, 53, ${interpolate(pulseB.value, [0, 1], [0, 0.08])})`
        : 'transparent',
    transform: [{ scale: interpolate(pulseB.value, [0, 0.5, 1], [0.97, 1.02, 1]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.compareRow,
        isEven ? styles.compareRowEven : null,
        rowAnim,
      ]}
    >
      {/* Label column */}
      <View style={styles.labelColumn}>
        <Icon name={field.icon} size={16} color={TEXT_MUTED} />
        <Text style={styles.labelText}>{field.label}</Text>
      </View>

      {/* Value A */}
      <Animated.View style={[styles.valueColumn, highlightAnimA]}>
        <Text
          style={[
            styles.valueText,
            field.highlight === 'a' && styles.valueTextHighlighted,
          ]}
          numberOfLines={2}
        >
          {field.valueA}
        </Text>
        {field.highlight === 'a' && (
          <Icon name="check-circle" size={13} color={PRIMARY} style={styles.checkIcon} />
        )}
      </Animated.View>

      {/* Divider */}
      <View style={styles.columnDivider} />

      {/* Value B */}
      <Animated.View style={[styles.valueColumn, highlightAnimB]}>
        <Text
          style={[
            styles.valueText,
            field.highlight === 'b' && styles.valueTextHighlighted,
          ]}
          numberOfLines={2}
        >
          {field.valueB}
        </Text>
        {field.highlight === 'b' && (
          <Icon name="check-circle" size={13} color={PRIMARY} style={styles.checkIcon} />
        )}
      </Animated.View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// TenderMiniCard
// ---------------------------------------------------------------------------
interface TenderMiniCardProps {
  tender: TenderSummary;
  label: string;
  isRecommended: boolean;
}

const TenderMiniCard = React.memo(function TenderMiniCard({
  tender,
  label,
  isRecommended,
}: TenderMiniCardProps) {
  return (
    <View style={[styles.miniCard, { borderTopColor: tender.badgeColor }]}>
      {isRecommended && (
        <View style={styles.recommendedBadgeMini}>
          <Icon name="star" size={10} color="#FFFFFF" />
        </View>
      )}
      <View style={[styles.tenderBadge, { backgroundColor: tender.badgeColor }]}>
        <Text style={styles.tenderBadgeText}>{label}</Text>
      </View>
      <Text style={styles.miniTitle} numberOfLines={2}>
        {tender.title}
      </Text>
      <Text style={styles.miniOrg} numberOfLines={1}>
        {tender.organization}
      </Text>
      <View style={[styles.categoryPill, { borderColor: tender.badgeColor + '40' }]}>
        <Text style={[styles.categoryPillText, { color: tender.badgeColor }]}>
          {tender.category}
        </Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
function TenderCompareScreen() {
  const route = useRoute<CompareRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Determine winner: count how many "better" values each tender has
  const winnerData = useMemo(() => {
    let countA = 0;
    let countB = 0;
    COMPARE_FIELDS.forEach((f) => {
      if (f.highlight === 'a') countA++;
      if (f.highlight === 'b') countB++;
    });

    const winner = countB > countA ? 'b' : countA > countB ? 'a' : 'none';
    const reasons: string[] = [];

    if (winner === 'b') {
      const bFields = COMPARE_FIELDS.filter((f) => f.highlight === 'b');
      if (bFields.some((f) => f.label === 'Estimated Value')) {
        reasons.push('lower estimated value');
      }
      if (bFields.some((f) => f.label === 'Deadline')) {
        reasons.push('more time remaining before deadline');
      }
      if (bFields.some((f) => f.label === 'Eligibility Score')) {
        reasons.push('higher eligibility score');
      }
      if (bFields.some((f) => f.label === 'EMD Amount')) {
        reasons.push('lower EMD requirement');
      }
    } else if (winner === 'a') {
      const aFields = COMPARE_FIELDS.filter((f) => f.highlight === 'a');
      if (aFields.some((f) => f.label === 'Estimated Value')) {
        reasons.push('lower estimated value');
      }
      if (aFields.some((f) => f.label === 'Deadline')) {
        reasons.push('more time remaining before deadline');
      }
      if (aFields.some((f) => f.label === 'Eligibility Score')) {
        reasons.push('higher eligibility score');
      }
    }

    return {
      winner,
      tenderLabel: winner === 'a' ? 'Tender A' : 'Tender B',
      tenderTitle:
        winner === 'a' ? TENDER_A.title : winner === 'b' ? TENDER_B.title : '',
      winsCount: Math.max(countA, countB),
      reasons,
    };
  }, []);

  // Winner card entrance animation
  const winnerTranslateY = useSharedValue(30);
  const winnerOpacity = useSharedValue(0);

  useEffect(() => {
    const totalDelay = 200 + COMPARE_FIELDS.length * 60 + 200;
    winnerTranslateY.value = withDelay(
      totalDelay,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );
    winnerOpacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );
  }, [winnerTranslateY, winnerOpacity]);

  const winnerCardAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: winnerTranslateY.value }],
    opacity: winnerOpacity.value,
  }));

  return (
    <FeatureGate feature="tenderComparison" fallbackVariant="card">
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={handleGoBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <FeatherIcon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compare Tenders</Text>
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>2 tenders</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        stickyHeaderIndices={[0]}
      >
        {/* Sticky Tender Headers */}
        <View style={styles.stickyHeaderWrap}>
          <View style={[styles.tenderHeadersRow, shadows.sm]}>
            <TenderMiniCard
              tender={TENDER_A}
              label="A"
              isRecommended={winnerData.winner === 'a'}
            />
            <View style={styles.headerDivider} />
            <TenderMiniCard
              tender={TENDER_B}
              label="B"
              isRecommended={winnerData.winner === 'b'}
            />
          </View>
        </View>

        {/* Comparison Table */}
        <View style={[styles.tableCard, shadows.sm]}>
          {COMPARE_FIELDS.map((field, index) => (
            <CompareRow
              key={field.label}
              field={field}
              index={index}
              isEven={index % 2 === 0}
            />
          ))}
        </View>

        {/* Winner Summary */}
        {winnerData.winner !== 'none' && (
          <Animated.View style={[styles.winnerCard, shadows.md, winnerCardAnim]}>
            <View style={styles.winnerHeader}>
              <View style={styles.recommendedBadge}>
                <Icon name="star" size={14} color="#FFFFFF" />
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            </View>
            <Text style={styles.winnerTitle}>
              {winnerData.tenderLabel}: {winnerData.tenderTitle}
            </Text>
            <View style={styles.winnerDivider} />
            <View style={styles.winnerReasonRow}>
              <Icon name="information-outline" size={16} color={TEXT_SECONDARY} />
              <Text style={styles.winnerReasonText}>
                {winnerData.tenderLabel} is recommended with{' '}
                {winnerData.reasons.length > 0
                  ? winnerData.reasons.join(', ')
                  : 'better overall metrics'}
                .
              </Text>
            </View>
            <View style={styles.winnerStats}>
              <View style={styles.winnerStat}>
                <Text style={styles.winnerStatNumber}>{winnerData.winsCount}</Text>
                <Text style={styles.winnerStatLabel}>Better metrics</Text>
              </View>
              <View style={styles.winnerStatDivider} />
              <View style={styles.winnerStat}>
                <Text style={styles.winnerStatNumber}>
                  {COMPARE_FIELDS.length}
                </Text>
                <Text style={styles.winnerStatLabel}>Fields compared</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Legend */}
        <View style={[styles.legendCard, shadows.sm]}>
          <Icon name="information-outline" size={16} color={TEXT_MUTED} />
          <Text style={styles.legendText}>
            Saffron highlighted values indicate the more favorable option for your
            company profile.
          </Text>
        </View>
      </ScrollView>
    </View>
    </FeatureGate>
  );
}

export default React.memo(TenderCompareScreen);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SECONDARY,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerCountBadge: {
    backgroundColor: PRIMARY + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  headerCountText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Sticky tender headers
  stickyHeaderWrap: {
    backgroundColor: BACKGROUND,
    paddingTop: 16,
    paddingBottom: 12,
  },
  tenderHeadersRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },

  // Mini card
  miniCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  tenderBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tenderBadgeText: {
    fontSize: 14,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  miniTitle: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  miniOrg: {
    fontSize: 11,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 10,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendedBadgeMini: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Comparison table
  tableCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },

  // Compare row
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER + '80',
    minHeight: 48,
  },
  compareRowEven: {
    backgroundColor: '#F9FAFB',
  },

  // Label column
  labelColumn: {
    width: '32%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  labelText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    flexShrink: 1,
  },

  // Value column
  valueColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minHeight: 28,
  },
  valueText: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    flex: 1,
  },
  valueTextHighlighted: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: PRIMARY,
  },
  checkIcon: {
    marginLeft: 3,
  },

  // Column divider
  columnDivider: {
    width: 1,
    height: 20,
    backgroundColor: BORDER,
    marginHorizontal: 2,
  },

  // Winner card
  winnerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PRIMARY + '20',
  },
  winnerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  recommendedText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  winnerTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: 14,
  },
  winnerDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 14,
  },
  winnerReasonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  winnerReasonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    lineHeight: 21,
  },
  winnerStats: {
    flexDirection: 'row',
    backgroundColor: BACKGROUND,
    borderRadius: 12,
    overflow: 'hidden',
  },
  winnerStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  winnerStatNumber: {
    fontSize: 22,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: PRIMARY,
    marginBottom: 2,
  },
  winnerStatLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  winnerStatDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },

  // Legend
  legendCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  legendText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_MUTED,
    lineHeight: 19,
  },
});
