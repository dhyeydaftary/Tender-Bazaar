/**
 * TenderBazaar — StatusDot Component
 *
 * Small dot with pulsing animation (scale 1 -> 1.3 -> 1, repeating).
 */

import React, { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { lightColors as colors } from '../../theme/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusDotProps {
  color?: string;
  size?: number;
  pulse?: boolean;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const StatusDot: React.FC<StatusDotProps> = ({
  color = colors.success,
  size = 8,
  pulse = true,
  style,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1, // infinite
        true, // reverse
      );
    } else {
      scale.value = 1;
    }
  }, [pulse, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  dot: {},
});

export default React.memo(StatusDot);
