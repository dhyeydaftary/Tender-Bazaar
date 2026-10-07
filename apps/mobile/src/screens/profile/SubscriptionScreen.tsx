import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
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
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { useHaptic } from '../../hooks/useHaptic';
import {
  useCurrentSubscription,
  useUsageStats,
  useInvoices,
  useCancelSubscription,
} from '../../hooks/useSubscription';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import type { UsageStat, Invoice } from '../../services/api/subscription';

// ─── Colors ────────────────────────────────────────────────────────────────

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const DANGER = '#EF4444';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';
const INFO = '#3B82F6';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount <= 0) return 'Free';
  if (amount >= 10000000) return `\u20B9${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `\u20B9${(amount / 100000).toFixed(2)} L`;
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const USAGE_ICON_MAP: Record<string, { icon: string; color: string }> = {
  maxSavedTenders: { icon: 'bookmark-outline', color: PRIMARY },
  maxAlerts: { icon: 'bell-outline', color: INFO },
  maxAiChecks: { icon: 'brain', color: ACCENT },
  maxComparisonTenders: { icon: 'compare', color: WARNING },
  maxTeamMembers: { icon: 'account-group-outline', color: SECONDARY },
};

const SUBSCRIPTION_STATUS: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  ACTIVE: { label: 'Active', color: SUCCESS, bg: SUCCESS + '14', icon: 'check-circle' },
  CANCELLED: { label: 'Cancelled', color: DANGER, bg: DANGER + '14', icon: 'close-circle' },
  EXPIRED: { label: 'Expired', color: TEXT_TERTIARY, bg: TEXT_TERTIARY + '14', icon: 'clock-outline' },
  PAST_DUE: { label: 'Past Due', color: WARNING, bg: WARNING + '14', icon: 'alert-circle' },
};

const INVOICE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: 'Paid', color: SUCCESS, bg: SUCCESS + '14' },
  PENDING: { label: 'Pending', color: WARNING, bg: WARNING + '14' },
  FAILED: { label: 'Failed', color: DANGER, bg: DANGER + '14' },
  REFUNDED: { label: 'Refunded', color: INFO, bg: INFO + '14' },
};

const PLAN_ICON: Record<string, string> = {
  free: 'gift-outline',
  starter: 'rocket-launch-outline',
  professional: 'briefcase-outline',
  enterprise: 'office-building',
};

// ─── Animated Usage Meter ──────────────────────────────────────────────────

interface UsageMeterCardProps {
  meter: UsageStat;
  index: number;
}

const UsageMeterCard = React.memo<UsageMeterCardProps>(({ meter, index }) => {
  const isUnlimited = meter.limit === -1;
  const percentage = isUnlimited ? 0 : meter.limit > 0 ? (meter.used / meter.limit) * 100 : 0;
  const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;
  const isDanger = !isUnlimited && percentage >= 100;

  const config = USAGE_ICON_MAP[meter.feature] || { icon: 'chart-bar', color: PRIMARY };
  const displayColor = isDanger ? DANGER : isWarning ? WARNING : config.color;

  const barWidth = useSharedValue(0);

  useEffect(() => {
    const targetWidth = isUnlimited ? 100 : Math.min(percentage, 100);
    barWidth.value = withDelay(
      200 + index * 150,
      withTiming(targetWidth, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [barWidth, percentage, index, isUnlimited]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
    backgroundColor: isUnlimited ? ACCENT : displayColor,
  }));

  const resetLabel =
    meter.resetType === 'monthly'
      ? 'this month'
      : meter.resetType === 'lifetime'
        ? 'lifetime'
        : meter.resetType === 'cumulative'
          ? 'total'
          : '';

  return (
    <View style={styles.meterCard}>
      <View style={styles.meterHeader}>
        <View style={styles.meterLabelRow}>
          <View
            style={[styles.meterIconCircle, { backgroundColor: config.color + '14' }]}
          >
            <Icon name={config.icon} size={18} color={config.color} />
          </View>
          <Text style={styles.meterLabel}>{meter.label}</Text>
        </View>
        <Text style={styles.meterCount}>
          {isUnlimited ? (
            <>
              <Text style={styles.meterUsed}>{meter.used}</Text>
              {' used \u2022 '}
              <Text style={{ color: ACCENT, fontFamily: fontFamilies.semiBold }}>
                Unlimited
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.meterUsed,
                  isDanger && { color: DANGER },
                  isWarning && { color: WARNING },
                ]}
              >
                {meter.used}
              </Text>
              {' of '}
              {meter.limit} {resetLabel}
            </>
          )}
        </Text>
      </View>
      <View style={styles.meterBarBg}>
        <Animated.View style={[styles.meterBarFill, barStyle]} />
      </View>
      {isDanger && (
        <View style={styles.meterWarningRow}>
          <Icon name="alert-circle" size={13} color={DANGER} />
          <Text style={styles.meterWarningText}>Limit reached</Text>
        </View>
      )}
      {isWarning && (
        <View style={styles.meterWarningRow}>
          <Icon name="alert-outline" size={13} color={WARNING} />
          <Text style={[styles.meterWarningText, { color: WARNING }]}>
            Almost at limit
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── Invoice Item Component ──────────────────────────────────────────────

interface InvoiceItemCardProps {
  item: Invoice;
}

const InvoiceItemCard = React.memo<InvoiceItemCardProps>(({ item }) => {
  const statusKey = item.status.toUpperCase();
  const statusConfig = INVOICE_STATUS[statusKey] || INVOICE_STATUS.PAID;

  return (
    <View style={styles.billingItem}>
      <View style={styles.billingIconCircle}>
        <Icon name="receipt" size={18} color={TEXT_SECONDARY} />
      </View>
      <View style={styles.billingInfo}>
        <Text style={styles.billingDescription}>
          {item.planName} - {item.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
        </Text>
        <Text style={styles.billingDate}>
          {item.paidAt ? formatDate(item.paidAt) : '\u2014'}
        </Text>
      </View>
      <View style={styles.billingRight}>
        <Text style={styles.billingAmount}>
          {formatCurrency(item.totalAmount)}
        </Text>
        <View
          style={[styles.billingStatusPill, { backgroundColor: statusConfig.bg }]}
        >
          <Text
            style={[styles.billingStatusText, { color: statusConfig.color }]}
          >
            {statusConfig.label}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const haptic = useHaptic();

  // ── API Data ───────────────────────────────────────────────────────────
  const {
    data: subData,
    isLoading: subLoading,
    refetch: refetchSub,
  } = useCurrentSubscription();
  const {
    data: usageData,
    isLoading: usageLoading,
    refetch: refetchUsage,
  } = useUsageStats();
  const {
    data: invoices,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useInvoices();
  const cancelMutation = useCancelSubscription();

  const setSubscriptionData = useSubscriptionStore((s) => s.setSubscriptionData);
  const setUsage = useSubscriptionStore((s) => s.setUsage);

  // Sync store when data arrives
  useEffect(() => {
    if (subData) {
      setSubscriptionData(subData);
    }
  }, [subData, setSubscriptionData]);

  useEffect(() => {
    if (usageData) {
      setUsage(usageData);
    }
  }, [usageData, setUsage]);

  const isLoading = subLoading && !subData;
  const isRefreshing = subLoading && !!subData;

  const plan = subData?.plan;
  const subscription = subData?.subscription;
  const isFreePlan = subData?.isFreePlan ?? true;

  const currentPrice = useMemo(() => {
    if (!plan) return 0;
    if (isFreePlan) return 0;
    if (!subscription) return plan.monthlyPrice;
    return subscription.billingCycle === 'YEARLY'
      ? plan.yearlyPrice
      : plan.monthlyPrice;
  }, [plan, subscription, isFreePlan]);

  const billingLabel = useMemo(() => {
    if (isFreePlan || !subscription) return '';
    return subscription.billingCycle === 'YEARLY' ? '/year' : '/month';
  }, [isFreePlan, subscription]);

  const subStatus = subscription
    ? SUBSCRIPTION_STATUS[subscription.status] || SUBSCRIPTION_STATUS.ACTIVE
    : null;

  // Only show first 5 invoices in this view
  const recentInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.slice(0, 5);
  }, [invoices]);

  // Filter meaningful usage meters (skip zero-limit items for free plan display)
  const usageMeters = useMemo(() => {
    if (!usageData) return [];
    return usageData.filter((u) => u.limit !== 0);
  }, [usageData]);

  // Plan card entrance animation
  const planCardScale = useSharedValue(0.95);
  const planCardOpacity = useSharedValue(0);

  // Shimmer on plan card border
  const shimmer = useSharedValue(0);

  // Sparkle animation
  const sparkleRotation = useSharedValue(0);

  useEffect(() => {
    planCardScale.value = withSpring(1, { damping: 16, stiffness: 160 });
    planCardOpacity.value = withTiming(1, { duration: 400 });

    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );

    sparkleRotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [planCardScale, planCardOpacity, shimmer, sparkleRotation]);

  const planCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: planCardScale.value }],
    opacity: planCardOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      shimmer.value,
      [0, 0.5, 1],
      [PRIMARY, ACCENT, PRIMARY],
    );
    return { borderColor };
  });

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sparkleRotation.value}deg` }],
  }));

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetchSub();
    refetchUsage();
    refetchInvoices();
  }, [refetchSub, refetchUsage, refetchInvoices]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleChangePlan = useCallback(() => {
    haptic('light');
    navigation.navigate('Plans');
  }, [haptic, navigation]);

  const handleCancelSubscription = useCallback(() => {
    if (isFreePlan || !subscription) return;

    haptic('warning');
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: () => {
            haptic('medium');
            cancelMutation.mutate(
              { reason: 'User requested cancellation' },
              {
                onSuccess: () => {
                  Toast.show({
                    type: 'success',
                    text1: 'Subscription Cancelled',
                    text2: 'Your plan will remain active until the end of the billing period.',
                  });
                  refetchSub();
                },
                onError: (err) => {
                  Toast.show({
                    type: 'error',
                    text1: 'Cancel Failed',
                    text2: (err as Error).message || 'Something went wrong',
                  });
                },
              },
            );
          },
        },
      ],
    );
  }, [haptic, isFreePlan, subscription, cancelMutation, refetchSub]);

  // ── Loading State ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <FeatherIcon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Subscription</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading subscription...</Text>
        </View>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const planSlug = plan?.slug || 'free';
  const planIcon = PLAN_ICON[planSlug] || PLAN_ICON.free;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />

      {/* Header with gradient background */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <FeatherIcon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscription</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Current Plan Hero Card */}
        <Animated.View style={[styles.planCard, shimmerStyle, planCardStyle]}>
          <View style={styles.planHeader}>
            <View style={styles.planIconCircle}>
              <Icon name={planIcon} size={28} color={PRIMARY} />
            </View>
            <View style={styles.planTitleGroup}>
              <Text style={styles.planName}>{plan?.name || 'Free'} Plan</Text>
              <View style={styles.planBadgeRow}>
                {/* Status badge */}
                {subscription && subStatus ? (
                  <View style={[styles.planBadge, { backgroundColor: subStatus.bg }]}>
                    <Icon name={subStatus.icon} size={12} color={subStatus.color} />
                    <Text style={[styles.planBadgeText, { color: subStatus.color }]}>
                      {subStatus.label}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>CURRENT</Text>
                  </View>
                )}
                {/* Billing cycle badge */}
                {subscription && (
                  <View style={[styles.planBadge, { backgroundColor: INFO + '14' }]}>
                    <Text style={[styles.planBadgeText, { color: INFO }]}>
                      {subscription.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>
              <Text style={styles.planCurrency}>{'\u20B9'}</Text>
              {currentPrice > 0
                ? currentPrice.toLocaleString('en-IN')
                : '0'}
            </Text>
            {billingLabel ? (
              <Text style={styles.planPeriod}>{billingLabel}</Text>
            ) : (
              <Text style={styles.planPeriod}>/month</Text>
            )}
          </View>

          {currentPrice > 0 && (
            <Text style={styles.gstNote}>+ 18% GST</Text>
          )}

          <View style={styles.planDivider} />

          {/* Validity / dates */}
          {isFreePlan ? (
            <View style={styles.planValidRow}>
              <Icon name="infinity" size={18} color={ACCENT} />
              <Text style={styles.planValidText}>Free forever</Text>
            </View>
          ) : subscription ? (
            <View style={styles.planDatesContainer}>
              <View style={styles.planDateRow}>
                <Icon name="calendar-start" size={16} color={TEXT_SECONDARY} />
                <Text style={styles.planDateLabel}>Started</Text>
                <Text style={styles.planDateValue}>
                  {formatDate(subscription.startDate)}
                </Text>
              </View>
              <View style={styles.planDateRow}>
                <Icon
                  name={
                    subscription.status === 'CANCELLED'
                      ? 'calendar-remove'
                      : 'calendar-end'
                  }
                  size={16}
                  color={
                    subscription.status === 'CANCELLED' ? DANGER : TEXT_SECONDARY
                  }
                />
                <Text style={styles.planDateLabel}>
                  {subscription.status === 'CANCELLED' ? 'Access until' : 'Renews on'}
                </Text>
                <Text
                  style={[
                    styles.planDateValue,
                    subscription.status === 'CANCELLED' && { color: DANGER },
                  ]}
                >
                  {formatDate(subscription.endDate)}
                </Text>
              </View>
              {subscription.autoRenew && subscription.status === 'ACTIVE' && (
                <View style={styles.autoRenewRow}>
                  <Icon name="autorenew" size={14} color={ACCENT} />
                  <Text style={styles.autoRenewText}>Auto-renewal enabled</Text>
                </View>
              )}
            </View>
          ) : null}
        </Animated.View>

        {/* Usage Meters */}
        {usageMeters.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Usage This Period</Text>
            </View>
            {usageLoading && !usageData ? (
              <View style={styles.meterCard}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : (
              usageMeters.map((meter, index) => (
                <UsageMeterCard key={meter.feature} meter={meter} index={index} />
              ))
            )}
          </>
        )}

        {/* Upgrade CTA — shown for free plan or lower-tier plans */}
        {isFreePlan && (
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeHeaderRow}>
              <Animated.View style={sparkleStyle}>
                <Icon name="star-four-points" size={28} color={PRIMARY} />
              </Animated.View>
              <Text style={styles.upgradeTitle}>Upgrade to unlock more</Text>
            </View>

            <View style={styles.upgradeFeatures}>
              {[
                { icon: 'eye', text: 'Unlimited tender views', color: PRIMARY },
                { icon: 'bell', text: 'Up to 25 custom alerts', color: INFO },
                { icon: 'cpu', text: '50 AI eligibility checks/month', color: ACCENT },
                { icon: 'download', text: 'Document downloads', color: SUCCESS },
              ].map((feature) => (
                <View key={feature.text} style={styles.upgradeFeatureRow}>
                  <View
                    style={[
                      styles.upgradeFeatureIcon,
                      { backgroundColor: feature.color + '14' },
                    ]}
                  >
                    <FeatherIcon
                      name={feature.icon}
                      size={14}
                      color={feature.color}
                    />
                  </View>
                  <Text style={styles.upgradeFeatureText}>{feature.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.viewPlansButton}
              onPress={handleChangePlan}
              activeOpacity={0.85}
            >
              <Text style={styles.viewPlansText}>View Plans</Text>
              <FeatherIcon name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Billing History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Billing History</Text>
          {invoices && invoices.length > 5 && (
            <TouchableOpacity
              onPress={() => {
                haptic('light');
                // Could navigate to a full billing screen if needed
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {invoicesLoading && !invoices ? (
          <View style={[styles.billingCard, { padding: 24, alignItems: 'center' as const }]}>
            <ActivityIndicator size="small" color={PRIMARY} />
          </View>
        ) : recentInvoices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="receipt" size={32} color={TEXT_TERTIARY} />
            <Text style={styles.emptyText}>No billing history yet</Text>
            {isFreePlan && (
              <Text style={styles.emptySubText}>
                Upgrade to a paid plan to see your invoices here
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.billingCard}>
            {recentInvoices.map((item, index) => (
              <React.Fragment key={item.id}>
                <InvoiceItemCard item={item} />
                {index < recentInvoices.length - 1 && (
                  <View style={styles.billingDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsCard}>
          <TouchableOpacity
            style={styles.quickActionRow}
            onPress={handleChangePlan}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: PRIMARY + '14' },
              ]}
            >
              <Icon name="swap-horizontal" size={20} color={PRIMARY} />
            </View>
            <Text style={styles.quickActionLabel}>
              {isFreePlan ? 'Upgrade Plan' : 'Change Plan'}
            </Text>
            <FeatherIcon name="chevron-right" size={18} color={TEXT_TERTIARY} />
          </TouchableOpacity>

          {!isFreePlan && (
            <>
              <View style={styles.quickActionDivider} />

              <TouchableOpacity
                style={styles.quickActionRow}
                onPress={handleCancelSubscription}
                activeOpacity={0.7}
                disabled={
                  cancelMutation.isPending ||
                  subscription?.status === 'CANCELLED'
                }
              >
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: DANGER + '14' },
                  ]}
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator size="small" color={DANGER} />
                  ) : (
                    <Icon name="close-circle-outline" size={20} color={DANGER} />
                  )}
                </View>
                <Text
                  style={[
                    styles.quickActionLabel,
                    { color: DANGER },
                    subscription?.status === 'CANCELLED' && { opacity: 0.5 },
                  ]}
                >
                  {subscription?.status === 'CANCELLED'
                    ? 'Subscription Cancelled'
                    : 'Cancel Subscription'}
                </Text>
                <FeatherIcon name="chevron-right" size={18} color={TEXT_TERTIARY} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    color: TEXT_SECONDARY,
  },

  // Header
  header: {
    backgroundColor: SECONDARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },

  scrollContent: {
    padding: 20,
  },

  // Plan Card
  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: PRIMARY,
    ...shadows.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  planIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: PRIMARY + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleGroup: {
    flex: 1,
  },
  planName: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  planBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY + '14',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: 1,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 40,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  planCurrency: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  planPeriod: {
    fontSize: 16,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginLeft: 4,
  },
  gstNote: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: TEXT_TERTIARY,
    marginBottom: 12,
  },
  planDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 16,
    marginTop: 12,
  },
  planValidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planValidText: {
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: ACCENT,
  },
  planDatesContainer: {
    gap: 10,
  },
  planDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planDateLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  planDateValue: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  autoRenewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  autoRenewText: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    color: ACCENT,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Usage Meters
  meterCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...shadows.sm,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterLabel: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  meterCount: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  meterUsed: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  meterBarBg: {
    height: 8,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterBarFill: {
    height: 8,
    borderRadius: 4,
  },
  meterWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  meterWarningText: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: DANGER,
  },

  // Upgrade Card
  upgradeCard: {
    backgroundColor: SECONDARY,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    ...shadows.lg,
  },
  upgradeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  upgradeTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upgradeFeatures: {
    gap: 14,
    marginBottom: 24,
  },
  upgradeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeFeatureText: {
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  viewPlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    height: 52,
    borderRadius: 14,
    gap: 8,
  },
  viewPlansText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Billing / Invoices
  billingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.sm,
  },
  billingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  billingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BORDER + '80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingInfo: {
    flex: 1,
  },
  billingDescription: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  billingDate: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: TEXT_SECONDARY,
  },
  billingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billingAmount: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  billingStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  billingStatusText: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },
  billingDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 68,
  },

  // Empty state
  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    ...shadows.sm,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: TEXT_TERTIARY,
    marginTop: 4,
    textAlign: 'center',
  },

  // Quick Actions
  quickActionsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.sm,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  quickActionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 68,
  },
});
