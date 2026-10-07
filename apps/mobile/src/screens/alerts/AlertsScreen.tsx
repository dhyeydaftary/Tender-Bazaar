/**
 * TenderBazaar -- AlertsScreen (Premium)
 *
 * Smart Alerts hub with two segment tabs: "My Alerts" and "Recent Matches".
 * Animated tab switch, staggered card entrance, toggle with haptic,
 * swipe-to-delete, FAB with scale bounce, plan limit progress bar.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SectionList,
  Switch,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeIn,
  FadeOut,
  SlideOutRight,
  Layout,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { RootStackParamList } from '../../types/navigation';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { formatCurrency } from '../../utils/format';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { UpgradeBanner } from '../../components/subscription';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'my_alerts' | 'recent_matches';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertConfig {
  id: string;
  name: string;
  keywords: string[];
  matchCount: number;
  enabled: boolean;
  frequency: 'Instant' | 'Daily' | 'Weekly';
  categories: string[];
  states: string[];
}

interface MatchedTender {
  id: string;
  title: string;
  organization: string;
  estimatedValue: number;
  submissionDeadline: string;
  alertName: string;
  alertColor: string;
}

interface MatchSection {
  title: string;
  data: MatchedTender[];
}

// ---------------------------------------------------------------------------
// Mock data — 5 alerts
// ---------------------------------------------------------------------------

const INITIAL_ALERTS: AlertConfig[] = [
  {
    id: 'al-1',
    name: 'Highway Tenders',
    keywords: ['highway', 'road', 'bridge'],
    matchCount: 45,
    enabled: true,
    frequency: 'Daily',
    categories: ['Works'],
    states: ['Gujarat', 'Maharashtra', 'Rajasthan'],
  },
  {
    id: 'al-2',
    name: 'IT Services Gujarat',
    keywords: ['software', 'IT'],
    matchCount: 12,
    enabled: true,
    frequency: 'Instant',
    categories: ['Services', 'Goods'],
    states: ['Gujarat'],
  },
  {
    id: 'al-3',
    name: 'Medical Equipment',
    keywords: ['medical', 'hospital'],
    matchCount: 8,
    enabled: false,
    frequency: 'Weekly',
    categories: ['Goods'],
    states: ['Delhi', 'Maharashtra'],
  },
  {
    id: 'al-4',
    name: 'Construction Delhi NCR',
    keywords: ['construction', 'building'],
    matchCount: 23,
    enabled: true,
    frequency: 'Daily',
    categories: ['Works'],
    states: ['Delhi', 'Haryana', 'Uttar Pradesh'],
  },
  {
    id: 'al-5',
    name: 'Solar & Renewable',
    keywords: ['solar', 'renewable', 'energy'],
    matchCount: 15,
    enabled: true,
    frequency: 'Daily',
    categories: ['Works', 'Goods'],
    states: ['Rajasthan', 'Gujarat', 'Karnataka'],
  },
];

// ---------------------------------------------------------------------------
// Mock data — 12 matched tenders in sections
// ---------------------------------------------------------------------------

const MATCHED_SECTIONS: MatchSection[] = [
  {
    title: 'Today',
    data: [
      {
        id: 'mt-1',
        title: 'Construction of 6-Lane Expressway Delhi-Jaipur Section IV',
        organization: 'NHAI',
        estimatedValue: 780000000,
        submissionDeadline: '2026-04-22T17:00:00Z',
        alertName: 'Highway Tenders',
        alertColor: '#E8593C',
      },
      {
        id: 'mt-2',
        title: 'IT Infrastructure Upgrade for Gujarat State Data Centre',
        organization: 'Gujarat IT Dept',
        estimatedValue: 45000000,
        submissionDeadline: '2026-04-25T15:00:00Z',
        alertName: 'IT Services Gujarat',
        alertColor: '#2563EB',
      },
      {
        id: 'mt-3',
        title: 'Solar Power Plant 50MW at Bhadla Solar Park Phase V',
        organization: 'SECI',
        estimatedValue: 320000000,
        submissionDeadline: '2026-04-28T17:00:00Z',
        alertName: 'Solar & Renewable',
        alertColor: '#F59E0B',
      },
    ],
  },
  {
    title: 'Yesterday',
    data: [
      {
        id: 'mt-4',
        title: 'Bridge Construction Over River Chambal NH-44',
        organization: 'NHAI',
        estimatedValue: 215000000,
        submissionDeadline: '2026-04-30T17:00:00Z',
        alertName: 'Highway Tenders',
        alertColor: '#E8593C',
      },
      {
        id: 'mt-5',
        title: 'Supply of Hospital Beds & ICU Equipment for AIIMS Rajkot',
        organization: 'Ministry of Health',
        estimatedValue: 58000000,
        submissionDeadline: '2026-04-26T15:00:00Z',
        alertName: 'Medical Equipment',
        alertColor: '#0D9488',
      },
      {
        id: 'mt-6',
        title: 'Construction of Multi-Level Parking at Connaught Place',
        organization: 'NDMC',
        estimatedValue: 180000000,
        submissionDeadline: '2026-05-01T17:00:00Z',
        alertName: 'Construction Delhi NCR',
        alertColor: '#7C3AED',
      },
      {
        id: 'mt-7',
        title: 'ERP Software Implementation for Gujarat Water Authority',
        organization: 'GWSSB',
        estimatedValue: 32000000,
        submissionDeadline: '2026-04-29T15:00:00Z',
        alertName: 'IT Services Gujarat',
        alertColor: '#2563EB',
      },
    ],
  },
  {
    title: 'This Week',
    data: [
      {
        id: 'mt-8',
        title: 'Road Widening & Strengthening SH-17 Surat-Navsari',
        organization: 'Gujarat R&B Dept',
        estimatedValue: 125000000,
        submissionDeadline: '2026-05-05T17:00:00Z',
        alertName: 'Highway Tenders',
        alertColor: '#E8593C',
      },
      {
        id: 'mt-9',
        title: 'Rooftop Solar Installation for 50 Govt Schools Karnataka',
        organization: 'KREDL',
        estimatedValue: 28000000,
        submissionDeadline: '2026-05-03T15:00:00Z',
        alertName: 'Solar & Renewable',
        alertColor: '#F59E0B',
      },
      {
        id: 'mt-10',
        title: 'Medical Imaging Equipment for District Hospitals Rajasthan',
        organization: 'Rajasthan Medical Services',
        estimatedValue: 95000000,
        submissionDeadline: '2026-05-02T15:00:00Z',
        alertName: 'Medical Equipment',
        alertColor: '#0D9488',
      },
      {
        id: 'mt-11',
        title: 'Flyover Construction at Dwarka Expressway Junction',
        organization: 'NHAI',
        estimatedValue: 340000000,
        submissionDeadline: '2026-05-08T17:00:00Z',
        alertName: 'Construction Delhi NCR',
        alertColor: '#7C3AED',
      },
      {
        id: 'mt-12',
        title: 'Cybersecurity Solutions for Gujarat Police Network',
        organization: 'Gujarat Police HQ',
        estimatedValue: 18000000,
        submissionDeadline: '2026-05-06T15:00:00Z',
        alertName: 'IT Services Gujarat',
        alertColor: '#2563EB',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Animated Components
// ---------------------------------------------------------------------------

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ---------------------------------------------------------------------------
// AlertCard
// ---------------------------------------------------------------------------

interface AlertCardProps {
  alert: AlertConfig;
  index: number;
  onPress: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

const AlertCard: React.FC<AlertCardProps> = React.memo(
  ({ alert, index, onPress, onToggle, onDelete }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }, [scale]);

    const frequencyColor = useMemo(() => {
      switch (alert.frequency) {
        case 'Instant':
          return ACCENT;
        case 'Daily':
          return PRIMARY;
        case 'Weekly':
          return '#2563EB';
        default:
          return TEXT_SECONDARY;
      }
    }, [alert.frequency]);

    return (
      <Animated.View
        entering={FadeIn.delay(index * 80).duration(400)}
        exiting={SlideOutRight.duration(300)}
        layout={Layout.springify().damping(18).stiffness(200)}>
        <AnimatedTouchable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
          style={[styles.alertCard, shadows.sm, animatedStyle]}>
          {/* Top: bell icon + title + toggle */}
          <View style={styles.alertCardHeader}>
            <View
              style={[
                styles.alertBellCircle,
                { backgroundColor: alert.enabled ? PRIMARY + '14' : BORDER },
              ]}>
              <Icon
                name="bell"
                size={18}
                color={alert.enabled ? PRIMARY : TEXT_MUTED}
              />
            </View>
            <View style={styles.alertCardInfo}>
              <Text style={styles.alertCardName} numberOfLines={1}>
                {alert.name}
              </Text>
              {/* Keywords as pills */}
              <View style={styles.alertKeywordsRow}>
                {alert.keywords.map((kw) => (
                  <View key={kw} style={styles.alertKeywordPill}>
                    <Text style={styles.alertKeywordText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Switch
              value={alert.enabled}
              onValueChange={() => {
                ReactNativeHapticFeedback.trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
                onToggle();
              }}
              trackColor={{ false: BORDER, true: PRIMARY + '40' }}
              thumbColor={alert.enabled ? PRIMARY : '#f4f3f4'}
            />
          </View>

          {/* Bottom: match count + frequency */}
          <View style={styles.alertCardFooter}>
            <View style={styles.alertMetaItem}>
              <Icon name="lightning-bolt" size={14} color={TEXT_SECONDARY} />
              <Text style={styles.alertMetaText}>{alert.matchCount} matches</Text>
            </View>
            <View
              style={[
                styles.frequencyBadge,
                { backgroundColor: frequencyColor + '14' },
              ]}>
              <Text style={[styles.frequencyBadgeText, { color: frequencyColor }]}>
                {alert.frequency}
              </Text>
            </View>
            {!alert.enabled && (
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedBadgeText}>Paused</Text>
              </View>
            )}
          </View>
        </AnimatedTouchable>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// MatchCard (mini tender card)
// ---------------------------------------------------------------------------

interface MatchCardProps {
  match: MatchedTender;
  index: number;
  onPress: () => void;
}

const MatchCard: React.FC<MatchCardProps> = React.memo(
  ({ match, index, onPress }) => {
    const deadlineDate = useMemo(() => {
      const d = new Date(match.submissionDeadline);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    }, [match.submissionDeadline]);

    const formattedValue = useMemo(
      () => formatCurrency(match.estimatedValue),
      [match.estimatedValue],
    );

    return (
      <Animated.View entering={FadeIn.delay(index * 50).duration(350)}>
        <TouchableOpacity
          style={[styles.matchCard, shadows.sm]}
          onPress={onPress}
          activeOpacity={0.85}>
          <View style={styles.matchCardBody}>
            <Text style={styles.matchTitle} numberOfLines={2}>
              {match.title}
            </Text>
            <View style={styles.matchMetaRow}>
              <FeatherIcon name="briefcase" size={12} color={TEXT_MUTED} />
              <Text style={styles.matchOrg} numberOfLines={1}>
                {match.organization}
              </Text>
            </View>
            <View style={styles.matchBottomRow}>
              <Text style={styles.matchValue}>{formattedValue}</Text>
              <Text style={styles.matchDot}>{'\u00B7'}</Text>
              <Text style={styles.matchDeadline}>Due {deadlineDate}</Text>
            </View>
            {/* Alert name pill */}
            <View style={[styles.matchAlertPill, { backgroundColor: match.alertColor + '14' }]}>
              <Icon name="bell-outline" size={10} color={match.alertColor} />
              <Text style={[styles.matchAlertText, { color: match.alertColor }]}>
                {match.alertName}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color={BORDER} />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// Empty States
// ---------------------------------------------------------------------------

const AlertsEmptyState: React.FC<{ onCreateAlert: () => void }> = React.memo(
  ({ onCreateAlert }) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Icon name="bell-plus-outline" size={52} color={TEXT_MUTED} />
      </View>
      <Text style={styles.emptyTitle}>Create your first alert</Text>
      <Text style={styles.emptySubtitle}>
        Set up keyword-based alerts and get notified when matching tenders are published
      </Text>
      <TouchableOpacity
        style={styles.emptyCTA}
        onPress={onCreateAlert}
        activeOpacity={0.85}>
        <Icon name="plus" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.emptyCTAText}>Create Alert</Text>
      </TouchableOpacity>
    </View>
  ),
);

const MatchesEmptyState: React.FC = React.memo(() => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconCircle}>
      <Icon name="lightning-bolt-outline" size={52} color={TEXT_MUTED} />
    </View>
    <Text style={styles.emptyTitle}>No matches yet</Text>
    <Text style={styles.emptySubtitle}>
      Alerts will start matching once created. New tenders matching your criteria will appear here.
    </Text>
  </View>
));

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AlertsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('my_alerts');
  const [alerts, setAlerts] = useState<AlertConfig[]>(INITIAL_ALERTS);

  // Tab indicator animation
  const tabIndicatorX = useSharedValue(0);
  const tabWidth = (SCREEN_WIDTH - 40) / 2;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
    width: tabWidth,
  }));

  // Content slide animation
  const contentTranslateX = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTranslateX.value }],
  }));

  // FAB scale animation
  const fabScale = useSharedValue(0);
  useEffect(() => {
    fabScale.value = withDelay(400, withSpring(1, { damping: 10, stiffness: 200 }));
  }, [fabScale]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  // --- Tab switch ---
  const switchTab = useCallback(
    (tab: TabKey) => {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setActiveTab(tab);
      const targetX = tab === 'my_alerts' ? 0 : tabWidth;
      tabIndicatorX.value = withSpring(targetX, { damping: 20, stiffness: 300 });
    },
    [tabIndicatorX, tabWidth],
  );

  // --- Alert toggle ---
  const toggleAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  }, []);

  // --- Alert delete ---
  const deleteAlert = useCallback((id: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert? This cannot be undone.',
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
            setAlerts((prev) => prev.filter((a) => a.id !== id));
          },
        },
      ],
    );
  }, []);

  // --- Plan limit (from subscription store) ---
  const checkLimit = useSubscriptionStore((s) => s.checkLimit);
  const alertLimit = checkLimit('maxAlerts');
  const alertsUsed = alerts.length;
  const alertsLimit = alertLimit.isUnlimited ? -1 : alertLimit.limit;
  const limitPercent = alertLimit.isUnlimited
    ? 0
    : Math.min((alertsUsed / alertsLimit) * 100, 100);

  // --- Renders ---
  const renderAlertItem = useCallback(
    ({ item, index }: { item: AlertConfig; index: number }) => (
      <AlertCard
        alert={item}
        index={index}
        onPress={() => navigation.navigate('AlertDetail', { id: item.id })}
        onToggle={() => toggleAlert(item.id)}
        onDelete={() => deleteAlert(item.id)}
      />
    ),
    [navigation, toggleAlert, deleteAlert],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MatchSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const renderMatchItem = useCallback(
    ({ item, index }: { item: MatchedTender; index: number }) => (
      <MatchCard
        match={item}
        index={index}
        onPress={() => navigation.navigate('TenderDetail', { id: item.id })}
      />
    ),
    [navigation],
  );

  const alertKeyExtractor = useCallback((item: AlertConfig) => item.id, []);
  const matchKeyExtractor = useCallback((item: MatchedTender) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Smart Alerts</Text>
      </View>

      {/* ---- Segment tabs ---- */}
      <View style={styles.tabContainer}>
        <View style={styles.tabTrack}>
          <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('my_alerts')}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'my_alerts' && styles.tabTextActive,
              ]}>
              My Alerts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('recent_matches')}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'recent_matches' && styles.tabTextActive,
              ]}>
              Recent Matches
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Content ---- */}
      {activeTab === 'my_alerts' ? (
        <FlatList
          data={alerts}
          renderItem={renderAlertItem}
          keyExtractor={alertKeyExtractor}
          contentContainerStyle={[
            styles.listContent,
            alerts.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            alerts.length > 0 ? (
              <View style={styles.planLimitContainer}>
                {!alertLimit.hasCapacity && !alertLimit.isUnlimited && (
                  <View style={{ marginBottom: 12 }}>
                    <UpgradeBanner
                      feature="Tender Alerts"
                      requiredPlan="Starter"
                      variant="inline"
                    />
                  </View>
                )}
                <View style={styles.planLimitHeader}>
                  <Text style={styles.planLimitText}>
                    {alertsUsed}{alertLimit.isUnlimited ? '' : ` of ${alertsLimit}`} alerts used
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Plans')}
                    activeOpacity={0.7}>
                    <Text style={styles.planLimitLink}>Upgrade</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.planLimitBarTrack}>
                  <Animated.View
                    style={[
                      styles.planLimitBarFill,
                      { width: `${limitPercent}%` },
                      limitPercent >= 80 && styles.planLimitBarWarn,
                    ]}
                  />
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <AlertsEmptyState
              onCreateAlert={() => navigation.navigate('CreateAlert')}
            />
          }
        />
      ) : (
        <SectionList
          sections={MATCHED_SECTIONS}
          renderItem={renderMatchItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={matchKeyExtractor}
          contentContainerStyle={[
            styles.listContent,
            MATCHED_SECTIONS.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={<MatchesEmptyState />}
        />
      )}

      {/* ---- FAB ---- */}
      <Animated.View
        style={[
          styles.fab,
          shadows.xl,
          { bottom: insets.bottom + 108 },
          fabStyle,
        ]}>
        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('impactMedium', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
            navigation.navigate('CreateAlert');
          }}
          activeOpacity={0.85}>
          <Icon name="plus" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Tabs
  tabContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: BORDER,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Plan limit
  planLimitContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  planLimitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planLimitText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  planLimitLink: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  planLimitBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
    overflow: 'hidden',
  },
  planLimitBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  planLimitBarWarn: {
    backgroundColor: WARNING,
  },

  // Alert card
  alertCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertBellCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  alertCardName: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  alertKeywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  alertKeywordPill: {
    backgroundColor: PRIMARY + '10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertKeywordText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    fontWeight: '500',
    color: PRIMARY,
  },
  alertCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
  alertMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertMetaText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  frequencyBadgeText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  pausedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: TEXT_MUTED + '1A',
  },
  pausedBadgeText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
  },

  // Section header
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Match card
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  matchCardBody: {
    flex: 1,
    marginRight: 8,
  },
  matchTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 20,
    marginBottom: 4,
  },
  matchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  matchOrg: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    flex: 1,
  },
  matchBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  matchValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  matchDot: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: TEXT_MUTED,
    marginHorizontal: 6,
  },
  matchDeadline: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY,
  },
  matchAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  matchAlertText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 10,
    fontWeight: '600',
  },

  // Empty states
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: BORDER + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyCTA: {
    flexDirection: 'row',
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  emptyCTAText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    overflow: 'hidden',
  },
  fabTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
