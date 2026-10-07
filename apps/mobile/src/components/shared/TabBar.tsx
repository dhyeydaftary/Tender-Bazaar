/**
 * TenderBazaar -- Premium Custom Bottom Tab Bar
 *
 * A floating, glassmorphic tab bar that replaces React Navigation's default.
 * Features:
 *  - Floating bar with rounded corners (24), positioned 12px from bottom + 16px from sides
 *  - Semi-transparent white background with subtle shadow (elevation lg)
 *  - Spring-animated icon scale on press (1 -> 1.2 -> 1) via Reanimated
 *  - Animated indicator dot below the active tab icon
 *  - Haptic feedback (impactLight) on every tap
 *  - Unread notification badge on the Alerts tab
 *  - Safe area padding at bottom via useSafeAreaInsets
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  iconOutline: string;
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'HomeTab', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { key: 'SearchTab', label: 'Search', icon: 'magnify', iconOutline: 'magnify' },
  { key: 'SavedTab', label: 'Saved', icon: 'bookmark', iconOutline: 'bookmark-outline' },
  { key: 'AlertsTab', label: 'Alerts', icon: 'bell', iconOutline: 'bell-outline' },
  { key: 'ProfileTab', label: 'Profile', icon: 'account', iconOutline: 'account-outline' },
];

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const ACTIVE_COLOR = '#FF6B35';
const INACTIVE_COLOR = '#8A98B8';
const BADGE_BG = '#EF4444';
const BADGE_TEXT = '#FFFFFF';

// ---------------------------------------------------------------------------
// Haptic options
// ---------------------------------------------------------------------------

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Animated Tab Item
// ---------------------------------------------------------------------------

interface TabItemProps {
  index: number;
  isFocused: boolean;
  label: string;
  iconName: string;
  iconOutline: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string | undefined;
  unreadCount?: number;
}

function TabItem({
  isFocused,
  label,
  iconName,
  iconOutline,
  onPress,
  onLongPress,
  accessibilityLabel,
  unreadCount,
}: TabItemProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Spring bounce: scale up then settle back to 1
    scale.value = withSpring(1.2, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    });

    // Haptic feedback
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

    onPress();
  }, [onPress, scale]);

  const currentIcon = isFocused ? iconName : iconOutline;
  const currentColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
  const showBadge =
    label === 'Alerts' && unreadCount !== undefined && unreadCount > 0;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <Icon name={currentIcon} size={24} color={currentColor} />

        {/* Unread badge */}
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {(unreadCount ?? 0) > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Active indicator dot */}
      {isFocused && <View style={styles.indicatorDot} />}

      <Text
        style={[
          styles.tabLabel,
          { color: currentColor },
          isFocused && styles.tabLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// TabBar Props
// ---------------------------------------------------------------------------

export interface CustomTabBarProps extends BottomTabBarProps {
  /** Number of unread notifications to display on the Alerts tab badge */
  unreadCount?: number;
}

// ---------------------------------------------------------------------------
// Main TabBar Component
// ---------------------------------------------------------------------------

export function TabBar({
  state,
  descriptors,
  navigation,
  unreadCount = 0,
}: CustomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // Extra bottom padding for devices with home indicator (e.g. iPhone X+)
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          bottom: insets.bottom > 0 ? 4 : 12,
        },
      ]}
    >
      <View style={styles.innerBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          // Find matching tab config
          const tabConfig = TAB_CONFIG[index] || TAB_CONFIG[0];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              index={index}
              isFocused={isFocused}
              label={tabConfig.label}
              iconName={tabConfig.icon}
              iconOutline={tabConfig.iconOutline}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              unreadCount={
                tabConfig.key === 'AlertsTab' ? unreadCount : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export for convenience
// ---------------------------------------------------------------------------

export default TabBar;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  innerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Platform.select({
      ios: 'rgba(255, 255, 255, 0.92)',
      android: '#FFFFFF',
      default: '#FFFFFF',
    }),
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
    // Shadow -- elevation lg
    ...Platform.select({
      ios: {
        shadowColor: '#1B2845',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
    // Subtle border for glassmorphic appearance
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232, 236, 241, 0.6)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACTIVE_COLOR,
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BADGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: BADGE_TEXT,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
});
