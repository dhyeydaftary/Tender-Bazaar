/**
 * TenderBazaar — InAppReview
 *
 * Bottom-sheet in-app review prompt. Shows a 5-star rating row; if the
 * user rates >= 4 it prompts for an App Store review, otherwise it asks
 * for improvement feedback via a TextInput.
 *
 * Display conditions (checked by the parent):
 *  - App used for 7+ days  (MMKV `app.firstLaunch`)
 *  - At least one eligibility check completed
 *  - Not dismissed in the last 30 days
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { spacing, borderRadius } from '../../theme/spacing';
import { setString, setObject } from '../../services/storage/mmkv';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND = {
  primary: '#FF6B35',
  secondary: '#1B2845',
  accent: '#00D4AA',
} as const;

const STAR_SIZE = 36;
const STAR_COUNT = 5;
const SPRING_BOUNCE = { damping: 10, stiffness: 250 };
const SPRING_SLIDE = { damping: 20, stiffness: 140 };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InAppReviewProps {
  visible: boolean;
  onDismiss: () => void;
  onRate: (rating: number) => void;
  onFeedback: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Star Component
// ---------------------------------------------------------------------------

interface StarProps {
  index: number;
  filled: boolean;
  onPress: (index: number) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Star: React.FC<StarProps> = React.memo(({ index, filled, onPress }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (filled) {
      scale.value = withSequence(
        withSpring(1.35, SPRING_BOUNCE),
        withSpring(1, SPRING_BOUNCE),
      );
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    }
  }, [filled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    onPress(index);
  }, [index, onPress]);

  return (
    <AnimatedPressable onPress={handlePress} style={animatedStyle} hitSlop={8}>
      <Icon
        name={filled ? 'star' : 'star-outline'}
        size={STAR_SIZE}
        color={filled ? BRAND.primary : '#D1D5DB'}
      />
    </AnimatedPressable>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const InAppReview: React.FC<InAppReviewProps> = ({
  visible,
  onDismiss,
  onRate,
  onFeedback,
}) => {
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Slide animation
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, SPRING_SLIDE);
      // Reset state on open
      setRating(0);
      setFeedbackText('');
      setSubmitted(false);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Handlers
  const handleStarPress = useCallback((index: number) => {
    setRating(index + 1);
  }, []);

  const handleDismiss = useCallback(() => {
    setString('review.lastShown', new Date().toISOString());
    onDismiss();
  }, [onDismiss]);

  const handleRate = useCallback(() => {
    setObject('review.rating', { rating, date: new Date().toISOString() });
    setString('review.lastShown', new Date().toISOString());
    onRate(rating);
    setSubmitted(true);
  }, [rating, onRate]);

  const handleSendFeedback = useCallback(() => {
    if (!feedbackText.trim()) return;
    setObject('review.rating', { rating, date: new Date().toISOString() });
    setString('review.lastShown', new Date().toISOString());
    onFeedback(feedbackText.trim());
    setSubmitted(true);
  }, [rating, feedbackText, onFeedback]);

  if (!visible) return null;

  const isPositive = rating >= 4;

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {submitted ? (
          /* Thank you state */
          <View style={styles.content}>
            <View style={styles.thankYouIcon}>
              <Icon name="check-circle" size={48} color={BRAND.accent} />
            </View>
            <Text style={styles.title}>Thank you!</Text>
            <Text style={styles.subtitle}>
              {isPositive
                ? 'Your support means a lot to us.'
                : 'We appreciate your feedback and will work to improve.'}
            </Text>
            <Pressable onPress={handleDismiss} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          /* Rating / feedback state */
          <View style={styles.content}>
            {/* Header */}
            <Text style={styles.title}>
              {rating === 0
                ? 'How is your experience?'
                : isPositive
                  ? 'Enjoying TenderBazaar?'
                  : 'How can we improve?'}
            </Text>
            <Text style={styles.subtitle}>
              {rating === 0
                ? 'Tap a star to rate your experience'
                : isPositive
                  ? 'We are glad you like it! A rating helps us grow.'
                  : 'Your feedback helps us build a better product.'}
            </Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {Array.from({ length: STAR_COUNT }, (_, i) => (
                <Star
                  key={i}
                  index={i}
                  filled={i < rating}
                  onPress={handleStarPress}
                />
              ))}
            </View>

            {/* Action area */}
            {rating > 0 && (
              <View style={styles.actionArea}>
                {isPositive ? (
                  <Pressable onPress={handleRate} style={styles.primaryButton}>
                    <Icon name="star" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Rate us on the App Store</Text>
                  </Pressable>
                ) : (
                  <>
                    <TextInput
                      style={styles.feedbackInput}
                      value={feedbackText}
                      onChangeText={setFeedbackText}
                      placeholder="Tell us what we can do better..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <Pressable
                      onPress={handleSendFeedback}
                      style={[
                        styles.primaryButton,
                        styles.feedbackButton,
                        !feedbackText.trim() && styles.buttonDisabled,
                      ]}
                      disabled={!feedbackText.trim()}
                    >
                      <Icon name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Send Feedback</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* Dismiss link */}
            <Pressable onPress={handleDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Not Now</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...(StyleSheet.absoluteFill as object),
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...shadows.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8ECF1',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.xxl,
  },
  thankYouIcon: {
    marginBottom: spacing.base,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
    color: BRAND.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionArea: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: BRAND.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.sm,
    width: '100%',
    ...shadows.sm,
  },
  feedbackButton: {
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  feedbackInput: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: '#0F1117',
    backgroundColor: '#F7F8FA',
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 80,
    width: '100%',
  },
  dismissButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  dismissText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  doneButton: {
    backgroundColor: BRAND.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.sm,
    ...shadows.sm,
  },
  doneButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default React.memo(InAppReview);
