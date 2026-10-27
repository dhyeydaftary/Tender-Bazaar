import assert from 'node:assert/strict';
import { openRazorpayCheckout, type PaymentMode } from '../razorpay';

/**
 * The browser must never decide on its own that a payment is simulated.
 *
 * openRazorpayCheckout() used to treat an `order_mock_` id, an empty key or a
 * placeholder key as "mock", and then fabricated a pay_mock_ / sig_mock_
 * success that the page posted to /subscription/verify. Only the
 * server-reported paymentMode may select a non-Razorpay path now, and the demo
 * mode is never completed here at all.
 */

console.log('--- Starting Razorpay Checkout Mode Tests ---');

function options(orderId: string, keyId: string, paymentMode?: PaymentMode) {
  const calls: unknown[] = [];
  return {
    calls,
    opts: {
      orderId,
      paymentMode,
      amount: 176882,
      currency: 'INR',
      keyId,
      name: 'Test User',
      email: 'test@example.invalid',
      onSuccess: (response: unknown) => calls.push(response),
      onError: () => undefined,
    },
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // 1. Demo checkouts are refused outright — no fabricated success.
  {
    const { calls, opts } = options('order_demo_00112233445566ff', '', 'demo');
    await assert.rejects(openRazorpayCheckout(opts), /not completed through Razorpay/);
    await wait(600);
    assert.equal(calls.length, 0);
    console.log('✓ paymentMode=demo never produces a payment response');
  }

  // 2. Mock-looking ids and placeholder keys no longer trigger a fake success:
  //    without a server-declared mode, the real Razorpay path runs (and here,
  //    outside a browser, fails to load rather than inventing a payment).
  for (const [orderId, keyId] of [
    ['order_mock_00112233445566ff', 'rzp_test_placeholder'],
    ['order_live_1', ''],
    ['order_live_2', 'rzp_test_xxxxxxxxxxxx'],
  ]) {
    const { calls, opts } = options(orderId, keyId);
    await assert.rejects(openRazorpayCheckout(opts), /Failed to load Razorpay SDK/);
    await wait(600);
    assert.equal(calls.length, 0, `${orderId}: no fabricated payment`);
  }
  console.log('✓ Order ids and keys cannot switch the browser into a simulated payment');

  // 3. The server-declared development mock keeps working (non-production servers only).
  {
    const { calls, opts } = options('order_mock_00112233445566ff', 'rzp_test_placeholder', 'dev-mock');
    await openRazorpayCheckout(opts);
    await wait(600);
    assert.equal(calls.length, 1);
    console.log('✓ paymentMode=dev-mock keeps the local development flow');
  }

  console.log('--- All Razorpay Checkout Mode Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
