/**
 * TenderBazaar — Premium Login Screen
 *
 * Features: react-hook-form + zod, Reanimated shake on error,
 * haptic feedback, Lottie success animation, social login buttons,
 * auto-focus email, KeyboardAvoidingView.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../hooks/useAuth';
import type { RootStackParamList } from '../../types/navigation';

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
const INPUT_BG = '#F7F8FA';
const INPUT_BORDER = '#E8ECF1';
const INPUT_FOCUS = PRIMARY;
const DANGER = '#EF4444';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { login, isSubmitting, error: authError } = useAuth();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Shake animations
  const emailShakeX = useSharedValue(0);
  const passwordShakeX = useSharedValue(0);

  const emailShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: emailShakeX.value }],
  }));

  const passwordShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: passwordShakeX.value }],
  }));

  // Auto-focus email on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      emailRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Trigger shake on validation errors
  useEffect(() => {
    if (errors.email) {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      emailShakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [errors.email, emailShakeX]);

  useEffect(() => {
    if (errors.password) {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      passwordShakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [errors.password, passwordShakeX]);

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      const success = await login(data.email, data.password);
      if (success) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        setShowSuccess(true);
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }, 1200);
      } else {
        ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      }
    },
    [login, navigation],
  );

  // Success overlay
  if (showSuccess) {
    return (
      <View style={styles.successOverlay}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
        <LottieView
          source={require('../../assets/lottie/success-check.json')}
          autoPlay
          loop={false}
          style={styles.successLottie}
        />
        <Text style={styles.successText}>Welcome back!</Text>
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
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Header */}
        <View style={styles.headerSection}>
          <Text style={styles.logoText}>TenderBazaar</Text>
          <View style={styles.headerSpacing} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Auth Error Banner */}
        {authError && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.errorBanner}
          >
            <Icon name="alert-circle" size={18} color={DANGER} />
            <Text style={styles.errorBannerText}>{authError}</Text>
          </Animated.View>
        )}

        {/* Email Field */}
        <Animated.View style={emailShakeStyle}>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email address</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                // collapsable={false}: inputFocused adds shadowColor/elevation, which would
                // otherwise flip this view into a new stacking context on focus. Fabric then
                // re-parents the native TextInput, detaching it and dropping focus (Android).
                <View
                  collapsable={false}
                  style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputFocused,
                    errors.email && styles.inputError,
                  ]}
                >
                  <Icon
                    name="mail"
                    size={18}
                    color={
                      errors.email
                        ? DANGER
                        : emailFocused
                          ? PRIMARY
                          : TEXT_SECONDARY
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false);
                      onBlur();
                    }}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text style={styles.fieldError}>{errors.email.message}</Text>
            )}
          </View>
        </Animated.View>

        {/* Password Field */}
        <Animated.View style={passwordShakeStyle}>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                // See the email field: keeps the stacking context stable across focus.
                <View
                  collapsable={false}
                  style={[
                    styles.inputWrapper,
                    passwordFocused && styles.inputFocused,
                    errors.password && styles.inputError,
                  ]}
                >
                  <Icon
                    name="lock"
                    size={18}
                    color={
                      errors.password
                        ? DANGER
                        : passwordFocused
                          ? PRIMARY
                          : TEXT_SECONDARY
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false);
                      onBlur();
                    }}
                    onSubmitEditing={handleSubmit(onSubmit)}
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
              )}
            />
            {errors.password && (
              <Text style={styles.fieldError}>{errors.password.message}</Text>
            )}
          </View>
        </Animated.View>

        {/* Forgot password */}
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Auth', { screen: 'ForgotPassword' })
          }
          style={styles.forgotButton}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <TouchableOpacity
          style={[
            styles.signInButton,
            isSubmitting && styles.signInButtonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          activeOpacity={0.85}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signInText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
            <MCIcon name="google" size={20} color="#EA4335" />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
            <MCIcon name="apple" size={22} color={TEXT_PRIMARY} />
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>
        </View>

        {/* Sign in with OTP */}
        <TouchableOpacity
          style={styles.otpLink}
          onPress={() =>
            navigation.navigate('Auth', { screen: 'OTP', params: { phone: '' } })
          }
          activeOpacity={0.7}
        >
          <Icon name="smartphone" size={16} color={PRIMARY} />
          <Text style={styles.otpLinkText}>Sign in with OTP</Text>
        </TouchableOpacity>

        {/* Register link */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Auth', { screen: 'Register' })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    marginBottom: 36,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: -0.3,
    marginBottom: 32,
  },
  headerSpacing: {
    height: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '400',
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
    borderColor: INPUT_FOCUS,
    backgroundColor: CARD_BG,
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
  eyeButton: {
    padding: 6,
  },
  fieldError: {
    fontSize: 12,
    color: DANGER,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 28,
    marginTop: -8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  signInButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  signInButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
  },
  signInText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: INPUT_BORDER,
  },
  dividerText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginHorizontal: 16,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  otpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 20,
    gap: 6,
  },
  otpLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  registerText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  registerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  // Success overlay
  successOverlay: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successLottie: {
    width: 160,
    height: 160,
  },
  successText: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginTop: 16,
  },
});
