/**
 * TenderBazaar -- AlertDetailScreen (Premium)
 *
 * Detailed view of a single alert configuration with:
 *   - Alert info card (name, status, dates)
 *   - Configuration section (keywords, categories, states, channels)
 *   - Match stats with animated count-up and mini bar chart
 *   - Recent matches list
 *   - Action buttons (pause, edit, delete, duplicate)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  FadeIn,
  Easing,
  useDerivedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { RootStackParamList } from '../../types/navigation';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { formatCurrency } from '../../utils/format';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#E8ECF1';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';
const SUCCESS = '#22C55E';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type AlertRoute = RouteProp<RootStackParamList, 'AlertDetail'>;

// ---------------------------------------------------------------------------
// Mock alert data
// ---------------------------------------------------------------------------

interface AlertData {
  id: string;
  name: string;
  status: 'active' | 'paused';
  createdDate: string;
  lastTriggered: string;
  newSinceLastCheck: number;
  keywords: string[];
  categories: string[];
  states: string[];
  valueRange: string;
  frequency: string;
  channels: { push: boolean; email: boolean; whatsapp: boolean; sms: boolean };
  stats: {
    totalMatches: number;
    thisWeek: number;
    avgValue: number;
    topOrg: string;
    topOrgCount: number;
    last7Days: number[];
  };
}

const MOCK_ALERT: AlertData = {
  id: 'al-1',
  name: 'Highway Tenders',
  status: 'active',
  createdDate: '05 Apr 2026',
  lastTriggered: '11 Apr 2026, 8:30 AM',
  newSinceLastCheck: 5,
  keywords: ['highway', 'road', 'bridge', 'expressway', 'nhai'],
  categories: ['Works'],
  states: ['Gujarat', 'Maharashtra', 'Rajasthan', 'Delhi', 'Karnataka'],
  valueRange: '\u20B91Cr - \u20B9100Cr',
  frequency: 'Daily',
  channels: { push: true, email: true, whatsapp: false, sms: false },
  stats: {
    totalMatches: 45,
    thisWeek: 12,
    avgValue: 850000000,
    topOrg: 'NHAI',
    topOrgCount: 8,
    last7Days: [3, 5, 2, 7, 4, 6, 3],
  },
};

interface RecentMatch {
  id: string;
  title: string;
  organization: string;
  estimatedValue: number;
  deadline: string;
}

const RECENT_MATCHES: RecentMatch[] = [
  {
    id: 'rm-1',
    title: 'Construction of 6-Lane Expressway Delhi-Jaipur Section IV',
    organization: 'NHAI',
    estimatedValue: 780000000,
    deadline: '22 Apr',
  },
  {
    id: 'rm-2',
    title: 'Bridge Construction Over River Chambal NH-44',
    organization: 'NHAI',
    estimatedValue: 215000000,
    deadline: '30 Apr',
  },
  {
    id: 'rm-3',
    title: 'Road Widening & Strengthening SH-17 Surat-Navsari',
    organization: 'Gujarat R&B Dept',
    estimatedValue: 125000000,
    deadline: '05 May',
  },
  {
    id: 'rm-4',
    title: 'Flyover Construction at Dwarka Expressway Junction',
    organization: 'NHAI',
    estimatedValue: 340000000,
    deadline: '08 May',
  },
  {
    id: 'rm-5',
    title: 'Highway Median Barrier Installation NH-8 Gujarat',
    organization: 'NHAI',
    estimatedValue: 45000000,
    deadline: '12 May',
  },
];

// ---------------------------------------------------------------------------
// AnimatedNumber (count-up)
// ---------------------------------------------------------------------------

interface AnimatedNumberProps {
  value: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  style?: object;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  delay = 0,
  suffix = '',
  prefix = '',
  style,
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(value, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, delay, animatedValue]);

  // Since AnimatedText is complex, we use a simple approach with state
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame: number;
    const startTime = Date.now();
    const duration = 1200;
    const startDelay = delay;

    const animate = () => {
      const elapsed = Date.now() - startTime - startDelay;
      if (elapsed < 0) {
        frame = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue}
      {suffix}
    </Text>
  );
};

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

interface BarChartProps {
  data: number[];
  days: string[];
}

const BarChart: React.FC<BarChartProps> = React.memo(({ data, days }) => {
  const maxVal = Math.max(...data, 1);

  return (
    <View style={styles.barChartContainer}>
      <View style={styles.barChartBars}>
        {data.map((val, i) => {
          const heightPercent = (val / maxVal) * 100;
          return (
            <View key={i} style={styles.barColumn}>
              <Animated.View
                entering={FadeIn.delay(i * 100 + 600).duration(300)}
                style={styles.barWrapper}>
                <AnimatedBar heightPercent={heightPercent} delay={i * 100 + 600} />
                <Text style={styles.barValue}>{val}</Text>
              </Animated.View>
              <Text style={styles.barLabel}>{days[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const AnimatedBar: React.FC<{ heightPercent: number; delay: number }> = ({
  heightPercent,
  delay,
}) => {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withDelay(
      delay,
      withTiming(heightPercent, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [heightPercent, delay, height]);

  const barStyle = useAnimatedStyle(() => ({
    height: `${height.value}%`,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, barStyle]} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// ConfigRow
// ---------------------------------------------------------------------------

interface ConfigRowProps {
  icon: string;
  label: string;
  children: React.ReactNode;
}

const ConfigRow: React.FC<ConfigRowProps> = React.memo(({ icon, label, children }) => (
  <View style={styles.configRow}>
    <View style={styles.configIconCircle}>
      <Icon name={icon} size={16} color={PRIMARY} />
    </View>
    <View style={styles.configContent}>
      <Text style={styles.configLabel}>{label}</Text>
      {children}
    </View>
    <FeatherIcon name="chevron-right" size={16} color={BORDER} />
  </View>
));

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AlertDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<AlertRoute>();
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState<AlertData>(MOCK_ALERT);
  const [showAllStates, setShowAllStates] = useState(false);

  const isActive = alert.status === 'active';
  const displayStates = showAllStates ? alert.states : alert.states.slice(0, 3);
  const hasMoreStates = alert.states.length > 3;

  const days = useMemo(() => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNames;
  }, []);

  // --- Handlers ---
  const toggleStatus = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    setAlert((prev) => ({
      ...prev,
      status: prev.status === 'active' ? 'paused' : 'active',
    }));
  }, []);

  const handleEdit = useCallback(() => {
    navigation.navigate('CreateAlert');
  }, [navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            ReactNativeHapticFeedback.trigger('notificationWarning', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
            navigation.goBack();
          },
        },
      ],
    );
  }, [navigation]);

  const handleDuplicate = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    navigation.navigate('CreateAlert');
  }, [navigation]);

  const handleViewAllMatches = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ---- Header ---- */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBackButton}>
          <FeatherIcon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerActionBtn}>
            <FeatherIcon name="edit-2" size={18} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerActionBtn}>
            <FeatherIcon name="trash-2" size={18} color={DANGER} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}>
        {/* ---- Alert Info Card ---- */}
        <Animated.View
          entering={FadeIn.delay(100).duration(400)}
          style={[styles.infoCard, shadows.md]}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.alertName}>{alert.name}</Text>
            <View
              style={[
                styles.statusPill,
                isActive ? styles.statusActive : styles.statusPaused,
              ]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? SUCCESS : WARNING },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? SUCCESS : WARNING },
                ]}>
                {isActive ? 'Active' : 'Paused'}
              </Text>
            </View>
          </View>

          <View style={styles.infoMeta}>
            <View style={styles.infoMetaItem}>
              <Icon name="calendar-outline" size={14} color={TEXT_MUTED} />
              <Text style={styles.infoMetaText}>Created {alert.createdDate}</Text>
            </View>
            <View style={styles.infoMetaItem}>
              <Icon name="clock-outline" size={14} color={TEXT_MUTED} />
              <Text style={styles.infoMetaText}>
                Last triggered {alert.lastTriggered}
              </Text>
            </View>
          </View>

          {alert.newSinceLastCheck > 0 && (
            <View style={styles.newMatchesBanner}>
              <Icon name="lightning-bolt" size={16} color={PRIMARY} />
              <Text style={styles.newMatchesText}>
                {alert.newSinceLastCheck} new matches since last check
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ---- Configuration Section ---- */}
        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <View style={[styles.configCard, shadows.sm]}>
            {/* Keywords */}
            <ConfigRow icon="key-variant" label="Keywords">
              <View style={styles.keywordsRow}>
                {alert.keywords.map((kw) => (
                  <View key={kw} style={styles.keywordPill}>
                    <Text style={styles.keywordPillText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </ConfigRow>

            <View style={styles.configDivider} />

            {/* Categories */}
            <ConfigRow icon="shape-outline" label="Categories">
              <View style={styles.keywordsRow}>
                {alert.categories.map((cat) => (
                  <View key={cat} style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{cat}</Text>
                  </View>
                ))}
              </View>
            </ConfigRow>

            <View style={styles.configDivider} />

            {/* States */}
            <ConfigRow icon="map-marker-outline" label="States">
              <View>
                <Text style={styles.configValue}>
                  {displayStates.join(', ')}
                  {hasMoreStates && !showAllStates && (
                    <Text
                      style={styles.showMoreText}
                      onPress={() => setShowAllStates(true)}>
                      {' '}
                      +{alert.states.length - 3} more
                    </Text>
                  )}
                </Text>
              </View>
            </ConfigRow>

            <View style={styles.configDivider} />

            {/* Value Range */}
            <ConfigRow icon="currency-inr" label="Value Range">
              <Text style={styles.configValue}>{alert.valueRange}</Text>
            </ConfigRow>

            <View style={styles.configDivider} />

            {/* Frequency */}
            <ConfigRow icon="clock-outline" label="Frequency">
              <View style={styles.frequencyBadge}>
                <Text style={styles.frequencyBadgeText}>{alert.frequency}</Text>
              </View>
            </ConfigRow>

            <View style={styles.configDivider} />

            {/* Channels */}
            <ConfigRow icon="bell-outline" label="Channels">
              <View style={styles.channelIconsRow}>
                {alert.channels.push && (
                  <View style={[styles.channelIcon, { backgroundColor: PRIMARY + '14' }]}>
                    <Icon name="bell" size={14} color={PRIMARY} />
                  </View>
                )}
                {alert.channels.email && (
                  <View style={[styles.channelIcon, { backgroundColor: '#2563EB14' }]}>
                    <Icon name="email" size={14} color="#2563EB" />
                  </View>
                )}
                {alert.channels.whatsapp && (
                  <View style={[styles.channelIcon, { backgroundColor: '#25D36614' }]}>
                    <Icon name="whatsapp" size={14} color="#25D366" />
                  </View>
                )}
                {alert.channels.sms && (
                  <View style={[styles.channelIcon, { backgroundColor: '#F59E0B14' }]}>
                    <Icon name="message-text" size={14} color="#F59E0B" />
                  </View>
                )}
              </View>
            </ConfigRow>
          </View>
        </Animated.View>

        {/* ---- Match Stats ---- */}
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <Text style={styles.sectionTitle}>Match Statistics</Text>

          {/* Stat cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, shadows.sm]}>
              <AnimatedNumber
                value={alert.stats.totalMatches}
                delay={400}
                style={styles.statNumber}
              />
              <Text style={styles.statLabel}>Total Matches</Text>
            </View>
            <View style={[styles.statCard, shadows.sm]}>
              <AnimatedNumber
                value={alert.stats.thisWeek}
                delay={500}
                style={[styles.statNumber, { color: ACCENT }]}
              />
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={[styles.statCard, shadows.sm]}>
              <Text style={[styles.statNumber, { color: PRIMARY }]}>
                {formatCurrency(alert.stats.avgValue)}
              </Text>
              <Text style={styles.statLabel}>Avg. Value</Text>
            </View>
            <View style={[styles.statCard, shadows.sm]}>
              <AnimatedNumber
                value={alert.stats.topOrgCount}
                delay={700}
                style={[styles.statNumber, { color: SECONDARY }]}
              />
              <Text style={styles.statLabel}>{alert.stats.topOrg}</Text>
              <Text style={styles.statSubLabel}>Top Org</Text>
            </View>
          </View>

          {/* Bar chart */}
          <View style={[styles.chartCard, shadows.sm]}>
            <Text style={styles.chartTitle}>Matches Last 7 Days</Text>
            <BarChart data={alert.stats.last7Days} days={days} />
          </View>
        </Animated.View>

        {/* ---- Recent Matches ---- */}
        <Animated.View entering={FadeIn.delay(400).duration(400)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            <TouchableOpacity onPress={handleViewAllMatches} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {RECENT_MATCHES.map((match, index) => (
            <Animated.View
              key={match.id}
              entering={FadeIn.delay(500 + index * 60).duration(350)}>
              <TouchableOpacity
                style={[styles.recentMatchCard, shadows.sm]}
                onPress={() =>
                  navigation.navigate('TenderDetail', { id: match.id })
                }
                activeOpacity={0.85}>
                <View style={styles.recentMatchBody}>
                  <Text style={styles.recentMatchTitle} numberOfLines={2}>
                    {match.title}
                  </Text>
                  <View style={styles.recentMatchMeta}>
                    <FeatherIcon name="briefcase" size={12} color={TEXT_MUTED} />
                    <Text style={styles.recentMatchOrg}>{match.organization}</Text>
                    <Text style={styles.recentMatchDot}>{'\u00B7'}</Text>
                    <Text style={styles.recentMatchValue}>
                      {formatCurrency(match.estimatedValue)}
                    </Text>
                    <Text style={styles.recentMatchDot}>{'\u00B7'}</Text>
                    <Text style={styles.recentMatchDeadline}>
                      Due {match.deadline}
                    </Text>
                  </View>
                </View>
                <FeatherIcon name="chevron-right" size={18} color={BORDER} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>

        {/* ---- Actions ---- */}
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsCard}>
            {/* Pause/Resume */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={toggleStatus}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: isActive ? WARNING + '14' : SUCCESS + '14' },
                ]}>
                <Icon
                  name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={20}
                  color={isActive ? WARNING : SUCCESS}
                />
              </View>
              <Text style={styles.actionText}>
                {isActive ? 'Pause Alert' : 'Resume Alert'}
              </Text>
              <FeatherIcon name="chevron-right" size={16} color={BORDER} />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            {/* Edit */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleEdit}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: PRIMARY + '14' },
                ]}>
                <FeatherIcon name="edit-2" size={18} color={PRIMARY} />
              </View>
              <Text style={styles.actionText}>Edit Alert</Text>
              <FeatherIcon name="chevron-right" size={16} color={BORDER} />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            {/* Duplicate */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDuplicate}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: ACCENT + '14' },
                ]}>
                <Icon name="content-copy" size={18} color={ACCENT} />
              </View>
              <Text style={styles.actionText}>Duplicate Alert</Text>
              <FeatherIcon name="chevron-right" size={16} color={BORDER} />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            {/* Delete */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDelete}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: DANGER + '14' },
                ]}>
                <FeatherIcon name="trash-2" size={18} color={DANGER} />
              </View>
              <Text style={[styles.actionText, { color: DANGER }]}>
                Delete Alert
              </Text>
              <FeatherIcon name="chevron-right" size={16} color={BORDER} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Section title
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 24,
    marginBottom: 12,
  },

  // Info card
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 20,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertName: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusActive: {
    backgroundColor: SUCCESS + '14',
  },
  statusPaused: {
    backgroundColor: WARNING + '14',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
  },
  infoMeta: {
    gap: 8,
    marginBottom: 14,
  },
  infoMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoMetaText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    fontWeight: '400',
    color: TEXT_SECONDARY,
  },
  newMatchesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY + '0D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  newMatchesText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Config card
  configCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  configIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PRIMARY + '0D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  configContent: {
    flex: 1,
  },
  configLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  configValue: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  configDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 60,
  },
  showMoreText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Keywords & category pills
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  keywordPill: {
    backgroundColor: PRIMARY + '14',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  keywordPillText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  categoryPill: {
    backgroundColor: SECONDARY + '14',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryPillText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
  },

  // Frequency badge
  frequencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY + '14',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  frequencyBadgeText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Channel icons
  channelIconsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  channelIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  statSubLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    fontWeight: '400',
    color: TEXT_MUTED,
    marginTop: 2,
  },

  // Chart
  chartCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  chartTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  barChartContainer: {
    height: 140,
  },
  barChartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    alignItems: 'center',
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 24,
    height: '100%',
    borderRadius: 6,
    backgroundColor: BORDER + '40',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: PRIMARY,
    minHeight: 4,
  },
  barValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    marginTop: 4,
    position: 'absolute',
    top: -2,
  },
  barLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginTop: 6,
  },

  // Recent matches
  recentMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  recentMatchBody: {
    flex: 1,
    marginRight: 8,
  },
  recentMatchTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 20,
    marginBottom: 6,
  },
  recentMatchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  recentMatchOrg: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_SECONDARY,
  },
  recentMatchDot: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: TEXT_MUTED,
  },
  recentMatchValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
  },
  recentMatchDeadline: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Actions
  actionsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  actionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 64,
  },
});
