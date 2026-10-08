import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import razorpay from '../../config/razorpay';
import { AppError } from '../../shared/middleware/error-handler';
import { planConfigService } from '../subscriptions/plan-config.service';

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
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  return (
    !keyId ||
    keyId.includes('xxxx') ||
    keyId === 'your-razorpay-key-id' ||
    !keySecret ||
    keySecret === 'your-razorpay-secret' ||
    keySecret.includes('xxxx')
  );
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

    const isMockMode = isRazorpayMockMode();

    if (isMockMode) {
      // Dev / Test mode: create mock order
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      try {
        const order = await razorpay.orders.create({
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
        console.warn('Razorpay order creation failed, falling back to mock order:', err?.error?.description || err?.message);
        razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
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
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    if (payment.status === 'SUCCESS') throw new AppError('Payment already verified', 400, 'PAYMENT_ALREADY_VERIFIED');

    // Verify the HMAC signature.
    //
    // SECURITY: whether verification runs is decided ONLY by server
    // configuration (see isRazorpayMockMode). The caller-supplied
    // `razorpayOrderId` / `razorpayPaymentId` deliberately play no part in that
    // decision — letting them do so allowed a client to skip verification on a
    // real order by sending an id prefixed `pay_mock_`.
    //
    // Consequence by design: when real credentials are configured, EVERY
    // verification must present a valid signature. A `order_mock_*` row that
    // only exists because a live Razorpay call failed represents a payment that
    // never reached Razorpay, so it correctly fails here rather than silently
    // activating a subscription.
    if (!isRazorpayMockMode()) {
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });
        throw new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE');
      }
    }

    // Update payment to SUCCESS
    const paidAt = new Date();
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId,
        razorpaySignature,
        paidAt,
      },
    });

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
        message: `Your ${plan.name} plan (${payment.billingCycle?.toLowerCase()}) is now active until ${endDate.toLocaleDateString('en-IN')}.`,
        data: { planSlug: plan.slug, billingCycle: payment.billingCycle },
      },
    });

    return {
      subscription,
      payment: updatedPayment,
      message: `Successfully subscribed to ${plan.name} plan`,
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

    const isMockMode = isRazorpayMockMode();

    if (isMockMode) {
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      try {
        const order = await razorpay.orders.create({
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
        console.warn('Razorpay retry order creation failed, falling back to mock order:', err?.error?.description || err?.message);
        razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
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
    // Verify webhook signature
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(typeof body === 'string' ? body : body.toString())
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
      }
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

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: paymentEntity.order_id },
    });

    if (!payment || payment.status === 'SUCCESS') return;

    // Mark payment as successful
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId: paymentEntity.id,
        paidAt: new Date(),
      },
    });

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
