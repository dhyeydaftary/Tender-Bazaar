import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Share,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';

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
const DANGER = '#EF4444';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DetailRoute = RouteProp<RootStackParamList, 'EligibilityResult'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type CriterionStatus = 'MET' | 'NOT_MET' | 'PARTIALLY_MET';
type Importance = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

interface Criterion {
  id: string;
  name: string;
  requirement: string;
  yourValue: string;
  status: CriterionStatus;
  importance: Importance;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const CRITERIA: Criterion[] = [
  {
    id: '1',
    name: 'Annual Turnover',
    requirement: 'Min ₹50 Cr (last 3 FY average)',
    yourValue: '₹65 Cr',
    status: 'MET',
    importance: 'CRITICAL',
  },
  {
    id: '2',
    name: 'Net Worth',
    requirement: 'Min ₹15 Cr',
    yourValue: '₹18 Cr',
    status: 'MET',
    importance: 'CRITICAL',
  },
  {
    id: '3',
    name: 'Years of Experience',
    requirement: 'Min 10 years in highway construction',
    yourValue: '12 years',
    status: 'MET',
    importance: 'IMPORTANT',
  },
  {
    id: '4',
    name: 'MSME Registration',
    requirement: 'MSME registration required',
    yourValue: 'Registered (Small Enterprise)',
    status: 'MET',
    importance: 'IMPORTANT',
  },
  {
    id: '5',
    name: 'ISO 9001 Certification',
    requirement: 'ISO 9001:2015 required',
    yourValue: 'Certified — Valid till Dec 2027',
    status: 'MET',
    importance: 'IMPORTANT',
  },
  {
    id: '6',
    name: 'Past Project Value',
    requirement: 'Completed single project ≥ ₹20 Cr',
    yourValue: '₹25 Cr (NH-48 Phase II)',
    status: 'MET',
    importance: 'CRITICAL',
  },
  {
    id: '7',
    name: 'EMD Amount',
    requirement: 'EMD of ₹50 Lakh required',
    yourValue: 'Exempt (MSME registered)',
    status: 'MET',
    importance: 'OPTIONAL',
  },
  {
    id: '8',
    name: 'Work Category',
    requirement: 'Category: Works',
    yourValue: 'Works',
    status: 'MET',
    importance: 'IMPORTANT',
  },
  {
    id: '9',
    name: 'Operating State',
    requirement: 'Registered in Gujarat',
    yourValue: 'Gujarat, Maharashtra',
    status: 'MET',
    importance: 'OPTIONAL',
  },
  {
    id: '10',
    name: 'Bridge Construction Experience',
    requirement: 'Specific bridge construction experience required',
    yourValue: 'None documented',
    status: 'NOT_MET',
    importance: 'IMPORTANT',
  },
];

const SUGGESTIONS = [
  'Document your bridge construction experience from past projects and obtain completion certificates from the relevant authorities.',
  'Consider partnering with a firm that has proven bridge construction expertise for a joint venture bid.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const statusColor = (s: CriterionStatus): string =>
  s === 'MET' ? SUCCESS : s === 'PARTIALLY_MET' ? WARNING : DANGER;

const statusIcon = (s: CriterionStatus): string =>
  s === 'MET' ? 'check-circle' : s === 'PARTIALLY_MET' ? 'alert-circle' : 'close-circle';

const statusLabel = (s: CriterionStatus): string =>
  s === 'MET' ? 'Eligible' : s === 'PARTIALLY_MET' ? 'Partially Eligible' : 'Not Eligible';

const importanceColor = (i: Importance): string =>
  i === 'CRITICAL' ? DANGER : i === 'IMPORTANT' ? WARNING : TEXT_MUTED;

const importanceBg = (i: Importance): string =>
  i === 'CRITICAL' ? DANGER + '14' : i === 'IMPORTANT' ? WARNING + '14' : '#E8ECF1';

const scoreBandColor = (score: number): string =>
  score >= 70 ? SUCCESS : score >= 40 ? WARNING : DANGER;

const scoreBandLabel = (score: number): string =>
  score >= 70 ? 'Eligible' : score >= 40 ? 'Partially Eligible' : 'Not Eligible';

const rowTintColor = (s: CriterionStatus): string =>
  s === 'MET' ? SUCCESS + '06' : s === 'PARTIALLY_MET' ? WARNING + '08' : DANGER + '08';

// ---------------------------------------------------------------------------
// CriterionCard (memoized)
// ---------------------------------------------------------------------------
interface CriterionCardProps {
  item: Criterion;
  index: number;
}

const CriterionCard = React.memo(function CriterionCard({
  item,
  index,
}: CriterionCardProps) {
  const translateY = useSharedValue(30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 80;
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const color = statusColor(item.status);
  const impColor = importanceColor(item.importance);
  const impBg = importanceBg(item.importance);
  const tint = rowTintColor(item.status);

  return (
    <Animated.View style={[styles.criterionCard, { backgroundColor: tint }, animStyle]}>
      <View style={styles.criterionRow}>
        {/* Left icon */}
        <View style={styles.criterionIconWrap}>
          <Icon name={statusIcon(item.status)} size={24} color={color} />
        </View>

        {/* Center content */}
        <View style={styles.criterionCenter}>
          <Text style={styles.criterionName}>{item.name}</Text>
          <Text style={styles.criterionRequirement}>{item.requirement}</Text>
          <Text style={[styles.criterionYours, { color }]}>
            Your company: {item.yourValue}
          </Text>
        </View>

        {/* Right importance badge */}
        <View style={[styles.importancePill, { backgroundColor: impBg }]}>
          <Text style={[styles.importanceText, { color: impColor }]}>
            {item.importance}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
function EligibilityResultScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { score } = route.params;

  // Animated score gauge
  const animatedScore = useSharedValue(0);

  useEffect(() => {
    animatedScore.value = withTiming(score, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score, animatedScore]);

  const scoreAnim = useAnimatedStyle(() => {
    const progress = animatedScore.value / 100;
    // Map progress to a rotation-like border width illusion via opacity
    // We use border-based ring; animate the score text instead
    return { opacity: interpolate(animatedScore.value, [0, score], [0.3, 1]) };
  });

  const bandColor = useMemo(() => scoreBandColor(score), [score]);
  const bandLabel = useMemo(() => scoreBandLabel(score), [score]);

  const metCount = useMemo(
    () => CRITERIA.filter((c) => c.status === 'MET').length,
    [],
  );
  const totalCount = CRITERIA.length;

  // Share
  const handleShare = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    try {
      await Share.share({
        message: `TenderBazaar Eligibility Report\nScore: ${score}/100 (${bandLabel})\n${metCount} of ${totalCount} criteria met.`,
        title: 'Eligibility Report',
      });
    } catch {
      // user cancelled
    }
  }, [score, bandLabel, metCount, totalCount]);

  const handleDownloadPDF = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    Alert.alert('Download PDF', 'PDF report will be generated and saved to your device.', [
      { text: 'OK' },
    ]);
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // FlatList header
  const renderHeader = useCallback(() => {
    // Progress ring: using borderWidth to simulate circular gauge
    const ringSize = 120;
    const ringBorderWidth = 8;

    return (
      <View>
        {/* Score Hero Card */}
        <View style={[styles.heroCard, shadows.md]}>
          {/* Circular Score Gauge */}
          <View style={styles.gaugeContainer}>
            {/* Track ring */}
            <View
              style={[
                styles.gaugeTrack,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: ringBorderWidth,
                  borderColor: TEXT_MUTED + '1A',
                },
              ]}
            />
            {/* Progress ring */}
            <Animated.View
              style={[
                styles.gaugeProgress,
                scoreAnim,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: ringBorderWidth,
                  borderColor: bandColor,
                },
              ]}
            />
            {/* Score text centered */}
            <View style={styles.gaugeCenter}>
              <Text style={[styles.scoreNumber, { color: bandColor }]}>
                {score}
              </Text>
              <Text style={[styles.scoreOf100, { color: bandColor }]}>/100</Text>
            </View>
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: bandColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: bandColor }]} />
            <Text style={[styles.statusLabel, { color: bandColor }]}>
              {bandLabel}
            </Text>
          </View>

          {/* Tender title */}
          <Text style={styles.tenderTitle} numberOfLines={2}>
            Construction of 4-Lane Highway on NH-48 (Ahmedabad-Vadodara Section)
          </Text>

          {/* Summary counts */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryChip, { backgroundColor: SUCCESS + '10' }]}>
              <Icon name="check-circle" size={14} color={SUCCESS} />
              <Text style={[styles.summaryChipText, { color: SUCCESS }]}>
                {CRITERIA.filter((c) => c.status === 'MET').length} Met
              </Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: WARNING + '10' }]}>
              <Icon name="alert-circle" size={14} color={WARNING} />
              <Text style={[styles.summaryChipText, { color: WARNING }]}>
                {CRITERIA.filter((c) => c.status === 'PARTIALLY_MET').length} Partial
              </Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: DANGER + '10' }]}>
              <Icon name="close-circle" size={14} color={DANGER} />
              <Text style={[styles.summaryChipText, { color: DANGER }]}>
                {CRITERIA.filter((c) => c.status === 'NOT_MET').length} Not Met
              </Text>
            </View>
          </View>
        </View>

        {/* Section header — Criteria Analysis */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Criteria Analysis</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {metCount} of {totalCount} met
            </Text>
          </View>
        </View>
      </View>
    );
  }, [score, bandColor, bandLabel, scoreAnim, metCount, totalCount]);

  // FlatList footer
  const renderFooter = useCallback(() => {
    const hasNotMet = CRITERIA.some(
      (c) => c.status === 'NOT_MET' || c.status === 'PARTIALLY_MET',
    );
    const hasMSME = CRITERIA.some(
      (c) => c.id === '7' && c.status === 'MET',
    );

    return (
      <View>
        {/* Recommendations */}
        {hasNotMet && (
          <View style={styles.recommendationsSection}>
            <View style={styles.sectionHeader}>
              <Icon name="lightbulb-on-outline" size={20} color={PRIMARY} />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                Recommendations
              </Text>
            </View>
            {SUGGESTIONS.map((suggestion, idx) => (
              <View key={idx} style={styles.suggestionCard}>
                <View style={styles.suggestionNumber}>
                  <Text style={styles.suggestionNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* EMD Savings Banner */}
        {hasMSME && (
          <View style={styles.emdBanner}>
            <View style={styles.emdBannerLeft}>
              <Text style={styles.emdEmoji}>🎉</Text>
            </View>
            <View style={styles.emdBannerContent}>
              <Text style={styles.emdBannerTitle}>EMD Savings!</Text>
              <Text style={styles.emdBannerText}>
                You save ₹50 Lakh on EMD as an MSME registered company!
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleShare}
          >
            <FeatherIcon name="share-2" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Share Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            activeOpacity={0.85}
            onPress={handleDownloadPDF}
          >
            <FeatherIcon name="download" size={18} color={PRIMARY} />
            <Text style={styles.outlineButtonText}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            activeOpacity={0.7}
            onPress={handleGoBack}
          >
            <Text style={styles.textButtonText}>Check Another Tender</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for floating tab bar */}
        <View style={{ height: 100 }} />
      </View>
    );
  }, [handleShare, handleDownloadPDF, handleGoBack]);

  const renderCriterion = useCallback(
    ({ item, index }: ListRenderItemInfo<Criterion>) => (
      <CriterionCard item={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: Criterion) => item.id, []);

  return (
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
        <Text style={styles.headerTitle}>Eligibility Report</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={handleShare}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <FeatherIcon name="share-2" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={CRITERIA}
        renderItem={renderCriterion}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

export default React.memo(EligibilityResultScreen);

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
    justifyContent: 'space-between',
    backgroundColor: SECONDARY,
    paddingHorizontal: 16,
    paddingBottom: 14,
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
    fontSize: 17,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Hero card
  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
  },

  // Gauge
  gaugeContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  gaugeTrack: {
    position: 'absolute',
  },
  gaugeProgress: {
    position: 'absolute',
  },
  gaugeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 36,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreOf100: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    marginTop: -2,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },

  // Tender title
  tenderTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 8,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  summaryChipText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  sectionBadge: {
    backgroundColor: PRIMARY + '14',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Criterion card
  criterionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  criterionIconWrap: {
    width: 32,
    paddingTop: 2,
  },
  criterionCenter: {
    flex: 1,
    marginRight: 8,
  },
  criterionName: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 3,
  },
  criterionRequirement: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: 4,
  },
  criterionYours: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Importance pill
  importancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  importanceText: {
    fontSize: 9,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Recommendations
  recommendationsSection: {
    marginTop: 28,
  },
  suggestionCard: {
    flexDirection: 'row',
    backgroundColor: PRIMARY + '08',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: PRIMARY + '14',
  },
  suggestionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionNumberText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    lineHeight: 21,
  },

  // EMD Banner
  emdBanner: {
    flexDirection: 'row',
    backgroundColor: SUCCESS + '10',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: SUCCESS + '30',
    alignItems: 'center',
    gap: 12,
  },
  emdBannerLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SUCCESS + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emdEmoji: {
    fontSize: 22,
  },
  emdBannerContent: {
    flex: 1,
  },
  emdBannerTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: SUCCESS,
    marginBottom: 3,
  },
  emdBannerText: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: '#15803D',
    lineHeight: 19,
  },

  // Action buttons
  actionsSection: {
    marginTop: 28,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    height: 52,
    borderRadius: 14,
    gap: 8,
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    gap: 8,
  },
  outlineButtonText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
    letterSpacing: 0.2,
  },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  textButtonText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});
