/**
 * Razorpay Native SDK integration for React Native CLI.
 *
 * Uses `react-native-razorpay` which wraps the official Razorpay Android/iOS SDKs.
 *
 * Install:
 *   pnpm add react-native-razorpay --filter mobile
 *   cd ios && pod install
 */

import RazorpayCheckout from 'react-native-razorpay';
import type { CheckoutSession } from '@/services/api/subscription';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RazorpayUserInfo {
  name?: string;
  email?: string;
  phone?: string;
}

/** Result from Razorpay SDK (snake_case as returned by the SDK) */
interface RazorpaySuccessResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** Normalized result with camelCase keys matching our verify endpoint */
export interface RazorpayPaymentResult {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface RazorpayError {
  code: number;
  description: string;
}

// ─── Main Function ─────────────────────────────────────────────────────────

/**
 * Opens the Razorpay checkout sheet using the native SDK.
 *
 * @param session - Checkout session from our backend (orderId, keyId, amount, currency, planName)
 * @param userInfo - User details for prefilling the checkout form
 * @returns Normalized payment result ready for our /subscription/verify endpoint
 * @throws RazorpayError if the user cancels or payment fails
 */
export async function openRazorpayCheckout(
  session: CheckoutSession,
  userInfo: RazorpayUserInfo = {},
): Promise<RazorpayPaymentResult> {
  const options = {
    key: session.keyId,
    order_id: session.orderId,
    amount: session.amount, // in paise as returned by backend
    currency: session.currency || 'INR',
    name: 'TenderBazaar',
    description: `${session.planName} Subscription`,
    image: 'https://tenderbazaar.in/logo.png', // App logo for checkout
    prefill: {
      name: userInfo.name || '',
      email: userInfo.email || '',
      contact: userInfo.phone || '',
    },
    theme: {
      color: '#FF6B35', // Brand primary color
    },
    modal: {
      confirm_close: true,
      animation: true,
    },
    retry: {
      enabled: true,
      max_count: 2,
    },
    notes: {
      app: 'TenderBazaar Mobile',
      plan: session.planName,
    },
  };

  // RazorpayCheckout.open returns a promise that resolves on success
  // and rejects on failure/cancellation
  const result: RazorpaySuccessResult = await RazorpayCheckout.open(options);

  // Normalize snake_case → camelCase for our verify endpoint
  return {
    razorpayPaymentId: result.razorpay_payment_id,
    razorpayOrderId: result.razorpay_order_id,
    razorpaySignature: result.razorpay_signature,
  };
}

/**
 * Check if a Razorpay error is a user cancellation (not a real failure).
 */
export function isRazorpayCancellation(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    // Razorpay SDK returns code 2 for user cancellation on Android,
    // and a description containing "cancelled" on iOS
    if (err.code === 2) return true;
    if (
      typeof err.description === 'string' &&
      err.description.toLowerCase().includes('cancelled')
    ) {
      return true;
    }
  }
  return false;
}
