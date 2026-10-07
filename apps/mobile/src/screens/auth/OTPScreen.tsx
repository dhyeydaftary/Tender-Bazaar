/**
 * TenderBazaar — Premium OTP Verification Screen
 *
 * Features: 6 individual OTP boxes with auto-advance, backspace handling,
 * clipboard paste support, scale pulse on fill, auto-submit,
 * countdown timer, Lottie success animation, haptic feedback.
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
  Clipboard,
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
  withSequence,
  withSpring,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../hooks/useAuth';
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

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type OTPRouteProp = RouteProp<AuthStackParamList, 'OTP'>;

// ---------------------------------------------------------------------------
// Animated OTP Box
// ---------------------------------------------------------------------------

function OTPBox({
  value,
  focused,
  filled,
  error,
}: {
  value: string;
  focused: boolean;
  filled: boolean;
  error: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (filled) {
      scale.value = withSequence(
        withSpring(1.05, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [filled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.otpBox,
        focused && styles.otpBoxFocused,
        filled && styles.otpBoxFilled,
        error && styles.otpBoxError,
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.otpText,
          filled && styles.otpTextFilled,
        ]}
      >
        {value}
      </Text>
      {focused && !value && <View style={styles.otpCursor} />}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OTPScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<OTPRouteProp>();
  const insets = useSafeAreaInsets();
  const { verifyOtp, sendOtp, isSubmitting, error: authError } = useAuth();
  const { phone } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(RESEND_TIMEOUT);
  const [isVerified, setIsVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    const t = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const maskedPhone = phone
    ? `+91 ${phone.slice(0, 3)}** ***${phone.slice(-2)}`
    : '+91 ***** *****';

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Handle paste of full OTP
      if (text.length > 1) {
        const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (digits.length === OTP_LENGTH) {
          const newOtp = digits.split('');
          setOtp(newOtp);
          setOtpError(false);
          ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
          inputRefs.current[OTP_LENGTH - 1]?.focus();
          // Auto-submit
          handleVerify(digits);
          return;
        }
      }

      const digit = text.replace(/\D/g, '').slice(-1);
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setOtpError(false);

      if (digit) {
        ReactNativeHapticFeedback.trigger('selection', hapticOptions);

        // Auto advance to next input
        if (index < OTP_LENGTH - 1) {
          inputRefs.current[index + 1]?.focus();
        }

        // Auto submit on last digit
        if (index === OTP_LENGTH - 1) {
          const fullOtp = newOtp.join('');
          if (fullOtp.length === OTP_LENGTH) {
            handleVerify(fullOtp);
          }
        }
      }
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace') {
        if (!otp[index] && index > 0) {
          const newOtp = [...otp];
          newOtp[index - 1] = '';
          setOtp(newOtp);
          inputRefs.current[index - 1]?.focus();
        } else {
          const newOtp = [...otp];
          newOtp[index] = '';
          setOtp(newOtp);
        }
        setOtpError(false);
      }
    },
    [otp],
  );

  const handleVerify = useCallback(
    async (code: string) => {
      const success = await verifyOtp(phone, code);
      if (success) {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        setIsVerified(true);
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }, 1500);
      } else {
        ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
        setOtpError(true);
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    },
    [verifyOtp, phone, navigation],
  );

  const handleResend = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    await sendOtp(phone);
    setTimer(RESEND_TIMEOUT);
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError(false);
    inputRefs.current[0]?.focus();
  }, [sendOtp, phone]);

  // Success state
  if (isVerified) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
        <LottieView
          source={require('../../assets/lottie/success-check.json')}
          autoPlay
          loop={false}
          style={styles.successLottie}
        />
        <Text style={styles.successTitle}>Verified!</Text>
        <Text style={styles.successSubtitle}>
          Your phone number has been verified successfully.
        </Text>
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

        {/* Header icon */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.headerIconContainer}
        >
          <View style={styles.headerIcon}>
            <Icon name="smartphone" size={32} color={PRIMARY} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.title}>Verify your phone</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneBold}>{maskedPhone}</Text>
          </Text>
        </Animated.View>

        {/* OTP Inputs */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.otpContainer}
        >
          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={1}
              onPress={() => inputRefs.current[index]?.focus()}
            >
              <OTPBox
                value={otp[index]}
                focused={focusedIndex === index}
                filled={!!otp[index]}
                error={otpError}
              />
            </TouchableOpacity>
          ))}

          {/* Hidden TextInputs */}
          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
            <TextInput
              key={`input-${index}`}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.hiddenInput}
              value={otp[index]}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              onFocus={() => setFocusedIndex(index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              caretHidden
            />
          ))}
        </Animated.View>

        {/* Error message */}
        {(otpError || authError) && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.otpErrorContainer}
          >
            <Icon name="alert-circle" size={14} color={DANGER} />
            <Text style={styles.otpErrorText}>
              {authError || 'Invalid code. Please try again.'}
            </Text>
          </Animated.View>
        )}

        {/* Resend section */}
        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.timerText}>
              Resend code in{' '}
              <Text style={styles.timerBold}>
                0:{String(timer).padStart(2, '0')}
              </Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.resendLink}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Change phone number */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.changePhoneButton}
        >
          <Icon name="edit-2" size={14} color={TEXT_SECONDARY} />
          <Text style={styles.changePhoneText}>Change phone number</Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Verify button */}
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (isSubmitting || otp.join('').length < OTP_LENGTH) &&
              styles.verifyButtonDisabled,
          ]}
          onPress={() => handleVerify(otp.join(''))}
          activeOpacity={0.85}
          disabled={isSubmitting || otp.join('').length < OTP_LENGTH}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.verifyText}>Verify</Text>
          )}
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
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: PRIMARY + '12',
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
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  phoneBold: {
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    position: 'relative',
  },
  otpBox: {
    width: 52,
    height: 58,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  otpBoxFocused: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  otpBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '06',
  },
  otpBoxError: {
    borderColor: DANGER,
    backgroundColor: DANGER + '06',
  },
  otpText: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  otpTextFilled: {
    color: SECONDARY,
  },
  otpCursor: {
    width: 2,
    height: 24,
    backgroundColor: PRIMARY,
    borderRadius: 1,
    position: 'absolute',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  otpErrorText: {
    fontSize: 13,
    color: DANGER,
    fontWeight: '500',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  timerText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  timerBold: {
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  resendLink: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  changePhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  changePhoneText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  verifyText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
  },
});
