import Razorpay from 'razorpay';

import { env } from './env';
import { AppError } from '../shared/middleware/error-handler';

/**
 * Razorpay client — constructed LAZILY, on first real use.
 *
 * This module used to build the client at import time:
 *
 *     const razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, ... });
 *     export default razorpay;
 *
 * `RAZORPAY_KEY_ID` defaults to '' (see config/env.ts), and the SDK throws
 * `key_id or oauthToken is mandatory` on an empty key. Because
 * modules/payments/service.ts imports this module, and app.ts imports that, an
 * absent payments credential crashed the ENTIRE API server during module
 * initialization — observed in Phase 8 staging as a boot crash loop with
 * RestartCount=54. One unconfigured optional integration took down auth,
 * tenders, alerts and search along with it.
 *
 * Deferring construction means module import never touches the SDK, so the API
 * starts and every unrelated feature works. A payment operation that genuinely
 * needs the client gets a clear, controlled configuration error instead.
 */

let client: Razorpay | null = null;

/**
 * Whether real Razorpay credentials are present.
 *
 * Derived ONLY from trusted server-side configuration, never from request
 * input. The placeholder strings match those shipped in `.env.example`, so a
 * developer who has not configured Razorpay is treated as unconfigured rather
 * than as holding a real key.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  return Boolean(
    keyId &&
      keySecret &&
      !keyId.includes('xxxx') &&
      keyId !== 'your-razorpay-key-id' &&
      !keySecret.includes('xxxx') &&
      keySecret !== 'your-razorpay-secret',
  );
}

/**
 * The Razorpay client, built on first call and cached.
 *
 * Throws a controlled AppError when credentials are absent or still
 * placeholders — a 503 the payments routes can surface as "payments are not
 * configured on this server", rather than an SDK exception at import time.
 */
export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      'Payment gateway is not configured on this server.',
      503,
      'PAYMENTS_NOT_CONFIGURED',
    );
  }

  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  return client;
}

/** Test-only: drop the cached client so a later call re-reads configuration. */
export function resetRazorpayClientForTests(): void {
  client = null;
}
