/**
 * TenderBazaar — Premium Reset Password Screen
 *
 * Features: new password + confirm password with animated strength meter,
 * Lottie success animation, haptic feedback, validation,
 * KeyboardAvoidingView.
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
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
import type { AuthStackParamList, RootStackParamList } from '../../types/navigation';

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
const WARNING = '#F59E0B';
const SUCCESS = '#22C55E';
const STRENGTH_FAIR = '#FB923C';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ResetRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;

// ---------------------------------------------------------------------------
// Password Strength Logic
// ---------------------------------------------------------------------------

interface StrengthResult {
  level: number;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: DANGER };
  if (score === 2) return { level: 2, label: 'Fair', color: STRENGTH_FAIR };
  if (score === 3) return { level: 3, label: 'Good', color: WARNING };
  return { level: 4, label: 'Strong', color: SUCCESS };
}

// ---------------------------------------------------------------------------
// Animated Strength Segment
// ---------------------------------------------------------------------------

function StrengthSegment({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    fillProgress.value = withTiming(active ? 1 : 0, { duration: 300 });
  }, [active, fillProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: fillProgress.value > 0.5 ? color : '#E5E7EB',
    transform: [{ scaleX: fillProgress.value > 0.5 ? 1 : 0.85 }],
    opacity: fillProgress.value > 0.5 ? 1 : 0.5,
  }));

  return <Animated.View style={[styles.strengthSegment, animatedStyle]} />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ResetRouteProp>();
  const insets = useSafeAreaInsets();

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  // Shake animation
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeX]);

  // Auto-focus
  useEffect(() => {
    const t = setTimeout(() => {
      passwordRef.current?.focus();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      triggerShake();
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
      setIsReset(true);
    } catch {
      setError('Something went wrong. Please try again.');
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, triggerShake]);

  // Success state
  if (isReset) {
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
            source={require('../../assets/lottie/success-check.json')}
            autoPlay
            loop={false}
            style={styles.successLottie}
          />

          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successSubtitle}>
            Your password has been reset successfully.{'\n'}
            You can now login with your new password.
          </Text>
        </Animated.View>

        <View style={styles.successActions}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() =>
              navigation.navigate('Auth', { screen: 'Login' })
            }
            activeOpacity={0.85}
          >
            <Icon name="log-in" size={18} color="#FFFFFF" />
            <Text style={styles.loginButtonText}>Go to Login</Text>
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
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>

        {/* Header icon */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.iconContainer}
        >
          <View style={styles.iconCircle}>
            <View style={styles.iconInner}>
              <Icon name="shield" size={28} color={ACCENT} />
            </View>
          </View>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Create a new secure password for your account
          </Text>
        </Animated.View>

        {/* Error banner */}
        {error ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.errorBanner}
          >
            <Icon name="alert-circle" size={16} color={DANGER} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={shakeStyle}
        >
          {/* New Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>New Password</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && styles.inputFocused,
              ]}
            >
              <Icon
                name="lock"
                size={18}
                color={
                  focusedField === 'password' ? PRIMARY : TEXT_SECONDARY
                }
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                returnKeyType="next"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError('');
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={TEXT_SECONDARY}
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Meter */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4].map((i) => (
                    <StrengthSegment
                      key={i}
                      active={i <= strength.level}
                      color={strength.color}
                    />
                  ))}
                </View>
                <Text
                  style={[styles.strengthLabel, { color: strength.color }]}
                >
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'confirm' && styles.inputFocused,
              ]}
            >
              <Icon
                name="check-circle"
                size={18}
                color={
                  focusedField === 'confirm' ? PRIMARY : TEXT_SECONDARY
                }
                style={styles.inputIcon}
              />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError('');
                }}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon
                  name={showConfirm ? 'eye-off' : 'eye'}
                  size={18}
                  color={TEXT_SECONDARY}
                />
              </TouchableOpacity>
            </View>

            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchIndicator}>
                <Icon
                  name={
                    password === confirmPassword
                      ? 'check-circle'
                      : 'x-circle'
                  }
                  size={14}
                  color={password === confirmPassword ? SUCCESS : DANGER}
                />
                <Text
                  style={[
                    styles.matchText,
                    {
                      color:
                        password === confirmPassword ? SUCCESS : DANGER,
                    },
                  ]}
                >
                  {password === confirmPassword
                    ? 'Passwords match'
                    : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Password requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password requirements:</Text>
          <PasswordRequirement
            met={password.length >= 8}
            text="At least 8 characters"
          />
          <PasswordRequirement
            met={/[A-Z]/.test(password)}
            text="One uppercase letter"
          />
          <PasswordRequirement
            met={/[0-9]/.test(password)}
            text="One number"
          />
          <PasswordRequirement
            met={/[^A-Za-z0-9]/.test(password)}
            text="One special character"
          />
        </View>

        {/* Submit button */}
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
            <Text style={styles.submitText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Password Requirement Row
// ---------------------------------------------------------------------------

function PasswordRequirement({
  met,
  text,
}: {
  met: boolean;
  text: string;
}) {
  return (
    <View style={styles.requirementRow}>
      <Icon
        name={met ? 'check-circle' : 'circle'}
        size={14}
        color={met ? SUCCESS : TEXT_SECONDARY}
      />
      <Text
        style={[
          styles.requirementText,
          met && styles.requirementTextMet,
        ]}
      >
        {text}
      </Text>
    </View>
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
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
    backgroundColor: ACCENT + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: ACCENT + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DANGER + '0D',
    borderWidth: 1,
    borderColor: DANGER + '26',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: DANGER,
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 20,
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
  eyeButton: {
    padding: 6,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  strengthBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    marginRight: 12,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingLeft: 2,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirementsContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  requirementText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  requirementTextMet: {
    color: SUCCESS,
  },
  submitButton: {
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
  successLottie: {
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
    marginBottom: 40,
  },
  successActions: {
    width: '100%',
  },
  loginButton: {
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
  loginButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
