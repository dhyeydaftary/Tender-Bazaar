declare global {
  interface Window {
    Razorpay: any;
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * How the server says this checkout completes (POST /subscription/checkout →
 * `paymentMode`). The server is the only authority: the browser never infers a
 * simulated payment from the order id or key.
 */
export type PaymentMode = 'razorpay' | 'demo' | 'dev-mock';

interface RazorpayCheckoutOptions {
  orderId: string;
  paymentMode?: PaymentMode;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  email: string;
  phone?: string;
  onSuccess: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onError: (error: any) => void;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
  if (options.paymentMode === 'demo') {
    // Demo checkouts are confirmed through /subscription/demo/confirm by the
    // caller; they must never be submitted to Razorpay verification.
    throw new Error('Demo checkouts are not completed through Razorpay');
  }

  if (options.paymentMode === 'dev-mock') {
    // Local development without Razorpay keys: the server (non-production
    // only) accepts this mock verification. Never used in production.
    setTimeout(() => {
      options.onSuccess({
        razorpay_order_id: options.orderId,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: `sig_mock_${Date.now()}`,
      });
    }, 400);
    return;
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error('Failed to load Razorpay SDK');
  }

  const rzp = new window.Razorpay({
    key: options.keyId,
    amount: options.amount,
    currency: options.currency,
    name: 'TenderBazaar',
    description: 'Subscription Payment',
    image: '/logo.png',
    order_id: options.orderId,
    prefill: {
      name: options.name,
      email: options.email,
      contact: options.phone,
    },
    theme: {
      color: '#FF6B35',
    },
    handler: options.onSuccess,
  });

  rzp.on('payment.failed', options.onError);
  rzp.open();
}
