/**
 * TenderBazaar — OfflineBanner Component
 *
 * "No internet connection" banner.
 * Animated slide-down from top using Reanimated.
 * Red/amber background with icon.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform, StatusBar, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { lightColors as colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfflineBannerProps {
  isOffline: boolean;
  message?: string;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  message = 'No internet connection',
  style,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);

  useEffect(() => {
    translateY.value = withTiming(isOffline ? 0 : -100, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOffline, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const topPadding = insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44);

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: topPadding + spacing.xs },
        animatedStyle,
        style,
      ]}
      pointerEvents={isOffline ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        <Icon name="wifi-off" size={16} color="#FFFFFF" style={styles.icon} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.danger,
    zIndex: 9999,
    paddingBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default React.memo(OfflineBanner);
