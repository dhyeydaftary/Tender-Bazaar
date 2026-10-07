/**
 * TenderBazaar — Card Component
 *
 * Elevated card with shadow, 16px radius, configurable padding.
 * Supports pressable variant with scale animation and accent left border.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { lightColors as colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { borderRadius, spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  accentColor?: string;
  padding?: number;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.4,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Card: React.FC<CardProps> = ({
  children,
  onPress,
  accentColor,
  padding = spacing.base,
  style,
  elevation = 'md',
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(0.97, SPRING_CONFIG);
    }
  }, [onPress, scale]);

  const handlePressOut = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [onPress, scale]);

  const shadowStyle = elevation !== 'none' ? shadows[elevation] : shadows.none;

  const containerStyle: ViewStyle[] = [
    styles.card,
    shadowStyle,
    { padding },
    accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[containerStyle, animatedStyle]}
        accessibilityRole="button"
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});

export default React.memo(Card);
