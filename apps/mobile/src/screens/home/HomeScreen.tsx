/**
 * TenderBazaar — Premium Home Screen (Dashboard)
 *
 * World-class animated dashboard with:
 *  - Collapsible header with Reanimated scroll interpolation
 *  - Animated count-up stat cards
 *  - Quick action circles with haptic feedback
 *  - Recommended tenders (TenderCard)
 *  - Expiring soon horizontal list (TenderMiniCard)
 *  - Browse by category grid
 *  - Recent results section
 *  - Pull to refresh
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useDerivedValue,
  interpolate,
  Extrapolation,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import dayjs from 'dayjs';

import { useAuthStore } from '../../stores/authStore';
import type { RootStackParamList } from '../../types/navigation';
import TenderCard from '../../components/tender/TenderCard';
import TenderMiniCard from '../../components/tender/TenderMiniCard';
import { formatCurrency } from '../../utils/format';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const BORDER = '#E8ECF1';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_COLLAPSE_THRESHOLD = 120;

// ---------------------------------------------------------------------------
// Navigation type
// ---------------------------------------------------------------------------

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface StatCardData {
  id: string;
  label: string;
  rawValue: number;
  displaySuffix: string;
  icon: string;
  color: string;
}

interface QuickActionData {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string;
}

interface CategoryData {
  id: string;
  label: string;
  icon: string;
  color: string;
  count: string;
}

interface RecentResultData {
  id: string;
  winnerName: string;
  tenderTitle: string;
  awardedValue: number;
  awardDate: string;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const STATS: StatCardData[] = [
  { id: 'new', label: 'New Today', rawValue: 284, displaySuffix: '', icon: 'file-document-outline', color: PRIMARY },
  { id: 'active', label: 'Active', rawValue: 12438, displaySuffix: '', icon: 'lightning-bolt', color: '#3B82F6' },
  { id: 'saved', label: 'Saved', rawValue: 23, displaySuffix: '', icon: 'bookmark-outline', color: ACCENT },
  { id: 'ai', label: 'AI Score', rawValue: 87, displaySuffix: '%', icon: 'brain', color: '#7C3AED' },
];

const QUICK_ACTIONS: QuickActionData[] = [
  { id: 'search', label: 'Search', icon: 'magnify', color: PRIMARY, route: 'SearchTab' },
  { id: 'eligibility', label: 'Eligibility', icon: 'head-lightbulb-outline', color: ACCENT, route: 'TenderDetail' },
  { id: 'alerts', label: 'Alerts', icon: 'bell-plus-outline', color: '#3B82F6', route: 'CreateAlert' },
  { id: 'compare', label: 'Compare', icon: 'compare-horizontal', color: '#7C3AED', route: 'TenderCompare' },
];

const CATEGORIES: CategoryData[] = [
  { id: 'works', label: 'Works', icon: 'hammer-wrench', color: '#E8593C', count: '3,421 active' },
  { id: 'goods', label: 'Goods', icon: 'package-variant-closed', color: '#2563EB', count: '2,894 active' },
  { id: 'services', label: 'Services', icon: 'account-group-outline', color: '#0D9488', count: '1,756 active' },
  { id: 'consultancy', label: 'Consultancy', icon: 'head-lightbulb-outline', color: '#7C3AED', count: '987 active' },
];

const MOCK_RECOMMENDED_TENDERS = [
  {
    id: 'r1',
    title: 'Construction of 6-Lane Access Controlled Expressway from Ahmedabad to Dholera SIR',
    organization: 'National Highways Authority of India (NHAI)',
    state: 'Gujarat',
    category: 'Works' as const,
    estimatedValue: 452000000,
    emdAmount: 9040000,
    submissionDeadline: '2026-04-28T17:00:00Z',
    publishedDate: '2026-04-08T09:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'CPPP',
    referenceNumber: 'NHAI/2026/GJ/EXP-043',
  },
  {
    id: 'r2',
    title: 'Supply and Installation of 500 KV Power Transformers for Eastern Grid Substation',
    organization: 'Power Grid Corporation of India Ltd',
    state: 'West Bengal',
    category: 'Goods' as const,
    estimatedValue: 185000000,
    emdAmount: 3700000,
    submissionDeadline: '2026-04-25T15:00:00Z',
    publishedDate: '2026-04-07T11:30:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'GeM',
    referenceNumber: 'PGCIL/EG/TR-2026-118',
  },
  {
    id: 'r3',
    title: 'Annual Maintenance & Operations of Smart City CCTV Surveillance Network',
    organization: 'Surat Municipal Corporation',
    state: 'Gujarat',
    category: 'Services' as const,
    estimatedValue: 34500000,
    emdAmount: 690000,
    submissionDeadline: '2026-05-02T17:00:00Z',
    publishedDate: '2026-04-09T08:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'GeM',
    referenceNumber: 'SMC/IT/AMC-2026-027',
  },
  {
    id: 'r4',
    title: 'Design Consultancy for Redevelopment of 5 Railway Stations under Amrit Bharat Scheme',
    organization: 'Indian Railways (RLDA)',
    state: 'Multiple States',
    category: 'Consultancy' as const,
    estimatedValue: 78000000,
    emdAmount: 1560000,
    submissionDeadline: '2026-04-30T16:00:00Z',
    publishedDate: '2026-04-06T10:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'IREPS',
    referenceNumber: 'RLDA/ABS/CONSULT-2026-09',
  },
  {
    id: 'r5',
    title: 'Procurement of Medical Equipment and ICU Ventilators for District Hospitals Phase-II',
    organization: 'ONGC CSR Foundation / Ministry of Health',
    state: 'Rajasthan',
    category: 'Goods' as const,
    estimatedValue: 52000000,
    emdAmount: 1040000,
    submissionDeadline: '2026-05-05T17:30:00Z',
    publishedDate: '2026-04-10T06:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'GeM',
    referenceNumber: 'MOH/RJ/MED-EQ-2026-344',
  },
];

const MOCK_EXPIRING_TENDERS = [
  {
    id: 'e1',
    title: 'Emergency Water Pipeline Repair & Rehabilitation - Zone 3 & 4',
    organization: 'Delhi Jal Board',
    state: 'Delhi',
    category: 'Works' as const,
    estimatedValue: 89000000,
    emdAmount: 1780000,
    submissionDeadline: '2026-04-11T17:00:00Z',
    publishedDate: '2026-04-01T09:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'CPPP',
    referenceNumber: 'DJB/ZONE34/WP-2026-88',
  },
  {
    id: 'e2',
    title: 'Supply of IT Hardware & Networking Equipment for Govt Schools',
    organization: 'Dept of Education, Maharashtra',
    state: 'Maharashtra',
    category: 'Goods' as const,
    estimatedValue: 35000000,
    emdAmount: 700000,
    submissionDeadline: '2026-04-12T15:00:00Z',
    publishedDate: '2026-04-03T10:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'MahaTenders',
    referenceNumber: 'MAHA/EDU/IT-2026-172',
  },
  {
    id: 'e3',
    title: 'Construction of Flyover at NH-48 Junction near Manesar Industrial Area',
    organization: 'CPWD Haryana Division',
    state: 'Haryana',
    category: 'Works' as const,
    estimatedValue: 120000000,
    emdAmount: 2400000,
    submissionDeadline: '2026-04-13T17:00:00Z',
    publishedDate: '2026-04-02T08:30:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'CPPP',
    referenceNumber: 'CPWD/HR/FO-2026-056',
  },
  {
    id: 'e4',
    title: 'Housekeeping & Facility Management Services for Central Govt Complex',
    organization: 'NBCC India Limited',
    state: 'Delhi',
    category: 'Services' as const,
    estimatedValue: 15000000,
    emdAmount: 300000,
    submissionDeadline: '2026-04-16T16:00:00Z',
    publishedDate: '2026-04-05T07:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'GeM',
    referenceNumber: 'NBCC/FM/HK-2026-031',
  },
  {
    id: 'e5',
    title: 'Solar Panel Installation for Rural Health Centers under PM-KUSUM',
    organization: 'Ministry of New & Renewable Energy',
    state: 'Madhya Pradesh',
    category: 'Works' as const,
    estimatedValue: 45000000,
    emdAmount: 900000,
    submissionDeadline: '2026-04-14T17:00:00Z',
    publishedDate: '2026-04-04T10:00:00Z',
    status: 'ACTIVE' as const,
    sourcePortal: 'CPPP',
    referenceNumber: 'MNRE/MP/SOL-2026-099',
  },
];

const RECENT_RESULTS: RecentResultData[] = [
  {
    id: 'res1',
    winnerName: 'Larsen & Toubro Infrastructure',
    tenderTitle: 'Construction of Metro Line 4 Extension - Wadala to Kasarvadavli',
    awardedValue: 2340000000,
    awardDate: '2026-04-08',
  },
  {
    id: 'res2',
    winnerName: 'Tata Advanced Systems Ltd',
    tenderTitle: 'Supply of Radar Equipment for Indian Coast Guard Stations',
    awardedValue: 567000000,
    awardDate: '2026-04-07',
  },
  {
    id: 'res3',
    winnerName: 'Wipro Infrastructure Engineering',
    tenderTitle: 'Smart Traffic Management System for Pune Smart City',
    awardedValue: 89000000,
    awardDate: '2026-04-06',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '\u2600\uFE0F';
  if (hour < 17) return '\uD83C\uDF24\uFE0F';
  return '\uD83C\uDF19';
}

function formatStatNumber(value: number): string {
  if (value >= 10000) {
    return value.toLocaleString('en-IN');
  }
  return value.toString();
}

function triggerHaptic() {
  try {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch {
    // Haptic not available — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Animated stat card with count-up
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const StatCardItem = React.memo(function StatCardItem({
  stat,
  index,
}: {
  stat: StatCardData;
  index: number;
}) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  // Trigger count-up animation on mount
  React.useEffect(() => {
    const delay = index * 100;
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [progress, index]);

  const animatedNumber = useDerivedValue(() => {
    return Math.round(interpolate(progress.value, [0, 1], [0, stat.rawValue]));
  });

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [scale]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.statCard, scaleStyle]}
    >
      <View style={[styles.statIconCircle, { backgroundColor: stat.color + '1F' }]}>
        <Icon name={stat.icon} size={20} color={stat.color} />
      </View>
      <AnimatedStatNumber
        animatedNum={animatedNumber}
        suffix={stat.displaySuffix}
      />
      <Text style={styles.statLabel}>{stat.label}</Text>
    </AnimatedPressable>
  );
});

// Animated stat number — uses JS-thread count-up to avoid worklet text issues
const AnimatedStatNumber = React.memo(function AnimatedStatNumber({
  animatedNum,
  suffix,
}: {
  animatedNum: { value: number };
  suffix: string;
}) {
  const [display, setDisplay] = React.useState('0');

  // Bridge animated value → JS state via useAnimatedReaction
  React.useEffect(() => {
    // Poll the shared value from JS thread (safe, runs every 16ms during animation)
    let rafId: number;
    let lastValue = -1;
    const tick = () => {
      const current = Math.round(animatedNum.value);
      if (current !== lastValue) {
        lastValue = current;
        if (current >= 10000) {
          setDisplay(current.toLocaleString('en-IN') + suffix);
        } else {
          setDisplay(current.toString() + suffix);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animatedNum, suffix]);

  return <Text style={styles.statValue}>{display}</Text>;
});

// ---------------------------------------------------------------------------
// Quick action button with haptic + spring
// ---------------------------------------------------------------------------

const QuickActionButton = React.memo(function QuickActionButton({
  action,
  onPress,
}: {
  action: QuickActionData;
  onPress: (route: string) => void;
}) {
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 12, stiffness: 350, mass: 0.5 });
    triggerHaptic();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 350, mass: 0.5 });
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(action.route);
  }, [action.route, onPress]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[styles.actionButton, scaleStyle]}
    >
      <View style={[styles.actionCircle, { backgroundColor: action.color + '1F' }]}>
        <Icon name={action.icon} size={28} color={action.color} />
      </View>
      <Text style={styles.actionLabel}>{action.label}</Text>
    </AnimatedPressable>
  );
});

// ---------------------------------------------------------------------------
// Category card
// ---------------------------------------------------------------------------

const CategoryCard = React.memo(function CategoryCard({
  category,
  onPress,
}: {
  category: CategoryData;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    triggerHaptic();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [scale]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[styles.categoryCard, scaleStyle]}
    >
      <View style={[styles.categoryIconBg, { backgroundColor: category.color + '26' }]}>
        <Icon name={category.icon} size={32} color={category.color} />
      </View>
      <Text style={styles.categoryLabel}>{category.label}</Text>
      <Text style={styles.categoryCount}>{category.count}</Text>
    </AnimatedPressable>
  );
});

// ---------------------------------------------------------------------------
// Recent result card
// ---------------------------------------------------------------------------

const RecentResultCard = React.memo(function RecentResultCard({
  result,
}: {
  result: RecentResultData;
}) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultAccentBar} />
      <View style={styles.resultIconContainer}>
        <Icon name="trophy" size={20} color="#F59E0B" />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultWinner} numberOfLines={1}>
          {result.winnerName}
        </Text>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {result.tenderTitle}
        </Text>
        <View style={styles.resultMeta}>
          <Text style={styles.resultValue}>
            {formatCurrency(result.awardedValue)}
          </Text>
          <Text style={styles.resultDate}>
            {dayjs(result.awardDate).format('DD MMM YYYY')}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Notification bell with pulsing badge
// ---------------------------------------------------------------------------

function NotificationBell({ onPress }: { onPress: () => void }) {
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulseScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.notificationButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon name="bell-outline" size={24} color={TEXT_PRIMARY} />
      <Animated.View style={[styles.notificationDot, dotStyle]} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = React.useState(false);

  const scrollY = useSharedValue(0);

  const firstName = useMemo(() => {
    return user?.name?.split(' ')[0] || 'User';
  }, [user?.name]);

  const formattedDate = useMemo(() => {
    return dayjs().format('dddd, DD MMM YYYY');
  }, []);

  // ---- Scroll handler ----
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ---- Animated header styles ----

  // Large header: greeting area
  const largeHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 80, HEADER_COLLAPSE_THRESHOLD],
      [1, 0.3, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_THRESHOLD],
      [0, -20],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_THRESHOLD],
      [72, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
      height,
      overflow: 'hidden' as const,
    };
  });

  // Small header: centered title
  const smallHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [80, HEADER_COLLAPSE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Header background
  const headerBgStyle = useAnimatedStyle(() => {
    const backgroundColor = `rgba(255, 255, 255, ${interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    )})`;
    const borderBottomWidth = interpolate(
      scrollY.value,
      [HEADER_COLLAPSE_THRESHOLD - 10, HEADER_COLLAPSE_THRESHOLD],
      [0, StyleSheet.hairlineWidth],
      Extrapolation.CLAMP,
    );
    return {
      backgroundColor,
      borderBottomWidth,
      borderBottomColor: BORDER,
    };
  });

  // ---- Pull to refresh ----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  }, []);

  // ---- Navigation handlers ----
  const handleNotificationPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const handleQuickAction = useCallback(
    (route: string) => {
      triggerHaptic();
      if (route === 'SearchTab') {
        navigation.navigate('Main', { screen: 'SearchTab' });
      } else if (route === 'TenderDetail') {
        // Placeholder: navigate to search for now
        navigation.navigate('Main', { screen: 'SearchTab' });
      } else if (route === 'CreateAlert') {
        navigation.navigate('CreateAlert');
      } else if (route === 'TenderCompare') {
        navigation.navigate('TenderCompare', { ids: [] });
      }
    },
    [navigation],
  );

  const handleTenderPress = useCallback(
    (id: string) => {
      navigation.navigate('TenderDetail', { id });
    },
    [navigation],
  );

  const handleCategoryPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'SearchTab' });
  }, [navigation]);

  const handleSeeAll = useCallback(() => {
    navigation.navigate('Main', { screen: 'SearchTab' });
  }, [navigation]);

  // ---- Render helpers ----

  const renderStatCard = useCallback(
    ({ item, index }: { item: StatCardData; index: number }) => (
      <StatCardItem stat={item} index={index} />
    ),
    [],
  );

  const renderExpiringTender = useCallback(
    ({ item }: { item: (typeof MOCK_EXPIRING_TENDERS)[0] }) => (
      <TenderMiniCard
        tender={item}
        onPress={() => handleTenderPress(item.id)}
      />
    ),
    [handleTenderPress],
  );

  // ---- Greeting emoji animation ----
  const emojiScale = useSharedValue(0);
  React.useEffect(() => {
    emojiScale.value = withSpring(1, {
      damping: 8,
      stiffness: 180,
      mass: 0.6,
    });
  }, [emojiScale]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ============================================================= */}
      {/*  ANIMATED HEADER BAR                                          */}
      {/* ============================================================= */}
      <Animated.View style={[styles.headerBar, headerBgStyle]}>
        {/* Large state: greeting */}
        <Animated.View style={[styles.largeHeader, largeHeaderStyle]}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingTextContainer}>
              <View style={styles.greetingMainRow}>
                <Text style={styles.greetingText}>
                  {getGreeting()},{' '}
                  <Text style={styles.greetingName}>{firstName}</Text>
                </Text>
                <Animated.Text style={[styles.greetingEmoji, emojiStyle]}>
                  {getGreetingEmoji()}
                </Animated.Text>
              </View>
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Small state: centered title */}
        <Animated.View style={[styles.smallHeader, smallHeaderStyle]} pointerEvents="none">
          <Text style={styles.smallHeaderTitle}>TenderBazaar</Text>
        </Animated.View>

        {/* Notification bell (always visible) */}
        <NotificationBell onPress={handleNotificationPress} />
      </Animated.View>

      {/* ============================================================= */}
      {/*  SCROLLABLE CONTENT                                           */}
      {/* ============================================================= */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
            progressBackgroundColor={CARD_BG}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* =========================================================== */}
        {/*  1. QUICK STATS ROW                                         */}
        {/* =========================================================== */}
        <View style={styles.statsSection}>
          <FlatList
            data={STATS}
            renderItem={renderStatCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
            ItemSeparatorComponent={StatSeparator}
          />
        </View>

        {/* =========================================================== */}
        {/*  2. QUICK ACTIONS                                           */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.actionsRow}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionButton
                key={action.id}
                action={action}
                onPress={handleQuickAction}
              />
            ))}
          </View>
        </View>

        {/* =========================================================== */}
        {/*  3. RECOMMENDED FOR YOU                                     */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all &rarr;</Text>
            </TouchableOpacity>
          </View>
          {MOCK_RECOMMENDED_TENDERS.map((tender) => (
            <View key={tender.id} style={styles.tenderCardWrapper}>
              <TenderCard
                tender={tender}
                onPress={() => handleTenderPress(tender.id)}
              />
            </View>
          ))}
        </View>

        {/* =========================================================== */}
        {/*  4. EXPIRING SOON                                           */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Expiring soon {'\u23F0'}
            </Text>
            <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all &rarr;</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={MOCK_EXPIRING_TENDERS}
            renderItem={renderExpiringTender}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.expiringContainer}
            ItemSeparatorComponent={CardSeparator}
          />
        </View>

        {/* =========================================================== */}
        {/*  5. BROWSE BY CATEGORY                                      */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by category</Text>
          </View>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onPress={handleCategoryPress}
              />
            ))}
          </View>
        </View>

        {/* =========================================================== */}
        {/*  6. RECENT RESULTS                                          */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Recent results {'\uD83C\uDFC6'}
            </Text>
            <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>View all &rarr;</Text>
            </TouchableOpacity>
          </View>
          {RECENT_RESULTS.map((result) => (
            <RecentResultCard key={result.id} result={result} />
          ))}
        </View>

        {/* Bottom spacer for floating tab bar */}
        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Separator components
// ---------------------------------------------------------------------------

function StatSeparator() {
  return <View style={{ width: 12 }} />;
}

function CardSeparator() {
  return <View style={{ width: 12 }} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ---- Root ----
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // ---- Header bar ----
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  largeHeader: {
    flex: 1,
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  greetingName: {
    color: PRIMARY,
  },
  greetingEmoji: {
    fontSize: 26,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    letterSpacing: 0.1,
  },
  smallHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },

  // ---- Notification bell ----
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: CARD_BG,
  },

  // ---- Scroll content ----
  scrollContent: {
    paddingBottom: 0,
  },

  // ---- Stats ----
  statsSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  statsContainer: {
    paddingHorizontal: 20,
  },
  statCard: {
    width: 130,
    height: 85,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#1B2845',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
  },

  // ---- Sections ----
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },

  // ---- Quick actions ----
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
  },

  // ---- Tender card wrapper ----
  tenderCardWrapper: {
    marginBottom: 12,
  },

  // ---- Expiring soon ----
  expiringContainer: {
    paddingRight: 20,
  },

  // ---- Categories ----
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 100,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#1B2845',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  categoryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // ---- Recent results ----
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1B2845',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  resultAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: ACCENT,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  resultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultWinner: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  resultDate: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // ---- Bottom spacer ----
  bottomSpacer: {
    height: 100,
  },
});
