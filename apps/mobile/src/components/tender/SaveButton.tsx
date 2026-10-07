/**
 * TenderBazaar -- SaveButton Component (Premium)
 *
 * Animated bookmark toggle with burst-scale animation and haptic feedback.
 * - Unfilled: outline bookmark icon (#9CA3AF gray)
 * - Filled: solid bookmark icon (#FF6B35 saffron) with scale burst
 * - On press: withSequence(withSpring(1.4), withSpring(1.0)) for scale
 * - Haptic feedback (impactLight) on toggle
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_SAVED = '#FF6B35';
const COLOR_UNSAVED = '#9CA3AF';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaveButtonProps {
  isSaved: boolean;
  onToggle: () => void;
  size?: number;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Animated wrapper
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SaveButton: React.FC<SaveButtonProps> = ({
  isSaved,
  onToggle,
  size = 24,
  style,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Burst scale animation: pop up to 1.4, settle back to 1.0
    scale.value = withSequence(
      withSpring(1.4, { damping: 6, stiffness: 500, mass: 0.3 }),
      withSpring(1.0, { damping: 10, stiffness: 300, mass: 0.4 }),
    );
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    onToggle();
  }, [onToggle, scale]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.button, animatedStyle, style]}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Unsave tender' : 'Save tender'}
      accessibilityState={{ selected: isSaved }}
    >
      <Icon
        name={isSaved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={isSaved ? COLOR_SAVED : COLOR_UNSAVED}
      />
    </AnimatedPressable>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: 20,
  },
});

export default React.memo(SaveButton);
