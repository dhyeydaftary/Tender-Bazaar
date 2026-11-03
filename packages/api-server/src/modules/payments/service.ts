import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env, validatePaymentsDemoMode, DEVELOPMENT_SHORTCUTS_ENABLED } from '../../config/env';
import { getRazorpayClient, isRazorpayConfigured } from '../../config/razorpay';
import { AppError } from '../../shared/middleware/error-handler';
import { planConfigService } from '../subscriptions/plan-config.service';
import { invalidateUnreadCount } from '../notifications/service';

// ─── Constants ──────────────────────────────────────────────────────────────

const GST_RATE = 0.18;

function calculatePriceWithGST(basePrice: number) {
  const gstAmount = Math.round(basePrice * GST_RATE * 100) / 100;
  return { baseAmount: basePrice, gstAmount, totalAmount: basePrice + gstAmount };
}

/**
 * Whether this server is running against placeholder / unconfigured Razorpay
 * credentials and should therefore mint and accept mock orders.
 *
 * SECURITY: this is derived ONLY from trusted server-side configuration and
 * must never consider request input.
 *
 * An earlier version of verifyPayment() also treated an order as mock when the
 * CALLER-SUPPLIED ids began with `order_mock_` / `pay_mock_`. Because
 * `razorpayPaymentId` is attacker-controlled and otherwise unvalidated, sending
 * `pay_mock_anything` alongside a genuine pending order id skipped HMAC
 * verification entirely and activated the subscription without payment.
 *
 * The placeholder strings below match the values shipped in `.env.example`
 * (`rzp_test_xxxxxxxxxxxx`, `your-razorpay-secret`) so that a developer who has
 * not configured Razorpay still gets a working mock checkout.
 */
function isRazorpayMockMode(): boolean {
  // Demo payments have their own confirmation path and never relax Razorpay
  // signature verification.
  if (isPaymentsDemoMode()) return false;

  // SECURITY: mock mode is a DEVELOPMENT convenience and must never engage in
  // production.
  //
  // verifyPayment() skips HMAC signature verification when this returns true.
  // RAZORPAY_KEY_ID defaults to '' and nothing rejected that in production, so
  // a production server with Razorpay unconfigured would have skipped
  // verification and activated subscriptions WITHOUT PAYMENT. Until now the
  // only thing preventing it was that the server crashed at boot on the empty
  // key (config/razorpay.ts) — an accident, not a control. Making the client
  // lazy removes that crash, so the guard has to be explicit:
  //
  //   anything but an EXPLICIT NODE_ENV=development + unconfigured
  //                              -> NOT mock mode. The real branch runs,
  //                                 getRazorpayClient() raises a controlled
  //                                 PAYMENTS_NOT_CONFIGURED error, and
  //                                 signature verification is never skipped.
  //   NODE_ENV=development + unconfigured -> mock mode, exactly as before.
  //
  // The check reads the raw NODE_ENV (DEVELOPMENT_SHORTCUTS_ENABLED), not the
  // schema value: the schema defaults an unset NODE_ENV to 'development', so a
  // server that forgot to set NODE_ENV used to fall into mock mode here.
  if (!DEVELOPMENT_SHORTCUTS_ENABLED) return false;

  return !isRazorpayConfigured();
}

/**
 * Simulated payments for the isolated client demo (PAYMENTS_DEMO_MODE).
 *
 * SECURITY: decided ONLY by server configuration, and re-validated here on top
 * of the startup check in config/env.ts (validatePaymentsDemoMode), so the
 * demo path stays closed even if that check were bypassed. Request input —
 * flags, order ids, signatures — never enables it.
 */
export function isPaymentsDemoMode(): boolean {
  return env.PAYMENTS_DEMO_MODE === 'true' && validatePaymentsDemoMode(env).length === 0;
}

/** Order ids minted for demo checkouts; never sent to Razorpay. */
export const DEMO_ORDER_PREFIX = 'order_demo_';

/** How a checkout is completed, as reported to the client. */
export type PaymentMode = 'razorpay' | 'demo' | 'dev-mock';

function resolvePaymentMode(): PaymentMode {
  if (isPaymentsDemoMode()) return 'demo';
  if (isRazorpayMockMode()) return 'dev-mock';
  return 'razorpay';
}

/**
 * Raised when Razorpay rejects or cannot be reached while creating an order.
 * There is deliberately no fallback: a locally minted order id would represent
 * a payment that never reached the gateway.
 */
function gatewayOrderError(err: any): AppError {
  console.error(
    'Razorpay order creation failed:',
    err?.error?.description || err?.message || 'unknown error',
  );
  return new AppError(
    'The payment gateway could not create an order. No payment was taken; please try again later.',
    502,
    'PAYMENT_ORDER_FAILED',
  );
}

/**
 * Payment states that Razorpay confirmation (verify or `payment.captured`) may
 * move to SUCCESS. FAILED is included because Razorpay lets a customer retry
 * within the same order after a declined attempt, which `payment.failed` has
 * already recorded as FAILED. SUCCESS is already processed, and REFUNDED must
 * never become successful again.
 */
const CONFIRMABLE_PAYMENT_STATUSES: Array<'PENDING' | 'FAILED'> = ['PENDING', 'FAILED'];

/**
 * Constant-time comparison of an expected hex HMAC with a caller-supplied
 * signature. Malformed or wrong-length input is a mismatch, never a throw.
 */
export function signaturesMatch(expectedHex: string, provided: unknown): boolean {
  if (typeof provided !== 'string') return false;
  const expected = Buffer.from(expectedHex, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/** Plan display order for upgrade/downgrade detection */
const PLAN_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

// ─── Service ────────────────────────────────────────────────────────────────

export const paymentService = {

  // ───────────────────────────────────────────────────────────────
  // CREATE ORDER (new subscription or upgrade/downgrade)
  // ───────────────────────────────────────────────────────────────

  async createOrder(userId: string, planSlug: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan) throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    if (!plan.isActive) throw new AppError('This plan is no longer available', 400, 'PLAN_INACTIVE');
    if (plan.slug === 'free') throw new AppError('Cannot create an order for the free plan', 400, 'INVALID_PLAN');

    // Check if user already has this exact plan + cycle
    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (existingSub?.status === 'ACTIVE' && existingSub.plan.slug === planSlug && existingSub.billingCycle === billingCycle) {
      throw new AppError('You are already subscribed to this plan with the same billing cycle', 400, 'ALREADY_SUBSCRIBED');
    }

    const basePrice = billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
    const { baseAmount, gstAmount, totalAmount } = calculatePriceWithGST(basePrice);

    // Calculate proration credit if upgrading from an existing paid plan
    let prorationCredit = 0;
    let prorationDetails: any = null;

    if (existingSub?.status === 'ACTIVE' && existingSub.plan.slug !== 'free') {
      const proration = this.calculateProration(existingSub, existingSub.plan);
      prorationCredit = proration.credit;
      prorationDetails = proration;
    }

    const finalAmount = Math.max(0, totalAmount - prorationCredit);
    const amountInPaise = Math.round(finalAmount * 100);

    let razorpayOrderId: string;

    const paymentMode = resolvePaymentMode();

    if (paymentMode === 'demo') {
      // Isolated demo: completed by confirmDemoPayment, never by Razorpay.
      razorpayOrderId = `${DEMO_ORDER_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
    } else if (paymentMode === 'dev-mock') {
      // Dev / Test mode: create mock order
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      // Outside the try: missing credentials surface as 503 PAYMENTS_NOT_CONFIGURED.
      const gateway = getRazorpayClient();
      try {
        const order = await gateway.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rcpt_${userId.slice(-8)}_${Date.now()}`,
          notes: {
            userId,
            planSlug,
            billingCycle,
            baseAmount: String(baseAmount),
            gstAmount: String(gstAmount),
            gstRate: '18%',
            prorationCredit: String(prorationCredit),
          },
        });
        razorpayOrderId = order.id;
      } catch (err: any) {
        throw gatewayOrderError(err);
      }
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: finalAmount,
        baseAmount,
        gstAmount,
        currency: 'INR',
        status: 'PENDING',
        razorpayOrderId,
        planSlug,
        billingCycle,
      },
    });

    return {
      orderId: razorpayOrderId,
      amount: amountInPaise,
      baseAmount,
      gstAmount,
      prorationCredit,
      totalBeforeProration: totalAmount,
      finalAmount,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      paymentMode,
      isSimulated: paymentMode !== 'razorpay',
      paymentId: payment.id,
      planName: plan.name,
      billingCycle,
      isUpgrade: existingSub ? (PLAN_ORDER[planSlug] > PLAN_ORDER[existingSub.plan.slug]) : true,
      isDowngrade: existingSub ? (PLAN_ORDER[planSlug] < PLAN_ORDER[existingSub.plan.slug]) : false,
      proration: prorationDetails,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // PRORATION CALCULATION
  // ───────────────────────────────────────────────────────────────

  calculateProration(subscription: any, currentPlan: any) {
    const now = new Date();
    const start = new Date(subscription.startDate);
    const end = new Date(subscription.endDate);

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const daysUsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysUsed);

    const planPrice = subscription.billingCycle === 'MONTHLY'
      ? currentPlan.monthlyPrice
      : currentPlan.yearlyPrice;

    const { totalAmount: totalPaid } = calculatePriceWithGST(planPrice);
    const dailyRate = totalPaid / totalDays;
    const credit = Math.round(dailyRate * daysRemaining * 100) / 100;

    return {
      currentPlan: currentPlan.name,
      currentPlanSlug: currentPlan.slug,
      totalDays,
      daysUsed,
      daysRemaining,
      totalPaid,
      dailyRate: Math.round(dailyRate * 100) / 100,
      credit,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // PREVIEW UPGRADE/DOWNGRADE (no order created, just pricing info)
  // ───────────────────────────────────────────────────────────────

  async previewPlanChange(userId: string, targetPlanSlug: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const targetPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: targetPlanSlug } });
    if (!targetPlan) throw new AppError('Target plan not found', 404, 'PLAN_NOT_FOUND');
    if (!targetPlan.isActive) throw new AppError('This plan is no longer available', 400, 'PLAN_INACTIVE');

    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const targetPrice = billingCycle === 'MONTHLY' ? targetPlan.monthlyPrice : targetPlan.yearlyPrice;
    const { baseAmount, gstAmount, totalAmount } = calculatePriceWithGST(targetPrice);

    let prorationCredit = 0;
    let prorationDetails: any = null;
    let changeType: 'new' | 'upgrade' | 'downgrade' | 'cycle_change' | 'same' = 'new';

    if (existingSub?.status === 'ACTIVE') {
      if (existingSub.plan.slug === targetPlanSlug && existingSub.billingCycle === billingCycle) {
        changeType = 'same';
      } else if (existingSub.plan.slug === targetPlanSlug) {
        changeType = 'cycle_change';
      } else if (PLAN_ORDER[targetPlanSlug] > PLAN_ORDER[existingSub.plan.slug]) {
        changeType = 'upgrade';
      } else {
        changeType = 'downgrade';
      }

      if (existingSub.plan.slug !== 'free' && changeType !== 'same') {
        const proration = this.calculateProration(existingSub, existingSub.plan);
        prorationCredit = proration.credit;
        prorationDetails = proration;
      }
    }

    const finalAmount = Math.max(0, totalAmount - prorationCredit);

    return {
      changeType,
      currentPlan: existingSub?.plan?.name || 'Free',
      currentPlanSlug: existingSub?.plan?.slug || 'free',
      currentBillingCycle: existingSub?.billingCycle || null,
      targetPlan: targetPlan.name,
      targetPlanSlug: targetPlan.slug,
      targetBillingCycle: billingCycle,
      pricing: {
        baseAmount,
        gstAmount,
        gstRate: GST_RATE,
        totalBeforeProration: totalAmount,
        prorationCredit,
        finalAmount,
      },
      proration: prorationDetails,
      currentSubscriptionEnd: existingSub?.endDate || null,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // VERIFY PAYMENT + ACTIVATE SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────

  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    if (payment.userId !== userId) throw new AppError('Payment does not belong to this user', 403, 'UNAUTHORIZED');
    if (payment.status === 'SUCCESS') throw new AppError('Payment already verified', 400, 'PAYMENT_ALREADY_VERIFIED');
    if (!(CONFIRMABLE_PAYMENT_STATUSES as string[]).includes(payment.status)) {
      // REFUNDED: replaying the original, genuinely valid signature must not
      // turn a refunded payment back into an active subscription.
      throw new AppError('This payment can no longer be verified', 400, 'INVALID_PAYMENT_STATUS');
    }

    // A demo order never reached Razorpay, so no gateway signature can exist
    // for it. It is completed only by confirmDemoPayment, under demo mode.
    if (razorpayOrderId.startsWith(DEMO_ORDER_PREFIX)) {
      throw new AppError('Demo orders cannot be verified as Razorpay payments', 400, 'DEMO_ORDER');
    }

    // Verify the HMAC signature.
    //
    // SECURITY: whether verification runs is decided ONLY by server
    // configuration (see isRazorpayMockMode). The caller-supplied
    // `razorpayOrderId` / `razorpayPaymentId` deliberately play no part in that
    // decision — letting them do so allowed a client to skip verification on a
    // real order by sending an id prefixed `pay_mock_`.
    //
    // Consequence by design: when real credentials are configured, EVERY
    // verification must present a valid signature. Order creation no longer
    // falls back to a locally minted id when Razorpay fails, and any such
    // legacy `order_mock_*` row correctly fails here rather than silently
    // activating a subscription.
    if (!isRazorpayMockMode()) {
      // SECURITY: an HMAC keyed with an empty (or placeholder) secret is
      // computable by anyone, so it proves nothing. Without real credentials
      // there is no verification to perform: refuse, and change nothing.
      if (!isRazorpayConfigured()) {
        throw new AppError('Payment gateway is not configured on this server.', 503, 'PAYMENTS_NOT_CONFIGURED');
      }

      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (!signaturesMatch(expectedSignature, razorpaySignature)) {
        // Conditional, so a concurrent successful verification is never
        // overwritten back to FAILED.
        await prisma.payment.updateMany({
          where: { id: payment.id, status: { in: CONFIRMABLE_PAYMENT_STATUSES } },
          data: { status: 'FAILED' },
        });
        throw new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE');
      }
    }

    // Claim the payment atomically: of concurrent or replayed verifications,
    // exactly one moves it to SUCCESS and goes on to activate the subscription.
    const paidAt = new Date();
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: CONFIRMABLE_PAYMENT_STATUSES } },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId,
        razorpaySignature,
        paidAt,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError('Payment already verified', 400, 'PAYMENT_ALREADY_VERIFIED');
    }

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return this.activateSubscription(payment, updatedPayment, razorpayOrderId, false);
  },

  // ───────────────────────────────────────────────────────────────
  // CONFIRM DEMO PAYMENT (PAYMENTS_DEMO_MODE only — no money moves)
  // ───────────────────────────────────────────────────────────────

  async confirmDemoPayment(userId: string, orderId: string) {
    if (!isPaymentsDemoMode()) {
      throw new AppError('Demo payments are not enabled on this server', 403, 'DEMO_PAYMENTS_DISABLED');
    }
    if (!orderId.startsWith(DEMO_ORDER_PREFIX)) {
      throw new AppError('Only demo orders can be confirmed here', 400, 'NOT_A_DEMO_ORDER');
    }

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });

    if (!payment) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    if (payment.userId !== userId) throw new AppError('Payment does not belong to this user', 403, 'UNAUTHORIZED');
    if (payment.status === 'SUCCESS') throw new AppError('Payment already verified', 400, 'PAYMENT_ALREADY_VERIFIED');
    if (payment.status !== 'PENDING') {
      throw new AppError('Only pending payments can be confirmed', 400, 'INVALID_PAYMENT_STATUS');
    }

    // Claim the payment atomically, so two concurrent confirmations cannot
    // both activate a subscription.
    const paidAt = new Date();
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId: `pay_demo_${crypto.randomBytes(8).toString('hex')}`,
        paidAt,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError('Payment already verified', 400, 'PAYMENT_ALREADY_VERIFIED');
    }

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return this.activateSubscription(payment, updatedPayment, orderId, true);
  },

  // ───────────────────────────────────────────────────────────────
  // ACTIVATE SUBSCRIPTION (after a payment has been marked SUCCESS)
  // ───────────────────────────────────────────────────────────────

  async activateSubscription(
    payment: { userId: string; planSlug: string | null; billingCycle: string | null },
    updatedPayment: unknown,
    razorpayOrderId: string,
    isDemo: boolean,
  ) {
    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    if (payment.billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Find the plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { slug: payment.planSlug || '' },
    });
    if (!plan) throw new AppError('Plan not found for payment', 500, 'PLAN_NOT_FOUND');

    // Upsert subscription — reset monthly AI checks on new/upgrade
    const subscription = await prisma.subscription.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: payment.billingCycle as 'MONTHLY' | 'YEARLY',
        startDate,
        endDate,
        autoRenew: true,
        aiChecksUsed: 0,
        aiChecksResetDate: new Date(),
        lifetimeAiChecksUsed: 0,
        savedTendersCount: 0,
        alertsCreatedCount: 0,
        razorpayOrderId,
      },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: payment.billingCycle as 'MONTHLY' | 'YEARLY',
        startDate,
        endDate,
        autoRenew: true,
        aiChecksUsed: 0,
        aiChecksResetDate: new Date(),
        razorpayOrderId,
      },
      include: { plan: true },
    });

    // Invalidate plan cache
    await planConfigService.invalidateCache(payment.userId);

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: payment.userId,
        type: 'SYSTEM',
        channel: 'IN_APP',
        title: 'Subscription Activated',
        message:
          `Your ${plan.name} plan (${payment.billingCycle?.toLowerCase()}) is now active until ${endDate.toLocaleDateString('en-IN')}.` +
          (isDemo ? ' Demo transaction — no payment was taken.' : ''),
        data: { planSlug: plan.slug, billingCycle: payment.billingCycle, ...(isDemo ? { demo: true } : {}) },
      },
    });
    await invalidateUnreadCount(payment.userId);

    return {
      subscription,
      payment: updatedPayment,
      isSimulated: isDemo,
      message: isDemo
        ? `Demo subscription to ${plan.name} activated — no payment was taken`
        : `Successfully subscribed to ${plan.name} plan`,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // CANCEL SUBSCRIPTION
  // ───────────────────────────────────────────────────────────────

  async cancelSubscription(userId: string, reason?: string, cancelImmediately?: boolean) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) throw new AppError('No active subscription found', 404, 'SUBSCRIPTION_NOT_FOUND');
    if (subscription.status !== 'ACTIVE') throw new AppError('Subscription is not active', 400, 'SUBSCRIPTION_NOT_ACTIVE');

    const updateData: any = {
      autoRenew: false,
    };

    if (cancelImmediately) {
      // Immediate cancellation — expire right now, downgrade to free
      updateData.status = 'CANCELLED';
      updateData.endDate = new Date();
    }
    // Otherwise, subscription stays active until endDate, just won't auto-renew

    const updatedSubscription = await prisma.subscription.update({
      where: { userId },
      data: updateData,
      include: { plan: true },
    });

    // Invalidate plan cache
    await planConfigService.invalidateCache(userId);

    // Create notification
    const cancelMessage = cancelImmediately
      ? `Your ${subscription.plan.name} plan has been cancelled immediately.`
      : `Your ${subscription.plan.name} plan will expire on ${subscription.endDate.toLocaleDateString('en-IN')}. You won't be charged again.`;

    await prisma.notification.create({
      data: {
        userId,
        type: 'SUBSCRIPTION_EXPIRY',
        channel: 'IN_APP',
        title: 'Subscription Cancelled',
        message: cancelMessage,
        data: { reason: reason || null, cancelImmediately: !!cancelImmediately },
      },
    });
    await invalidateUnreadCount(userId);

    return {
      subscription: updatedSubscription,
      message: cancelMessage,
      effectiveDate: cancelImmediately ? new Date() : subscription.endDate,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // SWITCH BILLING CYCLE (monthly ↔ yearly, same plan)
  // ───────────────────────────────────────────────────────────────

  async switchBillingCycle(userId: string, newBillingCycle: 'MONTHLY' | 'YEARLY') {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new AppError('No active subscription found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    if (subscription.billingCycle === newBillingCycle) {
      throw new AppError(`Already on ${newBillingCycle.toLowerCase()} billing`, 400, 'SAME_CYCLE');
    }

    // Create an order for the new cycle price (with proration credit from current plan)
    return this.createOrder(userId, subscription.plan.slug, newBillingCycle);
  },

  // ───────────────────────────────────────────────────────────────
  // RETRY FAILED PAYMENT
  // ───────────────────────────────────────────────────────────────

  async retryPayment(userId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    if (payment.userId !== userId) throw new AppError('Payment does not belong to this user', 403, 'UNAUTHORIZED');
    if (payment.status === 'SUCCESS') throw new AppError('Payment already succeeded', 400, 'PAYMENT_ALREADY_VERIFIED');
    if (payment.status !== 'FAILED' && payment.status !== 'PENDING') {
      throw new AppError('Only failed or pending payments can be retried', 400, 'INVALID_PAYMENT_STATUS');
    }

    // Create a new Razorpay order for the same amount
    const amountInPaise = Math.round(payment.amount * 100);
    let razorpayOrderId: string;

    const paymentMode = resolvePaymentMode();

    if (paymentMode === 'demo') {
      razorpayOrderId = `${DEMO_ORDER_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
    } else if (paymentMode === 'dev-mock') {
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      const gateway = getRazorpayClient();
      try {
        const order = await gateway.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `retry_${userId.slice(-8)}_${Date.now()}`,
          notes: {
            userId,
            planSlug: payment.planSlug || '',
            billingCycle: payment.billingCycle || '',
            retryOf: payment.id,
          },
        });
        razorpayOrderId = order.id;
      } catch (err: any) {
        throw gatewayOrderError(err);
      }
    }

    // Create new payment record linked to the retry
    const newPayment = await prisma.payment.create({
      data: {
        userId,
        amount: payment.amount,
        baseAmount: payment.baseAmount,
        gstAmount: payment.gstAmount,
        currency: payment.currency,
        status: 'PENDING',
        razorpayOrderId,
        planSlug: payment.planSlug,
        billingCycle: payment.billingCycle,
      },
    });

    return {
      orderId: razorpayOrderId,
      amount: amountInPaise,
      baseAmount: payment.baseAmount,
      gstAmount: payment.gstAmount,
      currency: payment.currency,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      paymentMode,
      isSimulated: paymentMode !== 'razorpay',
      paymentId: newPayment.id,
      retriedFrom: payment.id,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // INVOICES
  // ───────────────────────────────────────────────────────────────

  async getInvoices(userId: string) {
    const payments = await prisma.payment.findMany({
      where: {
        userId,
        status: 'SUCCESS',
      },
      orderBy: { createdAt: 'desc' },
    });

    const invoices = await Promise.all(
      payments.map(async (payment) => {
        let plan = null;
        if (payment.planSlug) {
          plan = await prisma.subscriptionPlan.findUnique({
            where: { slug: payment.planSlug },
            select: { name: true, slug: true },
          });
        }

        return {
          id: payment.id,
          invoiceNumber: `TB-${payment.paidAt ? payment.paidAt.getFullYear() : new Date(payment.createdAt).getFullYear()}-${payment.id.slice(-6).toUpperCase()}`,
          planName: plan?.name || 'Unknown',
          planSlug: plan?.slug || 'unknown',
          billingCycle: payment.billingCycle,
          baseAmount: payment.baseAmount,
          gstAmount: payment.gstAmount,
          gstRate: GST_RATE * 100,
          totalAmount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          razorpayPaymentId: payment.razorpayPaymentId,
          paidAt: payment.paidAt || payment.createdAt,
          invoiceUrl: payment.invoiceUrl,
        };
      })
    );

    return invoices;
  },

  /**
   * Get a single invoice by payment ID (for PDF download / detail view).
   */
  async getInvoiceDetail(userId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (payment.userId !== userId) throw new AppError('Invoice does not belong to this user', 403, 'UNAUTHORIZED');
    if (payment.status !== 'SUCCESS') throw new AppError('No invoice available for this payment', 400, 'NO_INVOICE');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { companyProfile: true },
    });

    let plan = null;
    if (payment.planSlug) {
      plan = await prisma.subscriptionPlan.findUnique({
        where: { slug: payment.planSlug },
        select: { name: true, slug: true, description: true },
      });
    }

    return {
      invoice: {
        id: payment.id,
        invoiceNumber: `TB-${payment.paidAt ? payment.paidAt.getFullYear() : new Date(payment.createdAt).getFullYear()}-${payment.id.slice(-6).toUpperCase()}`,
        planName: plan?.name || 'Unknown',
        planSlug: plan?.slug || 'unknown',
        planDescription: plan?.description || '',
        billingCycle: payment.billingCycle,
        baseAmount: payment.baseAmount,
        gstAmount: payment.gstAmount,
        gstRate: GST_RATE * 100,
        totalAmount: payment.amount,
        currency: payment.currency,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayOrderId: payment.razorpayOrderId,
        paidAt: payment.paidAt || payment.createdAt,
      },
      customer: {
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || null,
        companyName: user?.companyProfile?.companyName || null,
        gstin: user?.companyProfile?.gstin || null,
        pan: user?.companyProfile?.pan || null,
      },
      seller: {
        name: 'TenderBazaar',
        gstin: 'PLACEHOLDER_GSTIN',   // Replace with actual GSTIN
        pan: 'PLACEHOLDER_PAN',       // Replace with actual PAN
        address: 'India',
        email: 'billing@tenderbazaar.in',
      },
    };
  },

  // ───────────────────────────────────────────────────────────────
  // PAYMENT HISTORY (all payments, not just successful)
  // ───────────────────────────────────────────────────────────────

  async getPaymentHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { userId } }),
    ]);

    const enriched = await Promise.all(
      payments.map(async (p) => {
        let planName = null;
        if (p.planSlug) {
          const plan = await prisma.subscriptionPlan.findUnique({
            where: { slug: p.planSlug },
            select: { name: true },
          });
          planName = plan?.name || null;
        }
        return { ...p, planName };
      })
    );

    return {
      payments: enriched,
      total,
      page,
      limit,
    };
  },

  // ───────────────────────────────────────────────────────────────
  // RAZORPAY WEBHOOK HANDLER
  // ───────────────────────────────────────────────────────────────

  async handleWebhook(body: Buffer | string, signature: string) {
    // Verify webhook signature.
    //
    // SECURITY: without a secret there is nothing to verify against, so the
    // webhook is refused. It used to be processed UNVERIFIED in that case, and
    // a forged `payment.captured` for any pending order activated a
    // subscription without payment (handlePaymentCaptured).
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw new AppError('Payment webhooks are not configured on this server', 503, 'WEBHOOKS_NOT_CONFIGURED');
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(typeof body === 'string' ? body : body.toString())
      .digest('hex');

    if (!signaturesMatch(expectedSignature, signature)) {
      throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const payload = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString());
    const event = payload.event;

    console.log(`[Razorpay Webhook] Event: ${event}`);

    switch (event) {
      case 'payment.captured': {
        await this.handlePaymentCaptured(payload);
        break;
      }

      case 'payment.failed': {
        await this.handlePaymentFailed(payload);
        break;
      }

      case 'refund.created':
      case 'refund.processed': {
        await this.handleRefund(payload);
        break;
      }

      case 'payment.dispute.created': {
        await this.handleDispute(payload);
        break;
      }

      default:
        console.log(`[Razorpay Webhook] Unhandled event: ${event}`);
        break;
    }

    return { received: true, event };
  },

  // ─── Webhook sub-handlers ─────────────────────────────────────

  async handlePaymentCaptured(payload: any) {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity?.order_id) return;
    // Demo orders never reach Razorpay; no gateway event can complete one.
    if (String(paymentEntity.order_id).startsWith(DEMO_ORDER_PREFIX)) return;

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: paymentEntity.order_id },
    });

    // SUCCESS is already processed; a REFUNDED payment must not be revived by
    // a (re)delivered capture event.
    if (!payment || !(CONFIRMABLE_PAYMENT_STATUSES as string[]).includes(payment.status)) return;

    // Mark payment as successful — atomically, so a capture event racing the
    // client's verification activates the subscription only once.
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: CONFIRMABLE_PAYMENT_STATUSES } },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId: paymentEntity.id,
        paidAt: new Date(),
      },
    });
    if (claimed.count !== 1) return;

    console.log(`[Razorpay Webhook] Payment captured: ${paymentEntity.id} for order ${paymentEntity.order_id}`);

    // If the subscription wasn't already activated via verifyPayment, activate it now
    const plan = payment.planSlug
      ? await prisma.subscriptionPlan.findUnique({ where: { slug: payment.planSlug } })
      : null;

    if (plan) {
      const existingSub = await prisma.subscription.findUnique({ where: { userId: payment.userId } });

      // Only upsert if subscription doesn't already reflect this order
      if (!existingSub || existingSub.razorpayOrderId !== paymentEntity.order_id) {
        const startDate = new Date();
        const endDate = new Date();
        if (payment.billingCycle === 'YEARLY') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        await prisma.subscription.upsert({
          where: { userId: payment.userId },
          create: {
            userId: payment.userId,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle: payment.billingCycle as 'MONTHLY' | 'YEARLY',
            startDate,
            endDate,
            autoRenew: true,
            aiChecksUsed: 0,
            aiChecksResetDate: new Date(),
            lifetimeAiChecksUsed: 0,
            savedTendersCount: 0,
            alertsCreatedCount: 0,
            razorpayOrderId: paymentEntity.order_id,
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle: payment.billingCycle as 'MONTHLY' | 'YEARLY',
            startDate,
            endDate,
            autoRenew: true,
            aiChecksUsed: 0,
            aiChecksResetDate: new Date(),
            razorpayOrderId: paymentEntity.order_id,
          },
        });

        await planConfigService.invalidateCache(payment.userId);

        console.log(`[Razorpay Webhook] Subscription activated for user ${payment.userId}`);
      }
    }
  },

  async handlePaymentFailed(payload: any) {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity?.order_id) return;

    await prisma.payment.updateMany({
      where: { razorpayOrderId: paymentEntity.order_id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });

    // Find the user and send notification
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: paymentEntity.order_id },
    });

    if (payment) {
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'SYSTEM',
          channel: 'IN_APP',
          title: 'Payment Failed',
          message: `Your payment of ₹${payment.amount} for ${payment.planSlug} plan failed. Please try again or use a different payment method.`,
          data: { paymentId: payment.id, razorpayOrderId: paymentEntity.order_id },
        },
      });
      await invalidateUnreadCount(payment.userId);
    }

    console.log(`[Razorpay Webhook] Payment failed for order ${paymentEntity.order_id}`);
  },

  async handleRefund(payload: any) {
    const refundEntity = payload.payload?.refund?.entity;
    if (!refundEntity?.payment_id) return;

    const payment = await prisma.payment.findUnique({
      where: { razorpayPaymentId: refundEntity.payment_id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });

      // Notify the user
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'SYSTEM',
          channel: 'IN_APP',
          title: 'Refund Processed',
          message: `A refund of ₹${(refundEntity.amount / 100).toFixed(2)} has been processed. It may take 5-7 business days to reflect in your account.`,
          data: { paymentId: payment.id, refundId: refundEntity.id },
        },
      });
      await invalidateUnreadCount(payment.userId);

      console.log(`[Razorpay Webhook] Refund processed: ${refundEntity.id} for payment ${refundEntity.payment_id}`);
    }
  },

  async handleDispute(payload: any) {
    const disputeEntity = payload.payload?.dispute?.entity;
    if (!disputeEntity?.payment_id) return;

    // Log dispute — admin will handle manually
    console.log(`[Razorpay Webhook] Dispute created for payment ${disputeEntity.payment_id}: ${disputeEntity.reason_code}`);

    const payment = await prisma.payment.findUnique({
      where: { razorpayPaymentId: disputeEntity.payment_id },
    });

    if (payment) {
      // Create audit log entry for admin visibility
      try {
        await prisma.auditLog.create({
          data: {
            actorId: 'system',
            actorEmail: 'system@tenderbazaar.in',
            actorRole: 'SUPER_ADMIN',
            action: 'payment.dispute',
            entity: 'Payment',
            entityId: payment.id,
            metadata: {
              disputeId: disputeEntity.id,
              reasonCode: disputeEntity.reason_code,
              amount: disputeEntity.amount,
              userId: payment.userId,
            },
          },
        });
      } catch (err) {
        console.error('[Razorpay Webhook] Failed to log dispute:', err);
      }
    }
  },

  // ───────────────────────────────────────────────────────────────
  // APPLY FREE PLAN (when cancelling or expiring)
  // ───────────────────────────────────────────────────────────────

  async applyFreePlan(userId: string) {
    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'free' } });
    if (!freePlan) return;

    const existingSub = await prisma.subscription.findUnique({ where: { userId } });

    if (existingSub) {
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: freePlan.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          startDate: new Date(),
          endDate: new Date('2099-12-31'), // Free plan never expires
          autoRenew: false,
          aiChecksUsed: 0,
          razorpayOrderId: null,
          razorpaySubscriptionId: null,
        },
      });
    }

    await planConfigService.invalidateCache(userId);
  },
};
