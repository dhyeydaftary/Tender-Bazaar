import { z } from 'zod';

export const checkoutSchema = z.object({
  planSlug: z.string().min(1, 'Plan slug is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  couponCode: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
});

// The id is the server-minted demo order (payments/service.ts DEMO_ORDER_PREFIX).
export const demoConfirmSchema = z.object({
  orderId: z.string().regex(/^order_demo_[0-9a-f]{16}$/, 'A demo order ID is required'),
});

export const cancelSchema = z.object({
  reason: z.string().max(1000).optional(),
  cancelImmediately: z.boolean().default(false),
});

export const upgradeSchema = z.object({
  planSlug: z.string().min(1, 'Target plan slug is required'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

export const switchBillingCycleSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

export const retryPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export const applyCouponSchema = z.object({
  couponCode: z.string().min(1, 'Coupon code is required'),
  planSlug: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});
