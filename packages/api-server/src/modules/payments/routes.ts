import { Router } from 'express';
import { paymentController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

/* ═══════════════════════════════════════════════════════════════
   PUBLIC
   ═══════════════════════════════════════════════════════════════ */

router.get('/plans', paymentController.getPlans);

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION (auth required)
   ═══════════════════════════════════════════════════════════════ */

router.get('/subscription', authenticate, paymentController.getCurrentSubscription);
router.get('/subscription/usage', authenticate, paymentController.getUsageStats);

/* ═══════════════════════════════════════════════════════════════
   CHECKOUT & PAYMENT (auth required)
   ═══════════════════════════════════════════════════════════════ */

// Create a Razorpay order for new subscription or upgrade
router.post('/subscription/checkout', authenticate, paymentController.createOrder);

// Preview pricing for a plan change (no payment created)
router.post('/subscription/preview', authenticate, paymentController.previewPlanChange);

// Verify Razorpay payment after checkout
router.post('/subscription/verify', authenticate, paymentController.verifyPayment);

// Switch billing cycle (monthly ↔ yearly) — creates a new order
router.post('/subscription/switch-cycle', authenticate, paymentController.switchBillingCycle);

// Retry a failed/pending payment
router.post('/subscription/retry', authenticate, paymentController.retryPayment);

/* ═══════════════════════════════════════════════════════════════
   CANCELLATION (auth required)
   ═══════════════════════════════════════════════════════════════ */

router.post('/subscription/cancel', authenticate, paymentController.cancelSubscription);

/* ═══════════════════════════════════════════════════════════════
   INVOICES & PAYMENT HISTORY (auth required)
   ═══════════════════════════════════════════════════════════════ */

router.get('/subscription/invoices', authenticate, paymentController.getInvoices);
router.get('/subscription/invoices/:paymentId', authenticate, paymentController.getInvoiceDetail);
router.get('/subscription/payments', authenticate, paymentController.getPaymentHistory);

/* ═══════════════════════════════════════════════════════════════
   RAZORPAY WEBHOOK (no auth — uses raw body + signature)
   ═══════════════════════════════════════════════════════════════ */

router.post('/webhooks/razorpay', paymentController.handleWebhook);

export default router;
