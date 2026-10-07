/**
 * TenderBazaar — Chip Component
 *
 * Filter chip: active (filled saffron) / inactive (outlined gray).
 * Animated transition on press.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { lightColors as colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 350,
  mass: 0.4,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onPress,
  leftIcon,
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.94, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        animatedScale,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {leftIcon}
      <Text
        style={[
          styles.label,
          active ? styles.labelActive : styles.labelInactive,
          leftIcon ? { marginLeft: spacing.xs } : undefined,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  label: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.textOnPrimary,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});

export default React.memo(Chip);
