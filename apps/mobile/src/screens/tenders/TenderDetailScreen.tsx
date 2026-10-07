/**
 * TenderBazaar -- TenderDetailScreen (Premium)
 *
 * The most important detail screen in the app. Shows full tender information
 * with an animated collapsible header, sticky tab bar, four content tabs,
 * and a fixed bottom action bar.
 *
 * Features:
 * - Collapsible animated header (200px -> 56px) with Reanimated v4
 * - Deep navy gradient background (#1B2845 -> #2A3D66)
 * - Sticky 4-tab bar with animated saffron underline indicator
 * - Tab: Overview  -- Key details, financials, description, criteria, contact, timeline
 * - Tab: Eligibility  -- CTA / loading / score + summary
 * - Tab: Documents  -- 7 document rows with download
 * - Tab: Similar  -- horizontal mini cards + compare selection
 * - Bottom action bar (Save / Check Eligibility / Share)
 * - Haptic feedback on key interactions
 * - Expandable description with animated toggle
 * - Important dates timeline with pulsing saffron dot
 * - Copyable reference number
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Share,
  Clipboard,
  Linking,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import type { RootStackParamList } from '../../types/navigation';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { lightColors } from '../../theme/colors';
import { formatCurrency, timeAgo } from '../../utils/format';
import { useSavedStore } from '../../stores/savedStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { UpgradeBanner } from '../../components/subscription';
import DeadlineBadge from '../../components/tender/DeadlineBadge';
import SaveButton from '../../components/tender/SaveButton';
import Badge from '../../components/ui/Badge';
import TenderMiniCard from '../../components/tender/TenderMiniCard';

// ── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HEADER_EXPANDED = 200;
const HEADER_COLLAPSED = 56;
const SCROLL_DISTANCE = HEADER_EXPANDED - HEADER_COLLAPSED;
const TAB_HEIGHT = 48;
const BOTTOM_HEIGHT = 80;

const TABS = ['Overview', 'Eligibility', 'Documents', 'Similar'] as const;

const HAPTIC_OPTS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ── Navigation types ─────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'TenderDetail'>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date();

function dateOffset(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const TENDER = {
  id: '1',
  title: 'Construction of 4-Lane Highway on NH-48 from Ahmedabad to Rajkot (Pkg-3)',
  organization: 'National Highways Authority of India (NHAI)',
  department: 'Project Implementation Unit, Ahmedabad',
  state: 'Gujarat',
  category: 'Works' as const,
  status: 'ACTIVE' as const,
  estimatedValue: 452000000,
  emdAmount: 5000000,
  tenderFee: 5000,
  documentCost: 2000,
  referenceNumber: 'NHAI/2026/GJ/NH48/PKG-3',
  sourcePortal: 'CPPP',
  deadline: dateOffset(7),
  published: dateOffset(-10),
  preBid: dateOffset(-5),
  corrigendum: dateOffset(-2),
  bidOpening: dateOffset(8),
  description:
    'Construction of 4-Lane Highway on NH-48 from Ahmedabad to Rajkot (Package-3), ' +
    'covering approximately 95 km. The project includes construction of main carriageway, ' +
    'service roads, grade-separated interchanges at 4 locations, vehicular and pedestrian ' +
    'underpasses, and associated drainage infrastructure.\n\n' +
    'The scope of work encompasses earthwork in embankment and cutting, sub-base and base ' +
    'course construction, bituminous surface course (DBM + BC), construction of major and ' +
    'minor bridges, retaining walls, median barriers, road furniture, signage, and plantation ' +
    'along the corridor. All works shall comply with MoRTH specifications (5th Revision) ' +
    'and relevant IRC standards.\n\n' +
    'The contractor shall be responsible for traffic management during construction, ' +
    'environmental compliance including dust suppression and noise control, and maintaining ' +
    'access to adjacent properties throughout the project duration of 36 months.',
  criteria: [
    'Minimum annual turnover of Rs. 50 Crores in each of the last 3 financial years',
    'Similar work experience of at least Rs. 25 Crores in highway construction',
    'Valid ISO 9001:2015 Quality Management certification',
    'Minimum 10 years of experience in highway/road construction projects',
    'GST registration and valid PAN card',
    'Valid registration with CPWD/MES/State PWD or equivalent government body',
    'Minimum net worth of Rs. 15 Crores as on last audited balance sheet',
    'No blacklisting by any Central/State Government organization in last 5 years',
  ],
  contact: {
    name: 'Shri R.K. Sharma',
    designation: 'Project Director, PIU Ahmedabad',
    email: 'pd.ahmedabad@nhai.org',
    phone: '+91-79-2686-XXXX',
  },
  documents: [
    { id: 'd1', name: 'Tender Notice & NIT', type: 'PDF', size: '2.4 MB', icon: 'file-pdf-box', color: '#EF4444' },
    { id: 'd2', name: 'Bill of Quantities (BOQ)', type: 'Excel', size: '1.8 MB', icon: 'file-excel-box', color: '#22C55E' },
    { id: 'd3', name: 'General Conditions of Contract', type: 'PDF', size: '3.1 MB', icon: 'file-pdf-box', color: '#EF4444' },
    { id: 'd4', name: 'Technical Specifications', type: 'PDF', size: '5.7 MB', icon: 'file-pdf-box', color: '#EF4444' },
    { id: 'd5', name: 'Drawing Sheets (Set A)', type: 'PDF', size: '12.4 MB', icon: 'file-pdf-box', color: '#EF4444' },
    { id: 'd6', name: 'EMD / BG Format', type: 'Word', size: '245 KB', icon: 'file-word-box', color: '#2563EB' },
    { id: 'd7', name: 'Pre-Qualification Criteria', type: 'PDF', size: '1.1 MB', icon: 'file-pdf-box', color: '#EF4444' },
  ],
};

function makeSimilar(id: string, title: string, org: string, state: string, val: number, emd: number, dlDays: number, pubDays: number, portal: string, ref: string) {
  return { id, title, organization: org, state, category: 'Works' as const, estimatedValue: val, emdAmount: emd, submissionDeadline: dateOffset(dlDays), publishedDate: dateOffset(pubDays), status: 'ACTIVE' as const, sourcePortal: portal, referenceNumber: ref };
}

const SIMILAR_TENDERS = [
  makeSimilar('10', 'Road Widening Project NH-17 Goa-Karnataka Section (Pkg-2)', 'NHAI', 'Goa', 320000000, 3500000, 12, -8, 'CPPP', 'NHAI/2026/GA/NH17/PKG-2'),
  makeSimilar('11', 'Construction of Major Bridge over River Narmada on NH-8', 'NHAI', 'Gujarat', 280000000, 3000000, 15, -5, 'CPPP', 'NHAI/2026/GJ/NH8/BR-1'),
  makeSimilar('12', 'Highway Median & Road Furniture Works - Gujarat State Highway', 'Roads & Buildings Dept, Gujarat', 'Gujarat', 85000000, 900000, 20, -3, 'GeM', 'R&B/GJ/2026/SH-145'),
  makeSimilar('13', 'Flyover Construction at Sarkhej-Gandhinagar Highway Junction', 'Ahmedabad Municipal Corporation', 'Gujarat', 195000000, 2000000, 9, -7, 'CPPP', 'AMC/2026/FO-SGH/01'),
  makeSimilar('14', '6-Lane Expressway ROB Construction - Rajkot Bypass', 'NHAI', 'Gujarat', 410000000, 4500000, 18, -4, 'CPPP', 'NHAI/2026/GJ/RJK-BP/01'),
];

const DATES = [
  { label: 'Published', date: TENDER.published, past: true },
  { label: 'Pre-bid Meeting', date: TENDER.preBid, past: true },
  { label: 'Corrigendum', date: TENDER.corrigendum, past: true },
  { label: 'Submission Deadline', date: TENDER.deadline, past: false },
  { label: 'Bid Opening', date: TENDER.bidOpening, past: false },
];

const ELIG_ITEMS: { label: string; pass: boolean; detail: string }[] = [
  { label: 'Annual Turnover', pass: true, detail: 'Required: 50 Cr | Yours: 65 Cr' },
  { label: 'Experience Years', pass: true, detail: 'Required: 10 yrs | Yours: 12 yrs' },
  { label: 'ISO Certification', pass: true, detail: 'ISO 9001:2015 - Valid' },
  { label: 'Similar Projects', pass: false, detail: 'Required: 25 Cr | Yours: 20 Cr' },
  { label: 'GST Registration', pass: true, detail: 'Active - Verified' },
  { label: 'Net Worth', pass: true, detail: 'Required: 15 Cr | Yours: 22 Cr' },
];

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: '#DCFCE7', text: lightColors.success, label: 'Active' },
  CLOSED: { bg: '#F3F4F6', text: lightColors.textTertiary, label: 'Closed' },
  AWARDED: { bg: '#FEF3C7', text: lightColors.warning, label: 'Awarded' },
  CANCELLED: { bg: '#FEE2E2', text: lightColors.danger, label: 'Cancelled' },
};

const PORTAL_ICON: Record<string, string> = { CPPP: 'web', GeM: 'store', 'e-Procurement': 'monitor' };

// ── Pulsing Dot (timeline upcoming date) ─────────────────────────────────────

const PulsingDot: React.FC = () => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.6], [0.5, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={tlStyles.dotWrap}>
      <Animated.View style={[tlStyles.pulseRing, ringStyle]} />
      <View style={[tlStyles.dot, { backgroundColor: lightColors.primary }]} />
    </View>
  );
};

// ── Use Reanimated's built-in Animated.ScrollView ───────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════

function TenderDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  // -- Local state --
  const [activeTab, setActiveTab] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const [eligLoading, setEligLoading] = useState(false);
  const [eligDone, setEligDone] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // -- Zustand --
  const saved = useSavedStore((s) => s.isSaved(id));
  const addSaved = useSavedStore((s) => s.addSaved);
  const removeSaved = useSavedStore((s) => s.removeSaved);

  // -- Subscription limits --
  const checkLimit = useSubscriptionStore((s) => s.checkLimit);
  const aiCheckLimit = checkLimit('maxAiChecks');

  // -- Refs --
  const scrollRef = useRef<ScrollView>(null);

  // -- Shared values --
  const scrollY = useSharedValue(0);
  const tabIndicatorX = useSharedValue(0);
  const topInset = insets.top;
  const tabWidth = SCREEN_WIDTH / 4;

  // -- Scroll handler --
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ── Animated styles ────────────────────────────────────────────────────────

  const headerAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [HEADER_EXPANDED + topInset, HEADER_COLLAPSED + topInset],
      Extrapolation.CLAMP,
    ),
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{
      translateY: interpolate(
        scrollY.value,
        [0, SCROLL_DISTANCE],
        [0, -30],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  const collapsedTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [SCROLL_DISTANCE * 0.7, SCROLL_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Animate tab indicator on tab change
  useEffect(() => {
    tabIndicatorX.value = withSpring(activeTab * tabWidth, {
      damping: 20,
      stiffness: 300,
      mass: 0.5,
    });
  }, [activeTab, tabIndicatorX, tabWidth]);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
    width: tabWidth,
  }));

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const toggleSave = useCallback(() => {
    saved ? removeSaved(id) : addSaved(id);
  }, [saved, id, addSaved, removeSaved]);

  const onShare = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTS);
    try {
      await Share.share({
        title: TENDER.title,
        message:
          `Check out this tender on TenderBazaar:\n\n` +
          `${TENDER.title}\n${TENDER.organization}\n` +
          `Value: ${formatCurrency(TENDER.estimatedValue)}\n\n` +
          `tenderbazaar://tender/${id}`,
      });
    } catch {
      // User cancelled sharing
    }
  }, [id]);

  const copyRef = useCallback(() => {
    Clipboard.setString(TENDER.referenceNumber);
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTS);
  }, []);

  const callContact = useCallback(() => {
    Linking.openURL(`tel:${TENDER.contact.phone}`);
  }, []);

  const emailContact = useCallback(() => {
    Linking.openURL(`mailto:${TENDER.contact.email}`);
  }, []);

  const onTabChange = useCallback((index: number) => {
    setActiveTab(index);
    ReactNativeHapticFeedback.trigger('selection', HAPTIC_OPTS);
  }, []);

  const checkEligibility = useCallback(() => {
    if (eligDone) {
      navigation.navigate('EligibilityResult', { tenderId: id, score: 82 });
      return;
    }
    setEligLoading(true);
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTS);
    setTimeout(() => {
      setEligLoading(false);
      setEligDone(true);
      navigation.navigate('EligibilityResult', { tenderId: id, score: 82 });
    }, 3000);
  }, [eligDone, id, navigation]);

  const toggleCompare = useCallback((tenderId: string) => {
    setCompareIds((prev) =>
      prev.includes(tenderId)
        ? prev.filter((x) => x !== tenderId)
        : [...prev, tenderId],
    );
  }, []);

  const doCompare = useCallback(() => {
    if (compareIds.length >= 2) {
      navigation.navigate('TenderCompare', { ids: compareIds });
    }
  }, [compareIds, navigation]);

  const onDescLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // 5 lines at ~21px line-height = ~105px
      if (e.nativeEvent.layout.height > 105 && !descExpanded) {
        setDescOverflows(true);
      }
    },
    [descExpanded],
  );

  const toggleDesc = useCallback(() => {
    setDescExpanded((prev) => !prev);
    ReactNativeHapticFeedback.trigger('selection', HAPTIC_OPTS);
  }, []);

  // Next upcoming date index for timeline pulsing dot
  const nextDateIdx = useMemo(() => {
    const nowMs = NOW.getTime();
    for (let i = 0; i < DATES.length; i++) {
      if (new Date(DATES[i].date).getTime() > nowMs) return i;
    }
    return -1;
  }, []);

  const statusCfg = STATUS_CFG[TENDER.status];
  const headerMarginTop = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: Overview
  // ══════════════════════════════════════════════════════════════════════════

  const renderOverview = useCallback(() => (
    <View style={styles.tabContent}>
      {/* Key Details Card */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Key Details</Text>

        {/* Reference Number (copyable) */}
        <TouchableOpacity
          style={styles.detailRow}
          onPress={copyRef}
          activeOpacity={0.6}
          accessibilityHint="Tap to copy reference number"
        >
          <View style={styles.detailIconWrap}>
            <MCIcon name="identifier" size={18} color={lightColors.textSecondary} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Reference Number</Text>
            <View style={styles.rowCenter}>
              <Text style={styles.detailValue}>{TENDER.referenceNumber}</Text>
              <MCIcon name="content-copy" size={14} color={lightColors.primary} style={{ marginLeft: 6 }} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Source Portal */}
        <View style={styles.detailRow}>
          <View style={styles.detailIconWrap}>
            <MCIcon name={PORTAL_ICON[TENDER.sourcePortal] || 'web'} size={18} color={lightColors.textSecondary} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Source Portal</Text>
            <Text style={styles.detailValue}>{TENDER.sourcePortal}</Text>
          </View>
        </View>

        {/* Published Date */}
        <View style={styles.detailRow}>
          <View style={styles.detailIconWrap}>
            <MCIcon name="calendar" size={18} color={lightColors.textSecondary} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Published Date</Text>
            <Text style={styles.detailValue}>{fmtDate(TENDER.published)}</Text>
          </View>
        </View>

        {/* Submission Deadline */}
        <View style={[styles.detailRow, styles.detailRowLast]}>
          <View style={styles.detailIconWrap}>
            <MCIcon name="clock-outline" size={18} color={lightColors.textSecondary} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Submission Deadline</Text>
            <View style={[styles.rowCenter, { gap: 8 }]}>
              <Text style={styles.detailValue}>{fmtDate(TENDER.deadline)}</Text>
              <DeadlineBadge deadline={TENDER.deadline} />
            </View>
          </View>
        </View>
      </View>

      {/* Financial Card */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Financial Details</Text>

        <View style={styles.finHighlight}>
          <Text style={styles.finHighlightLabel}>Estimated Value</Text>
          <Text style={styles.finHighlightValue}>{formatCurrency(TENDER.estimatedValue)}</Text>
        </View>

        <View style={styles.finGrid}>
          {([
            ['EMD Amount', TENDER.emdAmount],
            ['Tender Fee', TENDER.tenderFee],
            ['Document Cost', TENDER.documentCost],
          ] as const).map(([label, value], idx) => (
            <React.Fragment key={label}>
              {idx > 0 && <View style={styles.finDivider} />}
              <View style={styles.finItem}>
                <Text style={styles.finLabel}>{label}</Text>
                <Text style={styles.finValue}>{formatCurrency(value)}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Description Card */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text
          style={styles.descText}
          numberOfLines={descExpanded ? undefined : 5}
          onLayout={onDescLayout}
        >
          {TENDER.description}
        </Text>
        {descOverflows && (
          <TouchableOpacity onPress={toggleDesc} style={styles.readMoreBtn} activeOpacity={0.7}>
            <Text style={styles.readMoreText}>{descExpanded ? 'Show less' : 'Read more'}</Text>
            <MCIcon
              name={descExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={lightColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Eligibility Criteria Card */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Eligibility Criteria</Text>
        {TENDER.criteria.map((criterion, idx) => (
          <View key={idx} style={styles.criteriaRow}>
            <MCIcon
              name="check-circle"
              size={18}
              color={lightColors.accent}
              style={styles.criteriaIcon}
            />
            <Text style={styles.criteriaText}>{criterion}</Text>
          </View>
        ))}
      </View>

      {/* Contact Info Card */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Contact Information</Text>

        <View style={styles.contactHeader}>
          <MCIcon name="account" size={18} color={lightColors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName}>{TENDER.contact.name}</Text>
            <Text style={styles.contactDesig}>{TENDER.contact.designation}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.contactAction} onPress={emailContact} activeOpacity={0.7}>
          <MCIcon name="email-outline" size={18} color={lightColors.primary} />
          <Text style={styles.contactActionText}>{TENDER.contact.email}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.contactAction, { marginTop: 8 }]} onPress={callContact} activeOpacity={0.7}>
          <MCIcon name="phone-outline" size={18} color={lightColors.primary} />
          <Text style={styles.contactActionText}>{TENDER.contact.phone}</Text>
        </TouchableOpacity>
      </View>

      {/* Important Dates Timeline */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Important Dates</Text>
        <View style={tlStyles.container}>
          {DATES.map((item, idx) => {
            const isNext = idx === nextDateIdx;
            const isLast = idx === DATES.length - 1;
            return (
              <View key={idx} style={tlStyles.row}>
                <View style={tlStyles.lineCol}>
                  {isNext ? (
                    <PulsingDot />
                  ) : (
                    <View
                      style={[
                        tlStyles.dot,
                        { backgroundColor: item.past ? lightColors.success : lightColors.textTertiary },
                      ]}
                    />
                  )}
                  {!isLast && (
                    <View
                      style={[
                        tlStyles.line,
                        { backgroundColor: item.past ? lightColors.success + '40' : lightColors.border },
                      ]}
                    />
                  )}
                </View>
                <View style={tlStyles.content}>
                  <Text
                    style={[
                      tlStyles.label,
                      isNext && { color: lightColors.primary, fontFamily: fontFamilies.semiBold, fontWeight: '600' as const },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={[tlStyles.date, isNext && { color: lightColors.primary }]}>
                    {fmtDate(item.date)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  ), [descExpanded, descOverflows, copyRef, onDescLayout, toggleDesc, emailContact, callContact, nextDateIdx]);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: Eligibility
  // ══════════════════════════════════════════════════════════════════════════

  const renderEligibility = useCallback(() => (
    <View style={styles.tabContent}>
      {/* Initial CTA state */}
      {!eligDone && !eligLoading && (
        <View style={[styles.card, shadows.sm, styles.eligCTACard]}>
          <View style={styles.eligIconWrap}>
            <MCIcon name="shield-check-outline" size={40} color={lightColors.primary} />
          </View>
          <Text style={styles.eligTitle}>Check Your Eligibility</Text>
          <Text style={styles.eligSubtitle}>
            Verify if your company meets all the requirements for this tender using our AI-powered eligibility engine.
          </Text>
          {!aiCheckLimit.hasCapacity && !aiCheckLimit.isUnlimited ? (
            <UpgradeBanner
              feature="AI Eligibility Checks"
              requiredPlan="Starter"
              variant="card"
            />
          ) : (
            <>
              <View style={styles.planWarning}>
                <MCIcon name="information-outline" size={16} color={lightColors.warning} />
                <Text style={styles.planWarningText}>
                  {aiCheckLimit.isUnlimited
                    ? 'Unlimited AI checks available'
                    : `${aiCheckLimit.remaining} of ${aiCheckLimit.limit} checks remaining`}
                </Text>
              </View>
              <TouchableOpacity style={styles.eligBtn} onPress={checkEligibility} activeOpacity={0.85}>
                <MCIcon name="shield-check" size={20} color="#FFFFFF" />
                <Text style={styles.eligBtnText}>Check Eligibility</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Loading state */}
      {eligLoading && (
        <View style={[styles.card, shadows.sm, styles.eligLoadingCard]}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={[styles.eligTitle, { marginTop: 20 }]}>Analyzing Eligibility...</Text>
          <Text style={styles.eligSubtitle}>
            Our AI is reviewing your company profile against the tender requirements.
          </Text>
        </View>
      )}

      {/* Completed state */}
      {eligDone && !eligLoading && (
        <>
          {/* Score ring */}
          <View style={[styles.card, shadows.sm, styles.scoreCard]}>
            <View style={styles.scoreRing}>
              <View style={styles.rowCenter}>
                <Text style={styles.scoreValue}>82</Text>
                <Text style={styles.scorePercent}>%</Text>
              </View>
            </View>
            <Text style={styles.scoreLabel}>Eligibility Score</Text>
            <Text style={styles.eligSubtitle}>
              You meet most requirements for this tender
            </Text>
            <Badge
              variant="status"
              label="Good Match"
              backgroundColor={lightColors.success + '1A'}
              color={lightColors.success}
            />
          </View>

          {/* Summary */}
          <View style={[styles.card, shadows.sm]}>
            <Text style={styles.cardTitle}>Quick Summary</Text>
            {ELIG_ITEMS.map((item, idx) => (
              <View key={idx} style={styles.summaryRow}>
                <MCIcon
                  name={item.pass ? 'check-circle' : 'alert-circle'}
                  size={20}
                  color={item.pass ? lightColors.success : lightColors.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Full report button */}
          <TouchableOpacity
            style={[styles.reportBtn, shadows.sm]}
            onPress={() => navigation.navigate('EligibilityResult', { tenderId: id, score: 82 })}
            activeOpacity={0.85}
          >
            <Text style={styles.reportBtnText}>View Full Report</Text>
            <MCIcon name="arrow-right" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}
    </View>
  ), [eligDone, eligLoading, checkEligibility, id, navigation]);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: Documents
  // ══════════════════════════════════════════════════════════════════════════

  const renderDocuments = useCallback(() => (
    <View style={styles.tabContent}>
      <View style={[styles.card, shadows.sm]}>
        <View style={styles.docHeader}>
          <Text style={styles.cardTitle}>Tender Documents</Text>
          <Text style={styles.docCount}>{TENDER.documents.length} files</Text>
        </View>

        {TENDER.documents.map((doc, idx) => (
          <TouchableOpacity
            key={doc.id}
            style={[
              styles.docRow,
              idx === TENDER.documents.length - 1 && styles.docRowLast,
            ]}
            activeOpacity={0.7}
          >
            <View style={[styles.docIconWrap, { backgroundColor: doc.color + '14' }]}>
              <MCIcon name={doc.icon} size={24} color={doc.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
              <Text style={styles.docMeta}>{doc.type} - {doc.size}</Text>
            </View>
            <TouchableOpacity
              style={styles.downloadBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FeatherIcon name="download" size={18} color={lightColors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.viewAllBtn, shadows.sm]}
        onPress={() => navigation.navigate('TenderDocuments', { tenderId: id })}
        activeOpacity={0.85}
      >
        <MCIcon name="folder-open-outline" size={20} color={lightColors.primary} />
        <Text style={styles.viewAllBtnText}>View All Documents</Text>
        <MCIcon name="chevron-right" size={20} color={lightColors.primary} />
      </TouchableOpacity>
    </View>
  ), [id, navigation]);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: Similar
  // ══════════════════════════════════════════════════════════════════════════

  const renderSimilar = useCallback(() => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Similar Tenders</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.similarScroll}
        decelerationRate="fast"
        snapToInterval={274}
      >
        {SIMILAR_TENDERS.map((tender) => (
          <TenderMiniCard
            key={tender.id}
            tender={tender}
            onPress={() => navigation.push('TenderDetail', { id: tender.id })}
            style={{ marginRight: 14 }}
          />
        ))}
      </ScrollView>

      {/* Compare selection */}
      <View style={[styles.card, shadows.sm, { marginTop: 20 }]}>
        <Text style={styles.cardTitle}>Compare Tenders</Text>
        <Text style={styles.compareSubtitle}>
          Select 2 or more tenders to compare side by side
        </Text>

        {SIMILAR_TENDERS.slice(0, 4).map((tender) => {
          const selected = compareIds.includes(tender.id);
          return (
            <TouchableOpacity
              key={tender.id}
              style={[styles.compareRow, selected && styles.compareRowSelected]}
              onPress={() => toggleCompare(tender.id)}
              activeOpacity={0.7}
            >
              <MCIcon
                name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={selected ? lightColors.primary : lightColors.textTertiary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.compareTitle} numberOfLines={1}>{tender.title}</Text>
                <Text style={styles.compareOrg}>
                  {tender.organization} - {formatCurrency(tender.estimatedValue)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {compareIds.length >= 2 && (
          <TouchableOpacity style={styles.compareBtn} onPress={doCompare} activeOpacity={0.85}>
            <MCIcon name="compare" size={18} color="#FFFFFF" />
            <Text style={styles.compareBtnText}>Compare {compareIds.length} Tenders</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [compareIds, toggleCompare, doCompare, navigation]);

  // -- Tab content array --
  const tabRenderers = useMemo(
    () => [renderOverview, renderEligibility, renderDocuments, renderSimilar],
    [renderOverview, renderEligibility, renderDocuments, renderSimilar],
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={lightColors.secondary} translucent />

      {/* ── Animated Header ── */}
      <Animated.View style={[styles.header, headerAnimStyle, { paddingTop: topInset }]}>
        {/* Gradient background */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lightColors.secondary }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lightColors.secondaryLight, opacity: 0.3 }]} />

        {/* Expanded content (fades out on scroll) */}
        <Animated.View style={[styles.headerExpanded, expandedContentStyle]}>
          <View style={styles.headerBadges}>
            <Badge variant="category" category={TENDER.category} size="sm" />
            <Badge
              variant="status"
              label={statusCfg.label}
              backgroundColor={statusCfg.bg}
              color={statusCfg.text}
              size="sm"
            />
          </View>
          <Text style={styles.headerTitle} numberOfLines={3}>{TENDER.title}</Text>
          <View style={styles.rowCenter}>
            <MCIcon name="domain" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.headerOrg} numberOfLines={1}>{TENDER.organization}</Text>
            <View style={styles.headerDot} />
            <MCIcon name="map-marker" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.headerState}>{TENDER.state}</Text>
          </View>
        </Animated.View>

        {/* Collapsed title (fades in on scroll) */}
        <Animated.View style={[styles.headerCollapsed, collapsedTitleStyle, { marginTop: headerMarginTop }]}>
          <Text style={styles.headerCollapsedTitle} numberOfLines={1}>{TENDER.title}</Text>
        </Animated.View>

        {/* Top bar: back + share + save */}
        <View style={[styles.headerTopBar, { marginTop: headerMarginTop }]}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FeatherIcon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={[styles.rowCenter, { gap: 4 }]}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onShare}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FeatherIcon name="share-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <SaveButton
              isSaved={saved}
              onToggle={toggleSave}
              size={22}
              style={styles.headerSaveBtn}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── Sticky Tab Bar ── */}
      <View style={[styles.tabBar, shadows.sm]}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => onTabChange(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === idx && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
      </View>

      {/* ── Scrollable Content ── */}
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_HEIGHT + 20 }}
        bounces
        overScrollMode="never"
      >
        {/* Spacer for header + tab bar */}
        <View style={{ height: HEADER_EXPANDED + topInset + TAB_HEIGHT }} />
        {tabRenderers[activeTab]()}
      </Animated.ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.bottomBar, shadows.lg, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={[styles.bottomBtn, styles.bottomOutline]} onPress={toggleSave} activeOpacity={0.7}>
          <MCIcon
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? lightColors.primary : lightColors.textPrimary}
          />
          <Text style={[styles.bottomLabel, saved && { color: lightColors.primary }]}>
            {saved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.bottomBtn, styles.bottomPrimary]} onPress={checkEligibility} activeOpacity={0.85}>
          {eligLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MCIcon name="shield-check" size={20} color="#FFFFFF" />
              <Text style={styles.bottomPrimaryLabel}>
                {eligDone ? 'View Report' : 'Check Eligibility'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.bottomBtn, styles.bottomOutline]} onPress={onShare} activeOpacity={0.7}>
          <FeatherIcon name="share-2" size={18} color={lightColors.textPrimary} />
          <Text style={styles.bottomLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },

  // Header
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
  headerTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerSaveBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerExpanded: { position: 'absolute', bottom: 16, left: 20, right: 20 },
  headerBadges: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  headerTitle: { fontFamily: fontFamilies.bold, fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 26, letterSpacing: -0.3, marginBottom: 8 },
  headerOrg: { fontFamily: fontFamilies.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', flexShrink: 1, marginLeft: 4 },
  headerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 6 },
  headerState: { fontFamily: fontFamilies.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  headerCollapsed: { position: 'absolute', bottom: 0, left: 56, right: 100, height: 56, justifyContent: 'center' },
  headerCollapsedTitle: { fontFamily: fontFamilies.semiBold, fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },

  // Tab bar
  tabBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99, flexDirection: 'row', backgroundColor: lightColors.surface, borderBottomWidth: 1, borderBottomColor: lightColors.border, height: TAB_HEIGHT },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_HEIGHT },
  tabText: { fontFamily: fontFamilies.medium, fontSize: 14, fontWeight: '500', color: lightColors.textSecondary },
  tabTextActive: { fontFamily: fontFamilies.semiBold, fontWeight: '600', color: lightColors.primary },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, backgroundColor: lightColors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },

  // Content
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: lightColors.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700', color: lightColors.textPrimary, marginBottom: 16, letterSpacing: -0.2 },

  // Key details
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: lightColors.borderLight },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: lightColors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailTextWrap: { flex: 1 },
  detailLabel: { fontFamily: fontFamilies.regular, fontSize: 12, color: lightColors.textSecondary, marginBottom: 2, letterSpacing: 0.1 },
  detailValue: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.textPrimary },

  // Financial
  finHighlight: { backgroundColor: lightColors.primary + '0A', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: lightColors.primary + '20' },
  finHighlightLabel: { fontFamily: fontFamilies.medium, fontSize: 12, fontWeight: '500', color: lightColors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  finHighlightValue: { fontFamily: fontFamilies.extraBold, fontSize: 28, fontWeight: '800', color: lightColors.primary, letterSpacing: -0.5 },
  finGrid: { flexDirection: 'row', alignItems: 'center' },
  finItem: { flex: 1, alignItems: 'center' },
  finLabel: { fontFamily: fontFamilies.regular, fontSize: 11, color: lightColors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  finValue: { fontFamily: fontFamilies.bold, fontSize: 15, fontWeight: '700', color: lightColors.textPrimary },
  finDivider: { width: 1, height: 32, backgroundColor: lightColors.border },

  // Description
  descText: { fontFamily: fontFamilies.regular, fontSize: 14, color: lightColors.textSecondary, lineHeight: 21, letterSpacing: 0.1 },
  readMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  readMoreText: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.primary },

  // Criteria
  criteriaRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  criteriaIcon: { marginRight: 10, marginTop: 1 },
  criteriaText: { flex: 1, fontFamily: fontFamilies.regular, fontSize: 14, color: lightColors.textPrimary, lineHeight: 20 },

  // Contact
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  contactName: { fontFamily: fontFamilies.semiBold, fontSize: 15, fontWeight: '600', color: lightColors.textPrimary },
  contactDesig: { fontFamily: fontFamilies.regular, fontSize: 13, color: lightColors.textSecondary, marginTop: 2 },
  contactAction: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: lightColors.primary + '08', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: lightColors.primary + '18' },
  contactActionText: { fontFamily: fontFamilies.medium, fontSize: 13, fontWeight: '500', color: lightColors.primary },

  // Eligibility tab
  eligCTACard: { alignItems: 'center', paddingVertical: 32 },
  eligLoadingCard: { alignItems: 'center', paddingVertical: 48 },
  scoreCard: { alignItems: 'center', paddingVertical: 28 },
  eligIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: lightColors.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  eligTitle: { fontFamily: fontFamilies.bold, fontSize: 20, fontWeight: '700', color: lightColors.textPrimary, marginBottom: 8, textAlign: 'center' },
  eligSubtitle: { fontFamily: fontFamilies.regular, fontSize: 14, color: lightColors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 12 },
  planWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: lightColors.warning + '12', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginBottom: 20 },
  planWarningText: { fontFamily: fontFamilies.medium, fontSize: 12, fontWeight: '500', color: lightColors.warningDark },
  eligBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, backgroundColor: lightColors.primary, borderRadius: 14, paddingHorizontal: 32, gap: 8, alignSelf: 'stretch' },
  eligBtnText: { fontFamily: fontFamilies.semiBold, fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.2 },
  scoreRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: lightColors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  scoreValue: { fontFamily: fontFamilies.extraBold, fontSize: 34, fontWeight: '800', color: lightColors.success },
  scorePercent: { fontFamily: fontFamilies.bold, fontSize: 16, fontWeight: '700', color: lightColors.success },
  scoreLabel: { fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700', color: lightColors.textPrimary, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: lightColors.borderLight, gap: 12 },
  summaryLabel: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.textPrimary },
  summaryDetail: { fontFamily: fontFamilies.regular, fontSize: 12, color: lightColors.textSecondary, marginTop: 2 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, backgroundColor: lightColors.accent, borderRadius: 14, gap: 8, marginBottom: 16 },
  reportBtnText: { fontFamily: fontFamilies.semiBold, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  // Documents tab
  docHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  docCount: { fontFamily: fontFamilies.medium, fontSize: 13, fontWeight: '500', color: lightColors.textTertiary },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: lightColors.borderLight, gap: 12 },
  docRowLast: { borderBottomWidth: 0 },
  docIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docName: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.textPrimary, marginBottom: 2 },
  docMeta: { fontFamily: fontFamilies.regular, fontSize: 12, color: lightColors.textSecondary },
  downloadBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: lightColors.primary + '0A', alignItems: 'center', justifyContent: 'center' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, backgroundColor: lightColors.surface, borderRadius: 14, borderWidth: 1, borderColor: lightColors.primary + '30', gap: 8, marginBottom: 16 },
  viewAllBtnText: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.primary, flex: 1 },

  // Similar tab
  sectionTitle: { fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700', color: lightColors.textPrimary, marginBottom: 14, letterSpacing: -0.2 },
  similarScroll: { paddingRight: 16, paddingBottom: 4 },
  compareSubtitle: { fontFamily: fontFamilies.regular, fontSize: 13, color: lightColors.textSecondary, marginTop: -8, marginBottom: 14 },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: lightColors.borderLight, gap: 10 },
  compareRowSelected: { backgroundColor: lightColors.primary + '06', marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 0 },
  compareTitle: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: lightColors.textPrimary },
  compareOrg: { fontFamily: fontFamilies.regular, fontSize: 12, color: lightColors.textSecondary, marginTop: 2 },
  compareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, backgroundColor: lightColors.secondary, borderRadius: 12, marginTop: 16, gap: 8 },
  compareBtnText: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: BOTTOM_HEIGHT, paddingHorizontal: 16, paddingTop: 12, backgroundColor: lightColors.surface, borderTopWidth: 1, borderTopColor: lightColors.borderLight, gap: 10 },
  bottomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, gap: 6 },
  bottomOutline: { flex: 0.8, borderWidth: 1.5, borderColor: lightColors.border, backgroundColor: lightColors.surface },
  bottomPrimary: { flex: 1.4, backgroundColor: lightColors.primary },
  bottomLabel: { fontFamily: fontFamilies.semiBold, fontSize: 13, fontWeight: '600', color: lightColors.textPrimary },
  bottomPrimaryLabel: { fontFamily: fontFamilies.semiBold, fontSize: 14, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.2 },
});

// ── Timeline Styles ──────────────────────────────────────────────────────────

const tlStyles = StyleSheet.create({
  container: { paddingLeft: 4 },
  row: { flexDirection: 'row', minHeight: 56 },
  lineCol: { width: 24, alignItems: 'center' },
  dotWrap: {
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pulseRing: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    backgroundColor: lightColors.primary,
  },
  line: { width: 2, flex: 1, marginVertical: 2, borderRadius: 1 },
  content: { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  label: {
    fontFamily: fontFamilies.medium, fontSize: 14, fontWeight: '500',
    color: lightColors.textPrimary, marginBottom: 2,
  },
  date: {
    fontFamily: fontFamilies.regular, fontSize: 13, color: lightColors.textSecondary,
  },
});

// ── Export ────────────────────────────────────────────────────────────────────

export default React.memo(TenderDetailScreen);
