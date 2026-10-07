/**
 * TenderBazaar — SplashOverlay
 *
 * Animated splash/loading overlay for app startup. Shows the brand logo,
 * tagline, pulsing dot loader, and version string, then fades out once
 * the app is ready.
 */

import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fontFamilies } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND = {
  primary: '#FF6B35',
  secondary: '#1B2845',
} as const;

const DOT_SIZE = 8;
const DOT_COUNT = 3;
const DOT_GAP = 12;
const PULSE_DURATION = 500;

const SPRING_LOGO = { damping: 14, stiffness: 120 };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SplashOverlayProps {
  isVisible: boolean;
  onAnimationEnd?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SplashOverlay: React.FC<SplashOverlayProps> = ({ isVisible, onAnimationEnd }) => {
  // Logo entrance
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);

  // Subtitle
  const subtitleOpacity = useSharedValue(0);

  // Dots
  const dot0Scale = useSharedValue(0.6);
  const dot1Scale = useSharedValue(0.6);
  const dot2Scale = useSharedValue(0.6);
  const dot0Opacity = useSharedValue(0.4);
  const dot1Opacity = useSharedValue(0.4);
  const dot2Opacity = useSharedValue(0.4);

  // Exit
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Entrance animation
  useEffect(() => {
    // Logo: fade in + scale from 0.8 -> 1.0
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, SPRING_LOGO);

    // Subtitle: delayed fade-in
    subtitleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));

    // Dots: staggered pulse
    const pulseFn = (delay: number) =>
      withDelay(
        500 + delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.6, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        ),
      );

    const pulseOpacityFn = (delay: number) =>
      withDelay(
        500 + delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.4, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        ),
      );

    dot0Scale.value = pulseFn(0);
    dot1Scale.value = pulseFn(150);
    dot2Scale.value = pulseFn(300);
    dot0Opacity.value = pulseOpacityFn(0);
    dot1Opacity.value = pulseOpacityFn(150);
    dot2Opacity.value = pulseOpacityFn(300);
  }, [
    logoOpacity, logoScale, subtitleOpacity,
    dot0Scale, dot1Scale, dot2Scale,
    dot0Opacity, dot1Opacity, dot2Opacity,
  ]);

  // Exit animation
  useEffect(() => {
    if (!isVisible) {
      containerOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) });
      containerScale.value = withTiming(1.1, { duration: 300, easing: Easing.in(Easing.ease) }, () => {
        if (onAnimationEnd) {
          runOnJS(onAnimationEnd)();
        }
      });
    }
  }, [isVisible, containerOpacity, containerScale, onAnimationEnd]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const dot0Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot0Scale.value }],
    opacity: dot0Opacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
    opacity: dot1Opacity.value,
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
    opacity: dot2Opacity.value,
  }));

  // After exit animation, unmount entirely
  if (!isVisible && containerOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <Text style={styles.logoRow}>
          <Text style={styles.logoTender}>Tender</Text>
          <Text style={styles.logoBazaar}>Bazaar</Text>
        </Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={subtitleStyle}>
        <Text style={styles.subtitle}>AI-Powered Tender Platform</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, dot0Style]} />
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
      </View>

      {/* Version */}
      <Text style={styles.version}>v1.0.0</Text>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
  },
  logoTender: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoBazaar: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    fontWeight: '700',
    color: BRAND.primary,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
    marginTop: 40,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: BRAND.primary,
  },
  version: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    bottom: 40,
  },
});

export default React.memo(SplashOverlay);
