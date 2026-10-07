/**
 * TenderBazaar — Premium Register Screen
 *
 * Features: react-hook-form + zod, animated password strength meter,
 * haptic feedback, social signup, terms checkbox, phone +91 prefix.
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
const INPUT_BORDER = '#E8ECF1';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';
const SUCCESS = '#22C55E';
const STRENGTH_FAIR = '#FB923C';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').min(2, 'Name is too short'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z
      .string()
      .min(1, 'Phone is required')
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Minimum 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
  index,
  active,
  color,
}: {
  index: number;
  active: boolean;
  color: string;
}) {
  const widthAnim = useSharedValue(0);
  const bgColor = useSharedValue('#E5E7EB');

  useEffect(() => {
    widthAnim.value = withTiming(active ? 1 : 0, { duration: 300 });
  }, [active, widthAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: widthAnim.value > 0.5 ? color : '#E5E7EB',
    transform: [{ scaleX: widthAnim.value > 0.5 ? 1 : 0.85 }],
    opacity: widthAnim.value > 0.5 ? 1 : 0.5,
  }));

  return <Animated.View style={[styles.strengthSegment, animatedStyle]} />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { register: registerUser, isSubmitting, error: authError } = useAuth();

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Shake animation
  const formShakeX = useSharedValue(0);
  const formShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: formShakeX.value }],
  }));

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');
  const strength = useMemo(
    () => getPasswordStrength(passwordValue || ''),
    [passwordValue],
  );

  // Shake on validation errors
  useEffect(() => {
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      formShakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [errors, formShakeX]);

  const onSubmit = useCallback(
    async (data: RegisterForm) => {
      if (!termsAccepted) {
        ReactNativeHapticFeedback.trigger('notificationWarning', hapticOptions);
        return;
      }
      const success = await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
      });
      if (success) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        navigation.navigate('Auth', {
          screen: 'OTP',
          params: { phone: data.phone },
        });
      } else {
        ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
      }
    },
    [termsAccepted, registerUser, navigation],
  );

  const renderFieldIcon = (
    name: string,
    iconName: string,
    hasError: boolean,
  ) => {
    const isFocused = focusedField === name;
    return (
      <Icon
        name={iconName}
        size={18}
        color={hasError ? DANGER : isFocused ? PRIMARY : TEXT_SECONDARY}
        style={styles.inputIcon}
      />
    );
  };

  const getInputStyle = (name: string, hasError: boolean) => [
    styles.inputWrapper,
    focusedField === name && styles.inputFocused,
    hasError && styles.inputError,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
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

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join 10,000+ businesses winning government contracts
          </Text>
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

        <Animated.View style={formShakeStyle}>
          {/* Full Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Full Name</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={getInputStyle('name', !!errors.name)}>
                  {renderFieldIcon('name', 'user', !!errors.name)}
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => {
                      setFocusedField(null);
                      onBlur();
                    }}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
              )}
            />
            {errors.name && (
              <Text style={styles.fieldError}>{errors.name.message}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email address</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={getInputStyle('email', !!errors.email)}>
                  {renderFieldIcon('email', 'mail', !!errors.email)}
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
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => {
                      setFocusedField(null);
                      onBlur();
                    }}
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text style={styles.fieldError}>{errors.email.message}</Text>
            )}
          </View>

          {/* Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Phone number</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={getInputStyle('phone', !!errors.phone)}>
                  <View style={styles.phonePrefix}>
                    <Text style={styles.phonePrefixText}>+91</Text>
                  </View>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    ref={phoneRef}
                    style={styles.input}
                    placeholder="9876543210"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => {
                      setFocusedField(null);
                      onBlur();
                    }}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              )}
            />
            {errors.phone && (
              <Text style={styles.fieldError}>{errors.phone.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={getInputStyle('password', !!errors.password)}>
                  {renderFieldIcon('password', 'lock', !!errors.password)}
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => {
                      setFocusedField(null);
                      onBlur();
                    }}
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
              )}
            />
            {errors.password && (
              <Text style={styles.fieldError}>{errors.password.message}</Text>
            )}

            {/* Password Strength Meter */}
            {passwordValue && passwordValue.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4].map((i) => (
                    <StrengthSegment
                      key={i}
                      index={i}
                      active={i <= strength.level}
                      color={strength.color}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={getInputStyle(
                    'confirmPassword',
                    !!errors.confirmPassword,
                  )}
                >
                  {renderFieldIcon(
                    'confirmPassword',
                    'check-circle',
                    !!errors.confirmPassword,
                  )}
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirm}
                    returnKeyType="done"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => {
                      setFocusedField(null);
                      onBlur();
                    }}
                    onSubmitEditing={handleSubmit(onSubmit)}
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
              )}
            />
            {errors.confirmPassword && (
              <Text style={styles.fieldError}>
                {errors.confirmPassword.message}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Terms */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => {
            ReactNativeHapticFeedback.trigger('selection', hapticOptions);
            setTermsAccepted(!termsAccepted);
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              termsAccepted && styles.checkboxActive,
            ]}
          >
            {termsAccepted && (
              <Icon name="check" size={14} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.termsText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        {/* Create Account Button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (!termsAccepted || isSubmitting) && styles.createButtonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          activeOpacity={0.85}
          disabled={!termsAccepted || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Signup */}
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

        {/* Login link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Auth', { screen: 'Login' })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.loginLink}>Login</Text>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerSection: {
    marginBottom: 28,
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
    lineHeight: 22,
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
    marginBottom: 18,
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
  phonePrefix: {
    paddingRight: 4,
  },
  phonePrefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: INPUT_BORDER,
    marginHorizontal: 12,
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  termsLink: {
    color: PRIMARY,
    fontWeight: '600',
  },
  createButton: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 28,
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  loginText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
});
