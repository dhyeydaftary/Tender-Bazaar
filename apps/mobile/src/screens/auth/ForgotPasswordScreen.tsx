/**
 * TenderBazaar — Premium Forgot Password Screen
 *
 * Features: email input with validation, lock icon in colored circle,
 * Lottie mail-sent animation on success, haptic feedback,
 * KeyboardAvoidingView.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/Feather';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const INPUT_BORDER = '#E8ECF1';
const DANGER = '#EF4444';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const emailRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Shake animation
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // Auto-focus email
  useEffect(() => {
    const t = setTimeout(() => {
      emailRef.current?.focus();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeX]);

  const handleSubmit = useCallback(async () => {
    // Validate
    if (!email.trim()) {
      setError('Please enter your email address');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      triggerShake();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      triggerShake();
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
      setIsSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    } finally {
      setIsLoading(false);
    }
  }, [email, triggerShake]);

  // Success state
  if (isSent) {
    return (
      <View
        style={[
          styles.successContainer,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.successContent}
        >
          <LottieView
            source={require('../../assets/lottie/mail-sent.json')}
            autoPlay
            loop={false}
            style={styles.mailLottie}
          />

          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successSubtitle}>
            We've sent a password reset link to{'\n'}
            <Text style={styles.emailBold}>{email}</Text>
          </Text>

          <View style={styles.successHint}>
            <Icon name="info" size={14} color={TEXT_SECONDARY} />
            <Text style={styles.successHintText}>
              Didn't receive the email? Check your spam folder or try again.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.successActions}>
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => {
              setIsSent(false);
              setEmail('');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.resendText}>Try a different email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        {/* Lock icon */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.iconContainer}
        >
          <View style={styles.iconCircle}>
            <View style={styles.iconInner}>
              <Icon name="lock" size={28} color={PRIMARY} />
            </View>
          </View>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a reset link to get back into
            your account.
          </Text>
        </Animated.View>

        {/* Email input */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={shakeStyle}
        >
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email Address</Text>
            {/* collapsable={false}: inputFocused adds shadowColor/elevation, which would
                otherwise flip this view into a new stacking context on focus. Fabric then
                re-parents the native TextInput, detaching it and dropping focus (Android). */}
            <View
              collapsable={false}
              style={[
                styles.inputWrapper,
                isFocused && styles.inputFocused,
                error ? styles.inputError : null,
              ]}
            >
              <Icon
                name="mail"
                size={18}
                color={error ? DANGER : isFocused ? PRIMARY : TEXT_SECONDARY}
                style={styles.inputIcon}
              />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onSubmitEditing={handleSubmit}
              />
              {email.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setEmail('');
                    setError('');
                  }}
                  style={styles.clearButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x-circle" size={16} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              )}
            </View>
            {error ? (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={styles.errorText}
              >
                {error}
              </Animated.Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Submit button */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              isLoading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Icon name="send" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Send Reset Link</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Back to login */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.bottomLink}
          activeOpacity={0.7}
        >
          <Text style={styles.bottomLinkText}>
            Remember your password?{' '}
            <Text style={styles.bottomLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: PRIMARY + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: PRIMARY + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  inputError: {
    borderColor: DANGER,
    backgroundColor: DANGER + '04',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT_PRIMARY,
    height: '100%',
    fontWeight: '400',
  },
  clearButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: DANGER,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  submitButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  spacer: {
    flex: 1,
  },
  bottomLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomLinkText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  bottomLinkBold: {
    color: PRIMARY,
    fontWeight: '700',
  },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
  },
  mailLottie: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  emailBold: {
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  successHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  successHintText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },
  successActions: {
    width: '100%',
    gap: 16,
  },
  backToLoginButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  backToLoginText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
});
