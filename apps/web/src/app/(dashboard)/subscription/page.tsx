'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  AlertTriangle,
  Crown,
  Eye,
  Brain,
  Bell,
  Bookmark,
  ArrowUpRight,
  Sparkles,
  Zap,
  Star,
  Shield,
  Users,
  FileText,
  Calendar,
  Globe,
  MessageCircle,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useSubscriptionStore,
  type SubscriptionPlan,
  type Subscription,
  type UsageStat,
  type Invoice,
} from '@/stores/subscription-store';
import api from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { UpgradeModal } from '@/components/subscription';

/* ------------------------------------------------------------------ */
/* Helper constants                                                   */
/* ------------------------------------------------------------------ */

const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise'];

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  starter: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400',
  professional: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400',
  enterprise: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-500/20 dark:text-secondary-300',
};

const PLAN_ICONS: Record<string, typeof Star> = {
  free: Zap,
  starter: Star,
  professional: Sparkles,
  enterprise: Crown,
};

const USAGE_ICONS: Record<string, typeof Eye> = {
  maxAiChecks: Brain,
  maxAlerts: Bell,
  maxSavedTenders: Bookmark,
  maxComparisonTenders: BarChart3,
};

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400',
  PAST_DUE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  EXPIRED: 'bg-muted text-muted-foreground',
};

const INVOICE_STATUS_BADGES: Record<string, string> = {
  SUCCESS: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  REFUNDED: 'bg-muted text-muted-foreground',
};

const CANCEL_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Missing features I need',
  'Found a better alternative',
  'Business closed / no longer needed',
  'Other',
];

/* ------------------------------------------------------------------ */
/* Build compact feature list from plan object                        */
/* ------------------------------------------------------------------ */

function getCompactFeatures(plan: SubscriptionPlan): { label: string; included: boolean }[] {
  const features: { label: string; included: boolean }[] = [];

  // Tender views
  if (plan.paginationAllowed) {
    features.push({ label: 'Unlimited tender views', included: true });
  } else {
    features.push({ label: `${plan.tenderViewsPerPage} tenders/page`, included: true });
  }

  // Saved tenders
  if (plan.maxSavedTenders === -1) {
    features.push({ label: 'Unlimited saved tenders', included: true });
  } else if (plan.maxSavedTenders > 0) {
    features.push({ label: `${plan.maxSavedTenders} saved tenders`, included: true });
  } else {
    features.push({ label: 'Save tenders', included: false });
  }

  // Alerts
  if (plan.maxAlerts === -1) {
    features.push({ label: 'Unlimited alerts', included: true });
  } else if (plan.maxAlerts > 0) {
    features.push({ label: `${plan.maxAlerts} tender alerts`, included: true });
  } else {
    features.push({ label: 'Tender alerts', included: false });
  }

  // AI checks
  if (plan.maxAiChecks === -1) {
    features.push({ label: 'Unlimited AI checks', included: true });
  } else if (plan.maxAiChecks > 0) {
    const suffix = plan.aiChecksResetMonthly ? '/mo' : ' total';
    features.push({ label: `${plan.maxAiChecks} AI check${plan.maxAiChecks > 1 ? 's' : ''}${suffix}`, included: true });
  } else {
    features.push({ label: 'AI eligibility checks', included: false });
  }

  // Document download
  features.push({ label: 'Document download', included: plan.documentDownload });

  // WhatsApp alerts
  features.push({ label: 'WhatsApp alerts', included: plan.whatsappAlerts });

  // Calendar
  features.push({ label: 'Tender calendar', included: plan.tenderCalendar });

  // Export
  features.push({ label: 'Export CSV/PDF', included: plan.exportEnabled });

  // Comparison
  features.push({ label: 'Tender comparison', included: plan.tenderComparison });

  // Bid assistant
  if (plan.aiBidAssistant === 'advanced') {
    features.push({ label: 'Advanced bid assistant', included: true });
  } else if (plan.aiBidAssistant === 'basic') {
    features.push({ label: 'Basic bid assistant', included: true });
  } else {
    features.push({ label: 'AI bid assistant', included: false });
  }

  // Team
  if (plan.maxTeamMembers > 1) {
    features.push({ label: `${plan.maxTeamMembers} team members`, included: true });
  }

  // Competitor analysis
  if (plan.competitorAnalysis) {
    features.push({ label: 'Competitor analysis', included: true });
  }

  // Dedicated manager
  if (plan.dedicatedManager) {
    features.push({ label: 'Dedicated manager', included: true });
  }

  return features;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function AnimatedProgress({ percentage, barColor }: { percentage: number; barColor: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setWidth(percentage), 100);
    return () => clearTimeout(timeout);
  }, [percentage]);

  return (
    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-1000 ease-out',
          barColor
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function UsageMeter({ item }: { item: UsageStat }) {
  const isUnlimited = item.limit === -1;
  const percentage = isUnlimited
    ? 0
    : item.limit === 0
      ? 100
      : Math.min((item.used / item.limit) * 100, 100);

  const barColor =
    percentage > 90
      ? 'bg-red-500'
      : percentage > 70
        ? 'bg-amber-500'
        : 'bg-accent-500';

  const Icon = USAGE_ICONS[item.feature] || Eye;

  const resetLabels: Record<string, string> = {
    monthly: 'Resets monthly',
    lifetime: 'Lifetime limit',
    cumulative: 'Cumulative',
    per_request: 'Per session',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-foreground truncate">{item.label}</p>
          <p className="text-caption text-muted-foreground">{resetLabels[item.resetType] || item.resetType}</p>
        </div>
        <div className="text-right">
          <p className="text-heading-sm font-mono text-foreground">
            {isUnlimited ? (
              <span className="text-accent-500">&#8734;</span>
            ) : (
              <>
                <span className={cn(percentage > 90 ? 'text-red-500' : percentage > 70 ? 'text-amber-500' : 'text-foreground')}>
                  {item.used}
                </span>
                <span className="text-muted-foreground text-body-sm">/{item.limit}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <AnimatedProgress percentage={isUnlimited ? 0 : percentage} barColor={barColor} />

      <p className="text-caption text-muted-foreground mt-2">
        {isUnlimited ? (
          <span className="text-accent-500 font-medium">{item.used} used &mdash; Unlimited</span>
        ) : (
          <span className={cn(
            'font-medium',
            percentage > 90 ? 'text-red-500' : percentage > 70 ? 'text-amber-500' : 'text-accent-500'
          )}>
            {Math.round(100 - percentage)}% remaining
          </span>
        )}
      </p>
    </div>
  );
}

function CancelModal({
  onClose,
  onConfirm,
  isLoading,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-heading-sm font-display text-foreground">Cancel Subscription</h3>
        </div>

        <p className="text-body-sm text-muted-foreground mb-4">
          Are you sure you want to cancel? You will continue to have access to your current
          plan features until the end of your billing cycle.
        </p>

        <div className="mb-6">
          <label className="block text-body-sm font-medium text-foreground mb-2">
            Help us improve &mdash; why are you cancelling?
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a reason...</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-body-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Keep Plan
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isLoading || !reason}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-body-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function SubscriptionPage() {
  const { user } = useAuthStore();

  // Subscription store
  const {
    plans,
    currentPlan,
    subscription,
    isFreePlan,
    usage,
    invoices,
    invoiceTotal,
    isLoading: storeLoading,
    error: storeError,
    fetchAll,
    fetchInvoices: storeFetchInvoices,
  } = useSubscriptionStore();

  // UI states
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [invoicePage, setInvoicePage] = useState(1);
  const invoicesPerPage = 10;

  // Upgrade modal state
  const [upgradeTarget, setUpgradeTarget] = useState<{
    slug: string;
    name: string;
    cycle: 'MONTHLY' | 'YEARLY';
  } | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync billing cycle from subscription
  useEffect(() => {
    if (subscription?.billingCycle) {
      setBillingCycle(subscription.billingCycle);
    }
  }, [subscription]);

  // Handle plan selection — open UpgradeModal for proration preview
  const handlePlanSelect = (planSlug: string, planName: string) => {
    setUpgradeTarget({ slug: planSlug, name: planName, cycle: billingCycle });
  };

  // Handle checkout after proration preview
  const handleCheckout = async (planSlug: string, cycle: 'MONTHLY' | 'YEARLY') => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    setUpgradeTarget(null);
    setIsCheckoutLoading(planSlug);
    try {
      const res = await api.post('/subscription/checkout', {
        planSlug,
        billingCycle: cycle,
      });

      const { orderId, amount, currency, keyId } = res.data.data;

      await openRazorpayCheckout({
        orderId,
        amount,
        currency,
        keyId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        onSuccess: async (response) => {
          try {
            await api.post('/subscription/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Subscription activated successfully!');
            fetchAll();
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        onError: (error) => {
          toast.error(error?.error?.description || 'Payment failed. Please try again.');
        },
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.error?.message || 'Failed to initiate checkout'
      );
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  // Handle cancel
  const handleCancel = async (reason: string) => {
    setIsCancelling(true);
    try {
      await api.post('/subscription/cancel', { reason });
      toast.success('Subscription cancelled. Access continues until end of billing period.');
      setIsCancelModalOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(
        err.response?.data?.error?.message || 'Failed to cancel subscription'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Determine current plan index for upgrade/downgrade logic
  const currentPlanIndex = currentPlan
    ? PLAN_ORDER.indexOf(currentPlan.slug)
    : 0;

  // Format price — handles ₹0 for free plan
  const displayPrice = (amount: number): string => {
    if (amount <= 0) return 'Free';
    return formatCurrency(amount);
  };

  // Format status for display
  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  };

  if (storeLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (storeError && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="p-3 rounded-full bg-red-100 dark:bg-red-500/20 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-body-sm text-foreground font-medium mb-1">{storeError}</p>
        <p className="text-caption text-muted-foreground mb-4">Check your connection and try again.</p>
        <button
          onClick={() => fetchAll()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-heading-lg font-display text-foreground">Subscription</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Manage your plan, usage, and billing
        </p>
      </div>

      {/* ── Current Plan Card ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary-500/10">
                <Crown className="h-5 w-5 text-primary-500" />
              </div>
              <h2 className="text-heading-sm font-display text-foreground">Current Plan</h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold',
                  PLAN_COLORS[currentPlan?.slug || 'free']
                )}
              >
                {currentPlan?.name || 'Free'}
              </span>
              {subscription && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium',
                    STATUS_BADGES[subscription.status] || STATUS_BADGES.ACTIVE
                  )}
                >
                  {formatStatus(subscription.status)}
                </span>
              )}
            </div>

            {currentPlan && !isFreePlan && subscription && (
              <div className="space-y-1.5 ml-[52px]">
                <p className="text-muted-foreground">
                  <span className="text-display-sm font-mono font-bold text-foreground tracking-tight">
                    {formatCurrency(
                      subscription.billingCycle === 'YEARLY'
                        ? currentPlan.yearlyPrice
                        : currentPlan.monthlyPrice
                    )}
                  </span>
                  <span className="text-body-sm text-muted-foreground ml-1">
                    / {subscription.billingCycle === 'YEARLY' ? 'year' : 'month'}
                  </span>
                  <span className="text-caption text-muted-foreground ml-2">+ 18% GST</span>
                </p>
                <p className="text-caption text-muted-foreground">
                  {subscription.status === 'CANCELLED' ? 'Access until' : 'Renews on'}{' '}
                  <span className="text-foreground font-medium">{formatDate(subscription.endDate)}</span>
                </p>
                {subscription.billingCycle === 'YEARLY' && (
                  <p className="text-caption text-muted-foreground">
                    <span className="font-mono">{formatCurrency(Math.round(currentPlan.yearlyPrice / 12))}</span>/mo billed annually
                  </p>
                )}
              </div>
            )}

            {isFreePlan && (
              <p className="text-body-sm text-muted-foreground ml-[52px]">
                You are on the free plan. Upgrade for more features.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 lg:flex-col lg:items-end">
            {subscription &&
              !isFreePlan &&
              subscription.status === 'ACTIVE' && (
                <div className="flex items-center gap-2 text-body-sm">
                  <span className="text-muted-foreground">Auto-renew</span>
                  <button
                    onClick={async () => {
                      if (subscription.autoRenew) {
                        try {
                          await api.post('/subscription/cancel', {
                            reason: 'Toggle auto-renew off',
                          });
                          toast.success('Auto-renew disabled');
                          fetchAll();
                        } catch {
                          toast.error('Failed to update auto-renew');
                        }
                      }
                    }}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                      subscription.autoRenew
                        ? 'bg-accent-500'
                        : 'bg-muted-foreground/30'
                    )}
                    role="switch"
                    aria-checked={subscription.autoRenew}
                  >
                    <span
                      className={cn(
                        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out',
                        subscription.autoRenew
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              )}

            <a
              href="#upgrade"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-5 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
            >
              Change Plan
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Usage Meters ───────────────────────────────────────────── */}
      {usage.length > 0 && (
        <div>
          <h2 className="text-heading-sm font-display text-foreground mb-4">Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {usage.map((item) => (
              <UsageMeter key={item.feature} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── Upgrade Section with Plan Cards ────────────────────────── */}
      <div id="upgrade" className="scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-heading-sm font-display text-foreground">
              {isFreePlan ? 'Choose a plan' : 'Compare plans'}
            </h2>
            <p className="text-body-sm text-muted-foreground mt-1">
              Get more out of TenderBazaar with the right plan
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={cn(
                'rounded-md px-4 py-2 text-body-sm font-medium transition-all duration-200',
                billingCycle === 'MONTHLY'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('YEARLY')}
              className={cn(
                'rounded-md px-4 py-2 text-body-sm font-medium transition-all duration-200 flex items-center gap-2',
                billingCycle === 'YEARLY'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Yearly
              <span className="text-[10px] rounded-full px-2 py-0.5 bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400 font-semibold">
                Save ~17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const planIndex = PLAN_ORDER.indexOf(plan.slug);
            const isCurrent = plan.slug === currentPlan?.slug;
            const isDowngrade = planIndex < currentPlanIndex;
            const isUpgrade = planIndex > currentPlanIndex;
            const isPopular = plan.isPopular;
            const price =
              billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
            const PlanIcon = PLAN_ICONS[plan.slug] || Star;
            const features = getCompactFeatures(plan);

            return (
              <div
                key={plan.id}
                className={cn(
                  'bg-card border rounded-xl p-6 flex flex-col relative transition-all duration-200 hover:shadow-md',
                  isCurrent
                    ? 'ring-2 ring-primary-500 border-primary-500/50'
                    : isPopular
                      ? 'ring-2 ring-accent-500 border-accent-500/50'
                      : 'border-border hover:border-border/80'
                )}
              >
                {/* Popular badge */}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-accent-500 text-white px-3 py-1 rounded-full shadow-lg shadow-accent-500/25">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary-500 text-white px-3 py-1 rounded-full shadow-lg shadow-primary-500/25">
                      <Check className="h-3 w-3" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Plan icon and name */}
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    plan.slug === 'free' ? 'bg-muted' :
                    plan.slug === 'starter' ? 'bg-primary-500/10' :
                    plan.slug === 'professional' ? 'bg-accent-500/10' :
                    'bg-secondary-500/10'
                  )}>
                    <PlanIcon className={cn(
                      'h-5 w-5',
                      plan.slug === 'free' ? 'text-muted-foreground' :
                      plan.slug === 'starter' ? 'text-primary-500' :
                      plan.slug === 'professional' ? 'text-accent-500' :
                      'text-secondary-300'
                    )} />
                  </div>
                  <h3 className="text-heading-sm font-display text-foreground">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {plan.slug === 'free' ? (
                    <div>
                      <span className="text-display-sm font-mono font-bold text-foreground tracking-tight">Free</span>
                      <span className="text-body-sm text-muted-foreground ml-1">forever</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-display-sm font-mono font-bold text-foreground tracking-tight">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-body-sm text-muted-foreground ml-1">
                        /{billingCycle === 'YEARLY' ? 'yr' : 'mo'}
                      </span>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        + 18% GST
                        {billingCycle === 'YEARLY' && (
                          <> &middot; <span className="font-mono">{formatCurrency(Math.round(price / 12))}</span>/mo</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Feature list */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-accent-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        'text-body-sm',
                        feature.included ? 'text-foreground' : 'text-muted-foreground/60'
                      )}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Action button */}
                <button
                  onClick={() => {
                    if (plan.slug === 'free' || isCurrent) return;
                    handlePlanSelect(plan.slug, plan.name);
                  }}
                  disabled={isCurrent || plan.slug === 'free' || isCheckoutLoading === plan.slug}
                  className={cn(
                    'w-full rounded-lg px-4 py-2.5 text-body-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
                    isCurrent
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : plan.slug === 'free'
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : isDowngrade
                          ? 'border border-border text-muted-foreground hover:bg-muted cursor-pointer'
                          : isPopular
                            ? 'bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-500/25'
                            : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/25'
                  )}
                >
                  {isCheckoutLoading === plan.slug && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isCurrent
                    ? 'Current Plan'
                    : plan.slug === 'free'
                      ? 'Free Plan'
                      : isDowngrade
                        ? 'Downgrade'
                        : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>

        {/* GST note */}
        <p className="text-caption text-muted-foreground text-center mt-4">
          All prices are exclusive of 18% GST. Final amount will be calculated at checkout.
        </p>
      </div>

      {/* ── Payment History ────────────────────────────────────────── */}
      <div>
        <h2 className="text-heading-sm font-display text-foreground mb-4">Payment History</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-full bg-muted mb-3">
                <CreditCard className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-body-sm text-muted-foreground">No payments yet</p>
              <p className="text-caption text-muted-foreground mt-1">Your payment history will appear here</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Invoice
                      </th>
                      <th className="text-left py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Date
                      </th>
                      <th className="text-left py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Plan
                      </th>
                      <th className="text-right py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Base
                      </th>
                      <th className="text-right py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        GST
                      </th>
                      <th className="text-right py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Total
                      </th>
                      <th className="text-center py-3.5 px-5 text-overline font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice, idx) => (
                      <tr
                        key={invoice.id}
                        className={cn(
                          'border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors',
                          idx % 2 === 0 ? '' : 'bg-muted/10'
                        )}
                      >
                        <td className="py-3.5 px-5 text-foreground font-mono text-caption font-medium">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-5 text-foreground font-mono text-caption">
                          {formatDate(invoice.paidAt)}
                        </td>
                        <td className="py-3.5 px-5 text-foreground">
                          <div>
                            <span className="font-medium">{invoice.planName}</span>
                            <span className="text-caption text-muted-foreground ml-1.5">
                              ({invoice.billingCycle?.toLowerCase()})
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right text-foreground font-mono text-caption">
                          {invoice.baseAmount != null && invoice.baseAmount > 0
                            ? formatCurrency(invoice.baseAmount)
                            : '--'}
                        </td>
                        <td className="py-3.5 px-5 text-right text-muted-foreground font-mono text-caption">
                          {invoice.gstAmount != null && invoice.gstAmount > 0
                            ? formatCurrency(invoice.gstAmount)
                            : '--'}
                        </td>
                        <td className="py-3.5 px-5 text-right text-foreground font-mono font-medium">
                          {invoice.totalAmount > 0 ? formatCurrency(invoice.totalAmount) : 'Free'}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
                              INVOICE_STATUS_BADGES[invoice.status] ||
                                INVOICE_STATUS_BADGES.PENDING
                            )}
                          >
                            {invoice.status === 'SUCCESS' ? 'Paid' : invoice.status.toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {invoiceTotal > invoicesPerPage && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-caption text-muted-foreground">
                    Showing {(invoicePage - 1) * invoicesPerPage + 1} to{' '}
                    {Math.min(invoicePage * invoicesPerPage, invoiceTotal)} of{' '}
                    {invoiceTotal}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const newPage = invoicePage - 1;
                        setInvoicePage(newPage);
                        storeFetchInvoices(newPage, invoicesPerPage);
                      }}
                      disabled={invoicePage <= 1}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-caption text-muted-foreground px-2 font-mono">
                      {invoicePage} / {Math.ceil(invoiceTotal / invoicesPerPage)}
                    </span>
                    <button
                      onClick={() => {
                        const newPage = invoicePage + 1;
                        setInvoicePage(newPage);
                        storeFetchInvoices(newPage, invoicesPerPage);
                      }}
                      disabled={
                        invoicePage >= Math.ceil(invoiceTotal / invoicesPerPage)
                      }
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Cancel Subscription ────────────────────────────────────── */}
      {subscription &&
        !isFreePlan &&
        subscription.status !== 'CANCELLED' &&
        subscription.status !== 'EXPIRED' && (
          <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/10 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-heading-sm font-display text-foreground">
                    Cancel Subscription
                  </h2>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Cancel your subscription. You will retain access to all features until{' '}
                    <span className="font-medium text-foreground">{formatDate(subscription.endDate)}</span>.
                    After that, your account will be downgraded to the Free plan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border-2 border-red-300 dark:border-red-800 px-5 py-2.5 text-body-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        )}

      {/* Cancel modal */}
      {isCancelModalOpen && (
        <CancelModal
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          isLoading={isCancelling}
        />
      )}

      {/* Upgrade modal with proration preview */}
      {upgradeTarget && (
        <UpgradeModal
          targetPlanSlug={upgradeTarget.slug}
          targetPlanName={upgradeTarget.name}
          billingCycle={upgradeTarget.cycle}
          onClose={() => setUpgradeTarget(null)}
          onCheckout={handleCheckout}
        />
      )}
    </div>
  );
}
