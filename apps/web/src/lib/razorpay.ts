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

interface RazorpayCheckoutOptions {
  orderId: string;
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
