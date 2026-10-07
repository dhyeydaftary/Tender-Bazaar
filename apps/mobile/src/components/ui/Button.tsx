/**
 * TenderBazaar — Premium Button Component
 *
 * Variants: solid | outline | ghost | icon
 * Sizes: sm (36h) | md (44h) | lg (56h)
 * Features: animated press (scale 0.96), haptic feedback, loading state
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { lightColors as colors } from '../../theme/colors';
import { typography, fontFamilies } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<ButtonSize, { height: number; paddingHorizontal: number; iconSize: number }> = {
  sm: { height: 36, paddingHorizontal: 14, iconSize: 36 },
  md: { height: 44, paddingHorizontal: 20, iconSize: 44 },
  lg: { height: 56, paddingHorizontal: 28, iconSize: 56 },
};

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.4,
};

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'solid',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    onPress();
  }, [disabled, loading, onPress]);

  const sizeConfig = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  // --- variant styles ---
  const variantContainer = getVariantContainerStyle(variant, isDisabled);
  const variantText = getVariantTextStyle(variant, isDisabled);
  const loaderColor =
    variant === 'solid' ? colors.textOnPrimary : colors.primary;

  const isIcon = variant === 'icon';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        variantContainer,
        isIcon
          ? { width: sizeConfig.iconSize, height: sizeConfig.iconSize, borderRadius: sizeConfig.iconSize / 2, paddingHorizontal: 0 }
          : { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal, borderRadius: borderRadius.xl },
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={loaderColor} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          {title && !isIcon ? (
            <Text
              style={[
                size === 'sm' ? typography.buttonSmall : typography.button,
                variantText,
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {/* For icon variant, render leftIcon centered without title */}
          {isIcon && !leftIcon && rightIcon && (
            <View>{rightIcon}</View>
          )}
          {rightIcon && !isIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </AnimatedPressable>
  );
};

// ---------------------------------------------------------------------------
// Variant helpers
// ---------------------------------------------------------------------------

function getVariantContainerStyle(
  variant: ButtonVariant,
  isDisabled: boolean,
): ViewStyle {
  if (isDisabled) {
    switch (variant) {
      case 'solid':
        return { backgroundColor: colors.disabled, borderWidth: 0 };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.disabled };
      case 'ghost':
      case 'icon':
        return { backgroundColor: 'transparent', borderWidth: 0 };
    }
  }

  switch (variant) {
    case 'solid':
      return { backgroundColor: colors.primary, borderWidth: 0 };
    case 'outline':
      return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary };
    case 'ghost':
      return { backgroundColor: 'transparent', borderWidth: 0 };
    case 'icon':
      return { backgroundColor: colors.primary + '14', borderWidth: 0 };
  }
}

function getVariantTextStyle(
  variant: ButtonVariant,
  isDisabled: boolean,
): TextStyle {
  if (isDisabled) {
    return { color: colors.textDisabled };
  }

  switch (variant) {
    case 'solid':
      return { color: colors.textOnPrimary };
    case 'outline':
    case 'ghost':
    case 'icon':
      return { color: colors.primary };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default React.memo(Button);
