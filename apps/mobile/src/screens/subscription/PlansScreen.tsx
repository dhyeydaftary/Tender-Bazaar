import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Toast from 'react-native-toast-message';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { usePlans, useCurrentSubscription, useCreateCheckout, useVerifyPayment } from '../../hooks/useSubscription';
import { ProrationModal } from '../../components/subscription';
import type { SubscriptionPlan } from '../../services/api/subscription';
import { openRazorpayCheckout, isRazorpayCancellation } from '../../utils/razorpay';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const BLUE = '#3B82F6';
const GRAY_PLAN = '#6B7280';

const CARD_WIDTH = SCREEN_WIDTH * 0.88;
const CARD_MARGIN_H = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const SNAP_INTERVAL = CARD_WIDTH + 16;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Plan data types
// ---------------------------------------------------------------------------

interface PlanFeature {
  icon: string;
  text: string;
}

interface PlanData {
  id: string;
  slug: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: string;
  themeColor: string;
  themeBgLight: string;
  popular: boolean;
  ctaLabel: string;
  features: PlanFeature[];
}

// ---------------------------------------------------------------------------
// Plan theme mapping
// ---------------------------------------------------------------------------

const PLAN_THEMES: Record<string, { icon: string; color: string; bg: string }> = {
  free: { icon: 'gift-outline', color: GRAY_PLAN, bg: '#F3F4F6' },
  starter: { icon: 'rocket-launch-outline', color: BLUE, bg: '#EFF6FF' },
  professional: { icon: 'star-four-points-outline', color: PRIMARY, bg: '#FFF4EE' },
  enterprise: { icon: 'diamond-stone', color: SECONDARY, bg: '#EEF0F4' },
};

/** Build features list from API SubscriptionPlan */
function buildFeaturesFromPlan(plan: SubscriptionPlan): PlanFeature[] {
  const features: PlanFeature[] = [];

  // Views
  if (plan.paginationAllowed) {
    features.push({ icon: 'infinity', text: 'Unlimited tender views' });
  } else {
    features.push({ icon: 'eye-outline', text: `${plan.tenderViewsPerPage} tenders per page` });
  }

  // Saved tenders
  if (plan.maxSavedTenders === -1) {
    features.push({ icon: 'bookmark-outline', text: 'Unlimited saved tenders' });
  } else if (plan.maxSavedTenders > 0) {
    features.push({ icon: 'bookmark-outline', text: `${plan.maxSavedTenders} saved tenders` });
  }

  // Alerts
  if (plan.maxAlerts === -1) {
    features.push({ icon: 'bell-ring-outline', text: 'Unlimited smart alerts' });
  } else if (plan.maxAlerts > 0) {
    features.push({ icon: 'bell-outline', text: `${plan.maxAlerts} smart alerts` });
  }

  // AI checks
  if (plan.maxAiChecks === -1) {
    features.push({ icon: 'robot-outline', text: 'Unlimited AI eligibility checks' });
  } else if (plan.maxAiChecks > 0) {
    const suffix = plan.aiChecksResetMonthly ? '/month' : ' total';
    features.push({ icon: 'robot-outline', text: `${plan.maxAiChecks} AI checks${suffix}` });
  }

  if (plan.documentDownload) features.push({ icon: 'file-document-outline', text: 'Document download' });
  if (plan.whatsappAlerts) features.push({ icon: 'whatsapp', text: 'WhatsApp alerts' });
  if (plan.tenderCalendar) features.push({ icon: 'calendar', text: 'Tender calendar' });
  if (plan.tenderComparison) features.push({ icon: 'chart-box-outline', text: 'Tender comparison' });
  if (plan.exportEnabled) features.push({ icon: 'file-export-outline', text: 'Export CSV/PDF' });
  if (plan.advancedFilters) features.push({ icon: 'magnify-plus-outline', text: 'Advanced search filters' });

  if (plan.aiBidAssistant === 'advanced') {
    features.push({ icon: 'shield-check-outline', text: 'Advanced bid assistant' });
  } else if (plan.aiBidAssistant === 'basic') {
    features.push({ icon: 'shield-outline', text: 'Basic bid assistant' });
  }

  if (plan.competitorAnalysis) features.push({ icon: 'chart-line', text: 'Competitor analysis' });
  if (plan.maxTeamMembers > 1) features.push({ icon: 'account-group-outline', text: `${plan.maxTeamMembers} team members` });
  if (plan.dedicatedManager) features.push({ icon: 'account-tie-outline', text: 'Dedicated account manager' });
  if (plan.eTenderingSupport) features.push({ icon: 'headphones', text: 'e-Tendering support' });

  return features;
}

/** Convert API SubscriptionPlan to local PlanData for UI */
function toPlanData(plan: SubscriptionPlan, currentPlanSlug: string | null): PlanData {
  const theme = PLAN_THEMES[plan.slug] || PLAN_THEMES.free;
  const isCurrent = plan.slug === currentPlanSlug;

  let ctaLabel = 'Get Started';
  if (isCurrent) ctaLabel = 'Current Plan';
  else if (plan.slug === 'free') ctaLabel = 'Free Plan';
  else if (plan.slug === 'enterprise') ctaLabel = 'Upgrade Now';
  else ctaLabel = 'Upgrade Now';

  return {
    id: plan.slug,
    slug: plan.slug,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    icon: theme.icon,
    themeColor: theme.color,
    themeBgLight: theme.bg,
    popular: plan.isPopular,
    ctaLabel,
    features: buildFeaturesFromPlan(plan),
  };
}

const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise'];

// ---------------------------------------------------------------------------
// Comparison table data builder
// ---------------------------------------------------------------------------

interface ComparisonRow {
  label: string;
  values: string[];
}

function buildComparisonRows(plans: SubscriptionPlan[]): ComparisonRow[] {
  const sorted = [...plans].sort((a, b) => a.displayOrder - b.displayOrder);
  const val = (v: number | boolean, unlimited = false): string => {
    if (typeof v === 'boolean') return v ? '\u2713' : '\u2717';
    if (v === -1) return 'Unlimited';
    return String(v);
  };

  return [
    { label: 'Tenders/Page', values: sorted.map(p => p.paginationAllowed ? 'Unlimited' : String(p.tenderViewsPerPage)) },
    { label: 'Saved Tenders', values: sorted.map(p => val(p.maxSavedTenders)) },
    { label: 'Smart Alerts', values: sorted.map(p => val(p.maxAlerts)) },
    { label: 'AI Checks', values: sorted.map(p => p.maxAiChecks === -1 ? 'Unlimited' : p.aiChecksResetMonthly ? `${p.maxAiChecks}/mo` : `${p.maxAiChecks} total`) },
    { label: 'Doc Download', values: sorted.map(p => val(p.documentDownload)) },
    { label: 'WhatsApp', values: sorted.map(p => val(p.whatsappAlerts)) },
    { label: 'Calendar', values: sorted.map(p => val(p.tenderCalendar)) },
    { label: 'Export', values: sorted.map(p => val(p.exportEnabled)) },
    { label: 'Comparison', values: sorted.map(p => val(p.tenderComparison)) },
    { label: 'Bid Assistant', values: sorted.map(p => p.aiBidAssistant === 'none' ? '\u2717' : p.aiBidAssistant === 'basic' ? 'Basic' : 'Advanced') },
    { label: 'Team Members', values: sorted.map(p => val(p.maxTeamMembers)) },
    { label: 'Dedicated Mgr', values: sorted.map(p => val(p.dedicatedManager)) },
  ];
}

// ---------------------------------------------------------------------------
// Price display with crossfade animation
// ---------------------------------------------------------------------------

const PriceDisplay = React.memo(function PriceDisplay({
  plan,
  isYearly,
}: {
  plan: PlanData;
  isYearly: boolean;
}) {
  const monthlyOpacity = useSharedValue(isYearly ? 0 : 1);
  const yearlyOpacity = useSharedValue(isYearly ? 1 : 0);

  useEffect(() => {
    monthlyOpacity.value = withTiming(isYearly ? 0 : 1, { duration: 250 });
    yearlyOpacity.value = withTiming(isYearly ? 1 : 0, { duration: 250 });
  }, [isYearly, monthlyOpacity, yearlyOpacity]);

  const monthlyAnimStyle = useAnimatedStyle(() => ({
    opacity: monthlyOpacity.value,
    position: 'absolute' as const,
  }));

  const yearlyAnimStyle = useAnimatedStyle(() => ({
    opacity: yearlyOpacity.value,
  }));

  const formatINR = useCallback((val: number) => val.toLocaleString('en-IN'), []);

  if (plan.monthlyPrice === 0) {
    return (
      <View style={priceStyles.container}>
        <Text style={[priceStyles.amount, { color: plan.themeColor }]}>
          {'\u20B9'}0
        </Text>
        <Text style={priceStyles.period}>/forever</Text>
      </View>
    );
  }

  return (
    <View style={priceStyles.container}>
      <View style={priceStyles.priceRow}>
        <Animated.View style={monthlyAnimStyle}>
          <Text style={[priceStyles.amount, { color: plan.themeColor }]}>
            {'\u20B9'}{formatINR(plan.monthlyPrice)}
          </Text>
        </Animated.View>
        <Animated.View style={yearlyAnimStyle}>
          <Text style={[priceStyles.amount, { color: plan.themeColor }]}>
            {'\u20B9'}{formatINR(plan.yearlyPrice)}
          </Text>
        </Animated.View>
      </View>
      <Text style={priceStyles.period}>
        /{isYearly ? 'year' : 'month'}
      </Text>
    </View>
  );
});

const priceStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  priceRow: {
    height: 38,
    justifyContent: 'center',
  },
  amount: {
    fontSize: 28,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  period: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Popular ribbon badge
// ---------------------------------------------------------------------------

const PopularRibbon = React.memo(function PopularRibbon() {
  return (
    <View style={ribbonStyles.container}>
      <View style={ribbonStyles.ribbon}>
        <Icon name="star" size={11} color="#FFFFFF" />
        <Text style={ribbonStyles.text}>MOST POPULAR</Text>
      </View>
    </View>
  );
});

const ribbonStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    right: -6,
    zIndex: 10,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    gap: 4,
  },
  text: {
    fontSize: 10,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
});

// ---------------------------------------------------------------------------
// Plan card component
// ---------------------------------------------------------------------------

const PlanCard = React.memo(function PlanCard({
  plan,
  isYearly,
  index,
  onPressCTA,
}: {
  plan: PlanData;
  isYearly: boolean;
  index: number;
  onPressCTA: (plan: PlanData) => void;
}) {
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Staggered card entrance
    cardScale.value = withDelay(
      index * 100,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );
    cardOpacity.value = withDelay(
      index * 100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    // Subtle glow pulse for the popular card
    if (plan.popular) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
  }, [cardScale, cardOpacity, glowOpacity, index, plan.popular]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: plan.popular ? PRIMARY : BORDER,
    borderWidth: plan.popular ? 2.5 : 1,
    opacity: plan.popular ? glowOpacity.value + 0.5 : 1,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

  const handleCTA = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    onPressCTA(plan);
  }, [onPressCTA, plan]);

  const isFree = plan.monthlyPrice === 0;
  const btnBg = isFree ? BACKGROUND : plan.themeColor;
  const btnTextColor = isFree ? TEXT_SECONDARY : '#FFFFFF';

  return (
    <Animated.View
      style={[cardStyles.wrapper, { width: CARD_WIDTH }, cardAnimStyle]}>
      <Animated.View style={[cardStyles.card, shadows.lg, glowStyle]}>
        {plan.popular && <PopularRibbon />}

        {/* Plan icon */}
        <View
          style={[
            cardStyles.iconCircle,
            { backgroundColor: plan.themeBgLight },
          ]}>
          <Icon name={plan.icon} size={28} color={plan.themeColor} />
        </View>

        {/* Plan name */}
        <Text style={cardStyles.planName}>{plan.name}</Text>

        {/* Animated price */}
        <PriceDisplay plan={plan} isYearly={isYearly} />

        {/* Divider */}
        <View style={cardStyles.divider} />

        {/* Features list */}
        <ScrollView
          style={cardStyles.featureScroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          {plan.features.map((feature, i) => (
            <View key={i} style={cardStyles.featureRow}>
              <View
                style={[
                  cardStyles.featureIconWrap,
                  { backgroundColor: plan.themeBgLight },
                ]}>
                <Icon name={feature.icon} size={15} color={plan.themeColor} />
              </View>
              <Text style={cardStyles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* CTA button */}
        <AnimatedTouchable
          style={[
            cardStyles.ctaButton,
            { backgroundColor: btnBg },
            buttonAnimStyle,
          ]}
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleCTA}>
          <Text style={[cardStyles.ctaText, { color: btnTextColor }]}>
            {plan.ctaLabel}
          </Text>
          {!isFree && (
            <FeatherIcon name="arrow-right" size={18} color={btnTextColor} />
          )}
        </AnimatedTouchable>
      </Animated.View>
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 22,
    minHeight: SCREEN_HEIGHT * 0.72,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  planName: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
    marginHorizontal: 4,
  },
  featureScroll: {
    flex: 1,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  ctaButton: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

// ---------------------------------------------------------------------------
// Comparison table (expandable)
// ---------------------------------------------------------------------------

const ComparisonTable = React.memo(function ComparisonTable({
  plans,
}: {
  plans: SubscriptionPlan[];
}) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const rows = useMemo(() => buildComparisonRows(plans), [plans]);
  const headers = useMemo(
    () => [...plans].sort((a, b) => a.displayOrder - b.displayOrder).map(p => p.name),
    [plans],
  );

  const toggleExpanded = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setExpanded((prev) => !prev);
    rotation.value = withSpring(expanded ? 0 : 1, {
      damping: 14,
      stiffness: 150,
    });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  if (plans.length === 0) return null;

  return (
    <View style={[tblStyles.container, shadows.md]}>
      <TouchableOpacity
        style={tblStyles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}>
        <View style={tblStyles.headerLeft}>
          <Icon name="table" size={20} color={PRIMARY} />
          <Text style={tblStyles.headerTitle}>Compare All Features</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <FeatherIcon name="chevron-down" size={22} color={TEXT_SECONDARY} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={tblStyles.scrollH}>
            <View>
              {/* Column headers */}
              <View style={tblStyles.row}>
                <View style={tblStyles.labelCell}>
                  <Text style={tblStyles.labelCellText}>Feature</Text>
                </View>
                {headers.map((header) => (
                  <View key={header} style={tblStyles.valueCell}>
                    <Text style={tblStyles.colHeader}>{header}</Text>
                  </View>
                ))}
              </View>

              {/* Data rows */}
              {rows.map((row, rowIdx) => (
                <View
                  key={row.label}
                  style={[
                    tblStyles.row,
                    rowIdx % 2 === 0 && tblStyles.rowEven,
                  ]}>
                  <View style={tblStyles.labelCell}>
                    <Text style={tblStyles.rowLabel}>{row.label}</Text>
                  </View>
                  {row.values.map((val, colIdx) => {
                    const isCheck = val === '\u2713';
                    const isCross = val === '\u2717';
                    return (
                      <View key={colIdx} style={tblStyles.valueCell}>
                        {isCheck ? (
                          <Icon
                            name="check-circle"
                            size={18}
                            color={ACCENT}
                          />
                        ) : isCross ? (
                          <Icon
                            name="close-circle-outline"
                            size={18}
                            color="#D1D5DB"
                          />
                        ) : (
                          <Text style={tblStyles.valueText}>{val}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
});

const tblStyles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  scrollH: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  rowEven: {
    backgroundColor: '#FAFBFC',
  },
  labelCell: {
    width: 140,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  labelCellText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colHeader: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  valueCell: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  valueText: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Money-back guarantee banner
// ---------------------------------------------------------------------------

const GuaranteeBanner = React.memo(function GuaranteeBanner() {
  return (
    <Animated.View
      entering={FadeIn.delay(600).duration(400)}
      style={bannerStyles.container}>
      <Icon name="shield-check-outline" size={20} color={ACCENT} />
      <Text style={bannerStyles.text}>
        30-day money-back guarantee on all paid plans
      </Text>
    </Animated.View>
  );
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: ACCENT + '10',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT + '30',
    gap: 10,
  },
  text: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// Main screen component
// ---------------------------------------------------------------------------

function PlansScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const [isYearly, setIsYearly] = useState(false);
  const flatListRef = useRef<FlatList<PlanData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // API data
  const { data: apiPlans, isLoading: plansLoading } = usePlans();
  const { data: subData } = useCurrentSubscription();
  const createCheckoutMutation = useCreateCheckout();

  const currentPlanSlug = subData?.plan?.slug || 'free';

  // ProrationModal state
  const [upgradeTarget, setUpgradeTarget] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  // Convert API plans to PlanData for the UI
  const planCards: PlanData[] = useMemo(() => {
    if (!apiPlans || apiPlans.length === 0) return [];
    return [...apiPlans]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((p) => toPlanData(p, currentPlanSlug));
  }, [apiPlans, currentPlanSlug]);

  // Toggle shared values
  const togglePosition = useSharedValue(0);
  const saveBadgeScale = useSharedValue(0);

  useEffect(() => {
    togglePosition.value = withSpring(isYearly ? 1 : 0, {
      damping: 16,
      stiffness: 180,
    });
    saveBadgeScale.value = isYearly
      ? withSequence(
          withTiming(1.2, { duration: 200 }),
          withSpring(1, { damping: 8, stiffness: 200 }),
        )
      : withTiming(0, { duration: 150 });
  }, [isYearly, togglePosition, saveBadgeScale]);

  const toggleKnobStyle = useAnimatedStyle(() => {
    const halfWidth = (SCREEN_WIDTH - 48 - 8) / 2;
    return {
      transform: [
        {
          translateX: interpolate(
            togglePosition.value,
            [0, 1],
            [0, halfWidth],
          ),
        },
      ],
    };
  });

  const monthlyTextStyle = useAnimatedStyle(() => ({
    color:
      interpolate(togglePosition.value, [0, 1], [1, 0]) > 0.5
        ? '#FFFFFF'
        : TEXT_SECONDARY,
  }));

  const yearlyTextStyle = useAnimatedStyle(() => ({
    color:
      interpolate(togglePosition.value, [0, 1], [0, 1]) > 0.5
        ? '#FFFFFF'
        : TEXT_SECONDARY,
  }));

  const saveBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveBadgeScale.value }],
    opacity: saveBadgeScale.value,
  }));

  const handleToggle = useCallback((yearly: boolean) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setIsYearly(yearly);
  }, []);

  // Open proration preview modal
  const handleCTA = useCallback(
    (plan: PlanData) => {
      if (plan.monthlyPrice === 0 || plan.slug === currentPlanSlug) return;
      setUpgradeTarget({ slug: plan.slug, name: plan.name });
    },
    [currentPlanSlug],
  );

  const user = useAuthStore((s) => s.user);
  const verifyMutation = useVerifyPayment();

  // Handle checkout after proration preview
  const handleCheckout = useCallback(
    async (planSlug: string, billingCycle: 'MONTHLY' | 'YEARLY') => {
      const targetName = upgradeTarget?.name || planSlug;
      setUpgradeTarget(null);

      try {
        // Step 1: Create checkout order on backend
        const session = await createCheckoutMutation.mutateAsync({
          planSlug,
          billingCycle,
        });

        // Step 2: Open Razorpay native checkout
        const paymentResult = await openRazorpayCheckout(session, {
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
        });

        // Step 3: Verify payment on backend
        await verifyMutation.mutateAsync(paymentResult);

        // Step 4: Navigate to success screen
        navigation.navigate('PaymentSuccess', {
          planName: targetName,
          amount: session.amount,
          billingCycle,
          paymentId: paymentResult.razorpayPaymentId,
          orderId: paymentResult.razorpayOrderId,
        });
      } catch (err: any) {
        // User cancelled — no error toast needed
        if (isRazorpayCancellation(err)) {
          return;
        }

        Toast.show({
          type: 'error',
          text1: 'Payment failed',
          text2: err?.message || err?.description || 'Please try again',
        });
      }
    },
    [createCheckoutMutation, verifyMutation, navigation, user, upgradeTarget],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
  }).current;

  const renderPlanCard = useCallback(
    ({ item, index }: ListRenderItemInfo<PlanData>) => (
      <PlanCard
        plan={item}
        isYearly={isYearly}
        index={index}
        onPressCTA={handleCTA}
      />
    ),
    [isYearly, handleCTA],
  );

  const keyExtractor = useCallback((item: PlanData) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<PlanData> | null | undefined, idx: number) => ({
      length: SNAP_INTERVAL,
      offset: SNAP_INTERVAL * idx,
      index: idx,
    }),
    [],
  );

  const paginationDots = useMemo(
    () =>
      planCards.map((plan, idx) => (
        <TouchableOpacity
          key={plan.id}
          onPress={() =>
            flatListRef.current?.scrollToIndex({ index: idx, animated: true })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View
            style={[
              mainStyles.dot,
              idx === activeIndex && {
                backgroundColor: PRIMARY,
                width: 24,
              },
            ]}
          />
        </TouchableOpacity>
      )),
    [activeIndex, planCards],
  );

  // Find popular plan index for initial scroll
  const popularIndex = useMemo(
    () => Math.max(planCards.findIndex(p => p.popular), 0),
    [planCards],
  );

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* Header */}
      <View style={mainStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={mainStyles.backButton}>
          <FeatherIcon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={mainStyles.headerTitle}>Choose Your Plan</Text>
        <View style={mainStyles.headerSpacer} />
      </View>

      {plansLoading ? (
        <View style={mainStyles.loadingWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Monthly / Yearly toggle */}
          <View style={mainStyles.toggleOuter}>
            <View style={mainStyles.toggleContainer}>
              {/* Animated sliding knob */}
              <Animated.View
                style={[mainStyles.toggleKnob, toggleKnobStyle]}
              />

              {/* Monthly option */}
              <TouchableOpacity
                style={mainStyles.toggleOption}
                onPress={() => handleToggle(false)}
                activeOpacity={0.8}>
                <Animated.Text
                  style={[mainStyles.toggleLabel, monthlyTextStyle]}>
                  Monthly
                </Animated.Text>
              </TouchableOpacity>

              {/* Yearly option */}
              <TouchableOpacity
                style={mainStyles.toggleOption}
                onPress={() => handleToggle(true)}
                activeOpacity={0.8}>
                <Animated.Text
                  style={[mainStyles.toggleLabel, yearlyTextStyle]}>
                  Yearly
                </Animated.Text>
                <Animated.View style={[mainStyles.savePill, saveBadgeStyle]}>
                  <Text style={mainStyles.savePillText}>Save 17%</Text>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* GST note */}
          <Text style={mainStyles.gstNote}>
            All prices exclusive of 18% GST
          </Text>

          {/* Horizontal plan cards carousel */}
          {planCards.length > 0 && (
            <FlatList
              ref={flatListRef}
              data={planCards}
              renderItem={renderPlanCard}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled={false}
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: CARD_MARGIN_H - 8,
              }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              initialScrollIndex={popularIndex}
              nestedScrollEnabled
            />
          )}

          {/* Pagination dots */}
          <View style={mainStyles.dotContainer}>{paginationDots}</View>

          {/* Feature comparison table */}
          {apiPlans && <ComparisonTable plans={apiPlans} />}

          {/* Money-back guarantee */}
          <GuaranteeBanner />
        </ScrollView>
      )}

      {/* Proration preview modal */}
      {upgradeTarget && (
        <ProrationModal
          visible={!!upgradeTarget}
          targetPlanSlug={upgradeTarget.slug}
          targetPlanName={upgradeTarget.name}
          billingCycle={isYearly ? 'YEARLY' : 'MONTHLY'}
          onClose={() => setUpgradeTarget(null)}
          onCheckout={handleCheckout}
        />
      )}
    </View>
  );
}

export default React.memo(PlansScreen);

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const mainStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  toggleOuter: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    position: 'relative',
  },
  toggleKnob: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    height: 44,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    zIndex: 0,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 6,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },
  savePill: {
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savePillText: {
    fontSize: 10,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: '#0A3D2E',
    letterSpacing: 0.3,
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  gstNote: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: -8,
  },
});
