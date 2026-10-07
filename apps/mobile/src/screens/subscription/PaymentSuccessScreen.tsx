import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY = '#FF6B35';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BACKGROUND = '#FFFFFF';
const CARD_BG = '#F7F8FA';
const BORDER = '#E8ECF1';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'PaymentSuccess'>;

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  if (amount <= 0) return 'Free';
  if (amount >= 10000000) return `\u20B9${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `\u20B9${(amount / 100000).toFixed(2)} L`;
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

// ---------------------------------------------------------------------------
// Plan-specific data — matches actual TenderBazaar plans
// ---------------------------------------------------------------------------

interface PlanSuccessInfo {
  defaultAmount: number;
  features: string[];
}

const PLAN_INFO: Record<string, PlanSuccessInfo> = {
  Starter: {
    defaultAmount: 1499,
    features: [
      'Unlimited tender views with pagination',
      '50 saved tenders',
      '5 smart alerts configured',
      '10 AI eligibility checks / month',
      'Document downloads enabled',
      'Tender calendar access',
      'Email & push notifications',
    ],
  },
  Professional: {
    defaultAmount: 4999,
    features: [
      'Everything in Starter, plus:',
      'Unlimited saved tenders',
      '25 smart alerts configured',
      '50 AI eligibility checks / month',
      'WhatsApp notifications enabled',
      'Export to CSV / PDF',
      'Tender comparison (up to 3)',
      'Basic AI bid assistant',
    ],
  },
  Enterprise: {
    defaultAmount: 9999,
    features: [
      'Everything in Professional, plus:',
      'Unlimited smart alerts',
      'Unlimited AI eligibility checks',
      '5 team members included',
      'Competitor analysis tools',
      'Advanced AI bid assistant',
      'Dedicated account manager',
      'e-Tendering support',
    ],
  },
};

const DEFAULT_PLAN_INFO: PlanSuccessInfo = {
  defaultAmount: 4999,
  features: [
    'Unlimited tender views',
    '25 smart alerts configured',
    '50 AI eligibility checks / month',
    'WhatsApp notifications enabled',
    'Priority support access',
  ],
};

// ---------------------------------------------------------------------------
// Sparkle particle
// ---------------------------------------------------------------------------

const Sparkle = React.memo(function Sparkle({
  delay, x, y, size,
}: { delay: number; x: number; y: number; size: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 500 }),
      ),
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.3, { damping: 6, stiffness: 200 }),
        withTiming(0, { duration: 400 }),
      ),
    );
  }, [delay, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', left: x, top: y, zIndex: 5 }, animStyle]}>
      <Icon name="star-four-points" size={size} color="#FFD700" />
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Animated feature row
// ---------------------------------------------------------------------------

const FeatureRow = React.memo(function FeatureRow({
  text, index,
}: { text: string; index: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(30);

  useEffect(() => {
    const delayMs = 800 + index * 100;
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    translateX.value = withDelay(
      delayMs,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  // "Everything in X, plus:" is a header-style row
  const isHeaderRow = text.startsWith('Everything in');

  return (
    <Animated.View style={[featStyles.row, animStyle]}>
      {isHeaderRow ? (
        <View style={featStyles.headerDotWrap}>
          <Icon name="arrow-right" size={14} color={PRIMARY} />
        </View>
      ) : (
        <View style={featStyles.checkWrap}>
          <Icon name="check" size={14} color="#FFFFFF" />
        </View>
      )}
      <Text
        style={[
          featStyles.text,
          isHeaderRow && { fontFamily: fontFamilies.semiBold, color: PRIMARY },
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
});

const featStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
});

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

const ActionButton = React.memo(function ActionButton({
  label, icon, variant, delay: delayMs, onPress,
}: {
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'tertiary';
  delay: number;
  onPress: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
  }, [delayMs, opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: buttonScale.value },
    ],
  }));

  const handlePressIn = useCallback(() => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

  const handlePress = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    onPress();
  }, [onPress]);

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const iconColor = isPrimary ? '#FFFFFF' : TEXT_SECONDARY;
  const chevronColor = isPrimary ? '#FFFFFF' : TEXT_MUTED;

  return (
    <AnimatedTouchable
      style={[
        btnStyles.base,
        isPrimary && btnStyles.primary,
        isSecondary && btnStyles.secondary,
        !isPrimary && !isSecondary && btnStyles.tertiary,
        containerStyle,
      ]}
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}>
      <FeatherIcon name={icon} size={18} color={iconColor} />
      <Text
        style={[
          btnStyles.label,
          isPrimary && btnStyles.primaryLabel,
          isSecondary && btnStyles.secondaryLabel,
          !isPrimary && !isSecondary && btnStyles.tertiaryLabel,
        ]}>
        {label}
      </Text>
      <FeatherIcon name="chevron-right" size={16} color={chevronColor} />
    </AnimatedTouchable>
  );
});

const btnStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  primary: { backgroundColor: PRIMARY },
  secondary: {
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  tertiary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryLabel: { color: '#FFFFFF' },
  secondaryLabel: { color: TEXT_PRIMARY },
  tertiaryLabel: { color: TEXT_SECONDARY },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function PaymentSuccessScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const insets = useSafeAreaInsets();
  const { planName, amount, billingCycle, paymentId, orderId } = route.params;
  const lottieRef = useRef<LottieView>(null);

  const planInfo = useMemo(
    () => PLAN_INFO[planName] ?? DEFAULT_PLAN_INFO,
    [planName],
  );

  // Use real payment ID if available, otherwise generate a reference
  const transactionId = useMemo(() => {
    if (paymentId) return paymentId;
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `TBZ-${new Date().getFullYear()}-${rand}`;
  }, [paymentId]);

  // Format display amount
  const displayAmount = useMemo(() => {
    if (amount && amount > 0) return formatCurrency(amount);
    return formatCurrency(planInfo.defaultAmount);
  }, [amount, planInfo.defaultAmount]);

  const displayBillingCycle = useMemo(() => {
    if (billingCycle === 'YEARLY') return 'Yearly';
    return 'Monthly';
  }, [billingCycle]);

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [],
  );

  // Reanimated shared values
  const checkScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(15);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(25);

  useEffect(() => {
    // Check icon: scale 0 -> 1.2 -> 1.0 spring bounce
    checkScale.value = withDelay(
      300,
      withSequence(
        withSpring(1.2, { damping: 6, stiffness: 180 }),
        withSpring(1, { damping: 10, stiffness: 150 }),
      ),
    );

    // Title fade + slide
    titleOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    titleTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    // Details card fade + slide
    cardOpacity.value = withDelay(
      650,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    cardTranslateY.value = withDelay(
      650,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    // Stop confetti after 3 seconds
    const timeout = setTimeout(() => lottieRef.current?.pause(), 3000);
    ReactNativeHapticFeedback.trigger('notificationSuccess');

    return () => clearTimeout(timeout);
  }, [checkScale, titleOpacity, titleTranslateY, cardOpacity, cardTranslateY]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  // Navigation handlers
  const handleExploreDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [navigation]);

  const handleSetUpAlerts = useCallback(() => {
    navigation.navigate('CreateAlert');
  }, [navigation]);

  const handleCompleteProfile = useCallback(() => {
    navigation.navigate('CompanyProfile');
  }, [navigation]);

  // Sparkle positions around the check circle
  const sparkles = useMemo(
    () => [
      { delay: 400, x: SCREEN_WIDTH * 0.15, y: 80, size: 16 },
      { delay: 550, x: SCREEN_WIDTH * 0.75, y: 60, size: 12 },
      { delay: 700, x: SCREEN_WIDTH * 0.55, y: 110, size: 14 },
      { delay: 850, x: SCREEN_WIDTH * 0.25, y: 130, size: 10 },
      { delay: 650, x: SCREEN_WIDTH * 0.85, y: 100, size: 11 },
      { delay: 500, x: SCREEN_WIDTH * 0.4, y: 55, size: 13 },
    ],
    [],
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* Confetti Lottie */}
      <LottieView
        ref={lottieRef}
        source={require('../../assets/lottie/confetti.json')}
        autoPlay
        loop
        style={styles.lottie}
        pointerEvents="none"
      />

      {/* Sparkle particles */}
      {sparkles.map((s, i) => (
        <Sparkle key={i} delay={s.delay} x={s.x} y={s.y} size={s.size} />
      ))}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Animated check circle */}
        <Animated.View style={[styles.checkOuter, checkAnimStyle]}>
          <View style={styles.checkInner}>
            <Icon name="check" size={44} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* Title block */}
        <Animated.View style={[styles.titleBlock, titleAnimStyle]}>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.subtitle}>
            Welcome to{' '}
            <Text style={styles.planHighlight}>{planName}</Text>
          </Text>
        </Animated.View>

        {/* Transaction details card */}
        <Animated.View style={[styles.detailCard, shadows.md, cardAnimStyle]}>
          <Text style={styles.detailCardTitle}>Transaction Details</Text>
          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plan</Text>
            <Text style={styles.detailValue}>{planName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Billing</Text>
            <Text style={styles.detailValue}>{displayBillingCycle}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>{displayAmount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {paymentId ? 'Payment ID' : 'Transaction ID'}
            </Text>
            <Text style={styles.detailValueMono}>{transactionId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formattedDate}</Text>
          </View>
          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Completed</Text>
            </View>
          </View>
        </Animated.View>

        {/* What's unlocked */}
        <View style={styles.unlockedSection}>
          <Animated.Text style={[styles.unlockedTitle, titleAnimStyle]}>
            What's Unlocked
          </Animated.Text>
          {planInfo.features.map((feature, index) => (
            <FeatureRow key={index} text={feature} index={index} />
          ))}
        </View>

        {/* GST note */}
        <Animated.View style={[styles.gstNoteContainer, cardAnimStyle]}>
          <Icon name="information-outline" size={14} color={TEXT_MUTED} />
          <Text style={styles.gstNoteText}>
            Amount shown is inclusive of 18% GST
          </Text>
        </Animated.View>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          <ActionButton
            label="Explore Dashboard"
            icon="layout"
            variant="primary"
            delay={1400}
            onPress={handleExploreDashboard}
          />
          <ActionButton
            label="Set Up Alerts"
            icon="bell"
            variant="secondary"
            delay={1550}
            onPress={handleSetUpAlerts}
          />
          <ActionButton
            label="Complete Profile"
            icon="user"
            variant="tertiary"
            delay={1700}
            onPress={handleCompleteProfile}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default React.memo(PaymentSuccessScreen);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  lottie: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 2,
    pointerEvents: 'none',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },

  // Check circle
  checkOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    zIndex: 10,
  },
  checkInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title
  titleBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  planHighlight: {
    color: PRIMARY,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
  },

  // Transaction details
  detailCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  detailCardTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },
  detailDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  detailValueMono: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT + '15',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: ACCENT,
  },
  statusText: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#0A7B5A',
  },

  // What's unlocked
  unlockedSection: {
    width: '100%',
    marginBottom: 16,
  },
  unlockedTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 18,
  },

  // GST note
  gstNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  gstNoteText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: TEXT_MUTED,
  },

  // Action buttons
  actionsSection: {
    width: '100%',
    gap: 12,
  },
});
