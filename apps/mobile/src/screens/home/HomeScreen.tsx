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
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
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
import TenderCardSkeleton from '../../components/tender/TenderCardSkeleton';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { formatCurrency } from '../../utils/format';
import { toTenderCardData } from '../../utils/tenderCard';
import { formatStatNumber, getStatCardWidth, getStatValueFontSize } from '../../utils/homeStats';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useExpiringTenders, useRecommendedTenders } from '../../hooks/useTenders';
import type { DashboardStats } from '../../services/api/dashboard';
import type { TenderListItem } from '../../services/api/tenders';

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
  /** Which GET /dashboard stat the card shows. */
  statKey: keyof Pick<DashboardStats, 'newToday' | 'activeTenders' | 'savedCount' | 'avgAiScore'>;
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

// Values come from GET /dashboard (see useDashboardStats); only the presentation lives here.
const STATS: StatCardData[] = [
  { id: 'new', label: 'New Today', statKey: 'newToday', displaySuffix: '', icon: 'file-document-outline', color: PRIMARY },
  { id: 'active', label: 'Active', statKey: 'activeTenders', displaySuffix: '', icon: 'lightning-bolt', color: '#3B82F6' },
  { id: 'saved', label: 'Saved', statKey: 'savedCount', displaySuffix: '', icon: 'bookmark-outline', color: ACCENT },
  { id: 'ai', label: 'AI Score', statKey: 'avgAiScore', displaySuffix: '%', icon: 'brain', color: '#7C3AED' },
];

/** Number of tenders previewed on the home page; "See all" opens the full list. */
const RECOMMENDED_PREVIEW_COUNT = 5;
const EXPIRING_PREVIEW_COUNT = 10;

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
  value,
  isLoading,
  width,
}: {
  stat: StatCardData;
  index: number;
  /** null when there is no value to show (load failed, or no AI checks yet). */
  value: number | null;
  isLoading: boolean;
  width: number;
}) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  // Count up whenever a (new) value arrives, e.g. after pull-to-refresh.
  React.useEffect(() => {
    if (value === null) return;
    progress.value = 0;
    const delay = index * 100;
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [progress, index, value]);

  // Scale the number with the card so long values (e.g. 12,438) fit narrow cards.
  const valueFontSize = getStatValueFontSize(width);

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
      style={[styles.statCard, { width }, scaleStyle]}
      accessibilityLabel={`${stat.label}: ${value === null ? 'not available' : `${value}${stat.displaySuffix}`}`}
      testID={`stat-card-${stat.id}`}
    >
      <View style={[styles.statIconCircle, { backgroundColor: stat.color + '1F' }]}>
        <Icon name={stat.icon} size={20} color={stat.color} />
      </View>
      {isLoading ? (
        <SkeletonLoader width="60%" height={valueFontSize} borderRadius={6} style={styles.statValueSkeleton} />
      ) : value === null ? (
        <Text style={[styles.statValue, { fontSize: valueFontSize }]}>{'—'}</Text>
      ) : (
        <AnimatedStatNumber
          progress={progress}
          target={value}
          suffix={stat.displaySuffix}
          fontSize={valueFontSize}
        />
      )}
      <Text style={styles.statLabel} numberOfLines={1}>
        {stat.label}
      </Text>
    </AnimatedPressable>
  );
});

// Animated stat number — uses JS-thread count-up to avoid worklet text issues
const AnimatedStatNumber = React.memo(function AnimatedStatNumber({
  progress,
  target,
  suffix,
  fontSize,
}: {
  /** 0 → 1 count-up progress (a plain shared value, readable from the JS thread). */
  progress: { value: number };
  target: number;
  suffix: string;
  fontSize: number;
}) {
  const [display, setDisplay] = React.useState('0');

  React.useEffect(() => {
    // Poll the progress from the JS thread (runs every frame during animation).
    // The number is computed here rather than in a derived value: a derived value
    // rebuilt for a new target was not picked up by this JS-thread poll and stuck at 0.
    let rafId: number;
    let lastValue = -1;
    const tick = () => {
      const current = Math.round(Math.min(1, Math.max(0, progress.value)) * target);
      if (current !== lastValue) {
        lastValue = current;
        setDisplay(formatStatNumber(current) + suffix);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [progress, target, suffix]);

  return (
    <Text
      style={[styles.statValue, { fontSize }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {display}
    </Text>
  );
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
  const { width: windowWidth } = useWindowDimensions();
  const statCardWidth = getStatCardWidth(windowWidth);

  // Live data — filtering (open, not expired, expiry window) happens on the API.
  const statsQuery = useDashboardStats();
  const recommendedQuery = useRecommendedTenders(RECOMMENDED_PREVIEW_COUNT);
  const expiringQuery = useExpiringTenders(EXPIRING_PREVIEW_COUNT);

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
  const { refetch: refetchStats } = statsQuery;
  const { refetch: refetchRecommended } = recommendedQuery;
  const { refetch: refetchExpiring } = expiringQuery;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchRecommended(), refetchExpiring()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchStats, refetchRecommended, refetchExpiring]);

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

  // Recent results has no listing screen yet; unchanged, it still opens Search.
  const handleViewAllResults = useCallback(() => {
    navigation.navigate('Main', { screen: 'SearchTab' });
  }, [navigation]);

  // Each "See all" opens its own full listing (not the generic Search tab).
  const handleSeeAllRecommended = useCallback(() => {
    navigation.navigate('TenderList', { kind: 'recommended' });
  }, [navigation]);

  const handleSeeAllExpiring = useCallback(() => {
    navigation.navigate('TenderList', { kind: 'expiring' });
  }, [navigation]);

  // ---- Render helpers ----

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;
  const renderStatCard = useCallback(
    ({ item, index }: { item: StatCardData; index: number }) => (
      <StatCardItem
        stat={item}
        index={index}
        value={stats ? stats[item.statKey] : null}
        isLoading={statsLoading}
        width={statCardWidth}
      />
    ),
    [stats, statsLoading, statCardWidth],
  );

  const renderExpiringTender = useCallback(
    ({ item }: { item: TenderListItem }) => (
      <TenderMiniCard
        tender={toTenderCardData(item)}
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
            extraData={statCardWidth}
          />
          {statsQuery.isError && (
            <SectionMessage
              message="Couldn't load your stats."
              onRetry={() => statsQuery.refetch()}
              style={styles.statsError}
            />
          )}
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
            <TouchableOpacity
              onPress={handleSeeAllRecommended}
              activeOpacity={0.7}
              testID="see-all-recommended"
            >
              <Text style={styles.seeAllText}>See all &rarr;</Text>
            </TouchableOpacity>
          </View>
          {recommendedQuery.isLoading ? (
            <>
              <TenderCardSkeleton style={styles.tenderCardWrapper} />
              <TenderCardSkeleton style={styles.tenderCardWrapper} />
            </>
          ) : recommendedQuery.isError ? (
            <SectionMessage
              message="Couldn't load recommendations."
              onRetry={() => recommendedQuery.refetch()}
            />
          ) : recommendedQuery.data?.tenders.length ? (
            recommendedQuery.data.tenders.map((tender) => (
              <View key={tender.id} style={styles.tenderCardWrapper}>
                <TenderCard
                  tender={toTenderCardData(tender)}
                  onPress={() => handleTenderPress(tender.id)}
                />
              </View>
            ))
          ) : (
            <SectionMessage message="No open tenders to recommend right now." />
          )}
        </View>

        {/* =========================================================== */}
        {/*  4. EXPIRING SOON                                           */}
        {/* =========================================================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Expiring soon {'\u23F0'}
            </Text>
            <TouchableOpacity
              onPress={handleSeeAllExpiring}
              activeOpacity={0.7}
              testID="see-all-expiring"
            >
              <Text style={styles.seeAllText}>See all &rarr;</Text>
            </TouchableOpacity>
          </View>
          {expiringQuery.isLoading ? (
            <View style={styles.expiringSkeletonRow}>
              <SkeletonLoader width={statCardWidth * 1.6} height={150} borderRadius={16} />
              <SkeletonLoader width={statCardWidth * 1.6} height={150} borderRadius={16} />
            </View>
          ) : expiringQuery.isError ? (
            <SectionMessage
              message="Couldn't load expiring tenders."
              onRetry={() => expiringQuery.refetch()}
            />
          ) : expiringQuery.data?.tenders.length ? (
            <FlatList
              data={expiringQuery.data.tenders}
              renderItem={renderExpiringTender}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.expiringContainer}
              ItemSeparatorComponent={CardSeparator}
            />
          ) : (
            <SectionMessage message="No open tenders close in the next 7 days." />
          )}
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
            <TouchableOpacity onPress={handleViewAllResults} activeOpacity={0.7}>
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
// Inline empty / error message for a home section
// ---------------------------------------------------------------------------

function SectionMessage({
  message,
  onRetry,
  style,
}: {
  message: string;
  onRetry?: () => void;
  style?: object;
}) {
  return (
    <View style={[styles.sectionMessage, style]}>
      <Text style={styles.sectionMessageText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7} hitSlop={8}>
          <Text style={styles.sectionMessageRetry}>Retry</Text>
        </TouchableOpacity>
      )}
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
    // Width comes from getStatCardWidth(); a min height (not a fixed one) lets the
    // icon, number and label fit at any font scale instead of clipping the label.
    minHeight: 96,
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
  expiringSkeletonRow: {
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
  },
  statsError: {
    marginTop: 8,
    marginHorizontal: 20,
  },
  statValueSkeleton: {
    marginVertical: 4,
  },
  sectionMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionMessageText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  sectionMessageRetry: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
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
