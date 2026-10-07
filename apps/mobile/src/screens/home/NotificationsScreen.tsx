/**
 * TenderBazaar -- NotificationsScreen (Premium)
 *
 * - Header: "Notifications" title + "Mark all read" text button (saffron)
 * - Grouped by: "Today", "Yesterday", "This Week", "Earlier"
 * - NotificationItem with colored icon circle, title, body, timestamp, unread dot
 * - Swipe-to-delete with red background + trash icon (Gesture Handler)
 * - Empty state with bell icon
 * - Pull to refresh
 * - Bottom padding for tab bar
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  StatusBar,
  Platform,
  RefreshControl,
  type SectionListRenderItemInfo,
  type SectionListData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../../theme/typography';
import EmptyState from '../../components/ui/EmptyState';
import type { RootStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const UNREAD_BG = '#F7F8FA';
const BORDER = '#E8ECF1';
const DELETE_RED = '#EF4444';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  | 'alert'
  | 'result'
  | 'recommendation'
  | 'deadline'
  | 'corrigendum'
  | 'system';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string; // ISO date string
  read: boolean;
  tenderId?: string;
}

interface NotificationSection {
  title: string;
  data: NotificationItem[];
}

// ---------------------------------------------------------------------------
// Icon configuration by type
// ---------------------------------------------------------------------------

const NOTIF_ICON_CONFIG: Record<
  NotificationType,
  { name: string; color: string; bgColor: string }
> = {
  alert: {
    name: 'bell-ring-outline',
    color: '#3B82F6',
    bgColor: '#3B82F61A',
  },
  result: {
    name: 'check-circle-outline',
    color: '#22C55E',
    bgColor: '#22C55E1A',
  },
  recommendation: {
    name: 'star-outline',
    color: '#FF6B35',
    bgColor: '#FF6B351A',
  },
  deadline: {
    name: 'clock-alert-outline',
    color: '#EF4444',
    bgColor: '#EF44441A',
  },
  corrigendum: {
    name: 'file-edit-outline',
    color: '#F59E0B',
    bgColor: '#F59E0B1A',
  },
  system: {
    name: 'information-outline',
    color: '#6B7280',
    bgColor: '#6B72801A',
  },
};

// ---------------------------------------------------------------------------
// Mock data (10 items across groups)
// ---------------------------------------------------------------------------

const NOW = new Date();
function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'alert',
    title: 'New Tender Match',
    body: 'Highway construction project in Gujarat matches your "Road & Highway" alert.',
    timestamp: hoursAgo(0.5),
    read: false,
    tenderId: '1',
  },
  {
    id: '2',
    type: 'deadline',
    title: 'Deadline Tomorrow',
    body: 'IT Equipment Supply (Maharashtra) bid submission closes tomorrow at 5:00 PM IST.',
    timestamp: hoursAgo(2),
    read: false,
    tenderId: '2',
  },
  {
    id: '3',
    type: 'recommendation',
    title: 'Recommended for You',
    body: 'Smart City surveillance system AMC tender in Rajasthan matches your company profile.',
    timestamp: hoursAgo(6),
    read: false,
    tenderId: '3',
  },
  {
    id: '4',
    type: 'result',
    title: 'Eligibility Check Complete',
    body: 'Your eligibility score for CPWD Road Resurfacing tender: 87%. You are highly eligible.',
    timestamp: daysAgo(1),
    read: true,
    tenderId: '4',
  },
  {
    id: '5',
    type: 'corrigendum',
    title: 'Corrigendum Published',
    body: 'Tender TND-001 has been updated. Deadline extended to 20 Apr 2026. EMD amount revised.',
    timestamp: daysAgo(1),
    read: true,
    tenderId: '1',
  },
  {
    id: '6',
    type: 'alert',
    title: '5 New Tenders in Gujarat',
    body: 'New Works and Goods category tenders published on GeM matching your preferences.',
    timestamp: daysAgo(2),
    read: true,
  },
  {
    id: '7',
    type: 'deadline',
    title: 'Deadline in 3 Days',
    body: 'Solar Panel Installation for Govt. Schools (MP) closes on 13 Apr 2026.',
    timestamp: daysAgo(3),
    read: true,
    tenderId: '5',
  },
  {
    id: '8',
    type: 'result',
    title: 'Tender Awarded',
    body: 'Hospital Equipment Supply (UP) tender has been awarded. Check results.',
    timestamp: daysAgo(5),
    read: true,
    tenderId: '6',
  },
  {
    id: '9',
    type: 'recommendation',
    title: 'Weekly Digest',
    body: '12 new tenders match your profile this week across 4 states. Review now.',
    timestamp: daysAgo(6),
    read: true,
  },
  {
    id: '10',
    type: 'system',
    title: 'Complete Your Profile',
    body: 'Add your company details and certifications to get better AI eligibility checks and recommendations.',
    timestamp: daysAgo(10),
    read: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

function groupNotifications(items: NotificationItem[]): NotificationSection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, NotificationItem[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  };

  items.forEach((item) => {
    const date = new Date(item.timestamp);
    if (date >= todayStart) {
      groups.Today.push(item);
    } else if (date >= yesterdayStart) {
      groups.Yesterday.push(item);
    } else if (date >= weekStart) {
      groups['This Week'].push(item);
    } else {
      groups.Earlier.push(item);
    }
  });

  const sections: NotificationSection[] = [];
  const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  order.forEach((key) => {
    if (groups[key].length > 0) {
      sections.push({ title: key, data: groups[key] });
    }
  });

  return sections;
}

// ---------------------------------------------------------------------------
// SwipeableNotificationRow
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = -80;

const SwipeableNotificationRow: React.FC<{
  item: NotificationItem;
  onPress: () => void;
  onDelete: (id: string) => void;
}> = ({ item, onPress, onDelete }) => {
  const translateX = useSharedValue(0);
  const iconConfig = NOTIF_ICON_CONFIG[item.type] || NOTIF_ICON_CONFIG.system;

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -120);
      }
    })
    .onEnd((event) => {
      if (event.translationX < SWIPE_THRESHOLD) {
        translateX.value = withTiming(-120, { duration: 200 });
        runOnJS(handleDelete)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? 1 : 0,
  }));

  return (
    <View style={swipeStyles.wrapper}>
      {/* Delete background */}
      <Animated.View style={[swipeStyles.deleteBackground, deleteStyle]}>
        <Icon name="trash-can-outline" size={22} color="#FFFFFF" />
        <Text style={swipeStyles.deleteText}>Delete</Text>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={rowStyle}>
          <TouchableOpacity
            style={[
              swipeStyles.row,
              !item.read && swipeStyles.rowUnread,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
          >
            {/* Icon circle */}
            <View
              style={[
                swipeStyles.iconCircle,
                { backgroundColor: iconConfig.bgColor },
              ]}
            >
              <Icon name={iconConfig.name} size={20} color={iconConfig.color} />
            </View>

            {/* Content */}
            <View style={swipeStyles.content}>
              <Text style={swipeStyles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={swipeStyles.body} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={swipeStyles.timestamp}>{timeAgo(item.timestamp)}</Text>
            </View>

            {/* Unread dot */}
            {!item.read && <View style={swipeStyles.unreadDot} />}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const swipeStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  deleteBackground: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: DELETE_RED,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 6,
  },
  deleteText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  rowUnread: {
    backgroundColor: UNREAD_BG,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 3,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    lineHeight: 19,
    marginBottom: 4,
  },
  timestamp: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 6,
  },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  const handleNotificationPress = useCallback(
    (item: NotificationItem) => {
      // Mark as read
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      // Navigate if tender link
      if (item.tenderId) {
        navigation.navigate('TenderDetail', { id: item.tenderId });
      }
    },
    [navigation],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  // ---- Render functions ----

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<NotificationItem>) => (
      <SwipeableNotificationRow
        item={item}
        onPress={() => handleNotificationPress(item)}
        onDelete={handleDelete}
      />
    ),
    [handleNotificationPress, handleDelete],
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<NotificationItem, NotificationSection>;
    }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        icon={
          <View style={styles.emptyIconCircle}>
            <Icon name="bell-off-outline" size={40} color={BORDER} />
          </View>
        }
        title="No notifications yet"
        message="We'll notify you when matching tenders are found"
        style={styles.emptyState}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: NotificationItem) => item.id, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />

      {/* Mark all read bar */}
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllBar}
          onPress={handleMarkAllRead}
          activeOpacity={0.7}
        >
          <Icon name="check-all" size={18} color={PRIMARY} />
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      )}

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      />
    </GestureHandlerRootView>
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
  markAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  markAllText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  listContent: {
    paddingTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyState: {
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BORDER + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
