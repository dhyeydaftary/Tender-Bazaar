import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * PAYMENTS_DEMO_MODE — the isolated client demo's simulated checkout.
 *
 * The demo used to run with Razorpay unconfigured, and order creation silently
 * fell back to a locally minted `order_mock_*` id. The browser then fabricated
 * a `pay_mock_` / `sig_mock_` "success" and posted it to the real verification
 * endpoint, which (correctly) rejected it: "Payment verification failed".
 *
 * This suite pins the replacement:
 *   - demo payments are off by default and refused at startup outside the
 *     isolated demo deployment;
 *   - when enabled, a demo order is completed only through
 *     confirmDemoPayment, by its owner, exactly once;
 *   - nothing a client sends (flags, mock ids, fake signatures) can complete a
 *     payment in real-payment mode;
 *   - missing or failing Razorpay surfaces as an error, never as a fake order;
 *   - real HMAC verification still activates, and only valid signatures do.
 *
 * The payments service runs against an in-memory Prisma stand-in injected
 * through the require cache, in the same style as razorpay-config.test.ts.
 */

console.log('--- Starting Payments Demo-Mode Tests ---');

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// Test-only values. Long and distinct so the production validators accept them.
const PROD_BASE = {
  NODE_ENV: 'production',
  JWT_SECRET: 'unit-test-access-signing-key-0123456789abcdef',
  JWT_REFRESH_SECRET: 'unit-test-refresh-signing-key-0123456789abcdef',
  REDIS_URL: 'redis://:unit-test-redis-pass@localhost:6379',
  // Production startup also insists on an explicit https web origin, and the
  // deployment-checked names below are pinned so values the generated Prisma
  // client may load from the repository's .env cannot interfere.
  FRONTEND_URL: 'https://app.unit-test.invalid',
  ADMIN_URL: 'https://admin.unit-test.invalid',
  CORS_ORIGINS: '',
  GOOGLE_CLIENT_ID: '',
  ALLOW_DEMO_GOOGLE_AUTH: 'false',
  AI_SERVICE_TOKEN: '',
  RAZORPAY_KEY_ID: undefined,
  RAZORPAY_KEY_SECRET: undefined,
  RAZORPAY_WEBHOOK_SECRET: undefined,
  PAYMENTS_DEMO_MODE: undefined,
  DEMO_DEPLOYMENT: undefined,
};
const DEMO_DB = 'postgresql://postgres:unit-test-db-pass@postgres:5432/tenderbazaar_demo';
const REAL_DB = 'postgresql://postgres:unit-test-db-pass@postgres:5432/tenderbazaar';
const DEMO_ENV = {
  ...PROD_BASE,
  DATABASE_URL: DEMO_DB,
  PAYMENTS_DEMO_MODE: 'true',
  DEMO_DEPLOYMENT: 'tenderbazaar-demo',
};
const TEST_KEY_ID = 'rzp_test_unitTestKeyId';
const TEST_KEY_SECRET = 'unit-test-razorpay-key-secret';

// ─── In-memory Prisma stand-in ─────────────────────────────────────────────

type Row = Record<string, any>;

function makeDb() {
  const payments: Row[] = [];
  const subscriptions: Row[] = [];
  const notifications: Row[] = [];
  const plans: Row[] = [
    { id: 'plan_free', slug: 'free', name: 'Free', isActive: true, monthlyPrice: 0, yearlyPrice: 0 },
    { id: 'plan_starter', slug: 'starter', name: 'Starter', isActive: true, monthlyPrice: 1499, yearlyPrice: 14999 },
  ];
  let seq = 0;
  // Order of payment reads and writes, to show how concurrent calls interleave.
  const log: string[] = [];

  // Supports equality and Prisma's `{ in: [...] }` filter.
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === 'object' && Array.isArray(v.in) ? v.in.includes(row[k]) : row[k] === v,
    );
  const matchPayment = (where: Row) => payments.find((p) => matches(p, where));

  const prisma = {
    subscriptionPlan: {
      findUnique: async ({ where }: any) => plans.find((p) => p.slug === where.slug) ?? null,
    },
    subscription: {
      findUnique: async ({ where }: any) => {
        const sub = subscriptions.find((s) => s.userId === where.userId);
        if (!sub) return null;
        return { ...sub, plan: plans.find((p) => p.id === sub.planId) };
      },
      upsert: async ({ where, create, update }: any) => {
        log.push('subscription.upsert');
        const existing = subscriptions.find((s) => s.userId === where.userId);
        if (existing) Object.assign(existing, update);
        else subscriptions.push({ id: `sub_${++seq}`, ...create });
        const sub = subscriptions.find((s) => s.userId === where.userId)!;
        return { ...sub, plan: plans.find((p) => p.id === sub.planId) };
      },
    },
    payment: {
      findUnique: async ({ where }: any) => {
        log.push('read');
        const row = matchPayment(where);
        return row ? { ...row } : null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = matchPayment(where);
        if (!row) throw new Error('not found');
        return { ...row };
      },
      create: async ({ data }: any) => {
        const row = {
          id: `pay_row_${++seq}`,
          razorpayPaymentId: null,
          razorpaySignature: null,
          paidAt: null,
          ...data,
        };
        payments.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = matchPayment(where);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return { ...row };
      },
      // Like a single conditional UPDATE in Postgres: the filter is evaluated
      // and applied in one step, with no await in between.
      updateMany: async ({ where, data }: any) => {
        const rows = payments.filter((p) => matches(p, where));
        rows.forEach((r) => Object.assign(r, data));
        log.push(`updateMany:${rows.length}`);
        return { count: rows.length };
      },
    },
    notification: {
      create: async ({ data }: any) => {
        notifications.push(data);
        return data;
      },
    },
  };

  return { prisma, payments, subscriptions, notifications, log };
}

// ─── Loading the service under a given configuration ──────────────────────

function inject(modulePath: string, exports: unknown): void {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as any;
}

interface FakeRazorpay {
  created: Row[];
  fail?: boolean;
}

function loadPayments(
  vars: Record<string, string | undefined>,
  fakeRazorpay?: FakeRazorpay,
) {
  setEnv(vars);
  for (const mod of ['../config/env', '../config/razorpay', '../modules/payments/service']) {
    delete require.cache[require.resolve(mod)];
  }

  const db = makeDb();
  inject('../config/database', { prisma: db.prisma });
  inject('../modules/subscriptions/plan-config.service', {
    planConfigService: { invalidateCache: async () => undefined },
  });
  inject('../modules/notifications/service', { invalidateUnreadCount: async () => undefined });

  if (fakeRazorpay) {
    // Never contact Razorpay from a unit test: a stand-in client records calls.
    const { AppError } = require('../shared/middleware/error-handler');
    inject('../config/razorpay', {
      isRazorpayConfigured: () => true,
      getRazorpayClient: () => ({
        orders: {
          create: async (order: Row) => {
            if (fakeRazorpay.fail) throw { error: { description: 'Authentication failed' } };
            const created = { id: `order_${crypto.randomBytes(7).toString('hex')}`, ...order };
            fakeRazorpay.created.push(created);
            return created;
          },
        },
      }),
      resetRazorpayClientForTests: () => undefined,
      AppError,
    });
  }

  const service = require('../modules/payments/service');
  return {
    paymentService: service.paymentService,
    isPaymentsDemoMode: service.isPaymentsDemoMode as () => boolean,
    db,
  };
}

async function rejectsWith(promise: Promise<unknown>, code: string, label: string): Promise<void> {
  await assert.rejects(promise, (err: any) => {
    assert.equal(err?.code, code, `${label}: expected ${code}, got ${err?.code} (${err?.message})`);
    return true;
  });
}

function signatureFor(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

async function main(): Promise<void> {
  // 1. Off by default.
  {
    setEnv({});
    delete require.cache[require.resolve('../config/env')];
    const { envSchema, validatePaymentsDemoMode } = require('../config/env');
    const parsed = envSchema.parse({});
    assert.equal(parsed.PAYMENTS_DEMO_MODE, 'false', 'PAYMENTS_DEMO_MODE must default to false');
    assert.deepEqual(validatePaymentsDemoMode({}), []);

    const { isPaymentsDemoMode } = loadPayments({ ...PROD_BASE, DATABASE_URL: DEMO_DB, DEMO_DEPLOYMENT: 'tenderbazaar-demo' });
    assert.equal(isPaymentsDemoMode(), false, 'the demo marker alone must not enable demo payments');
    console.log('✓ Demo payments are off unless PAYMENTS_DEMO_MODE=true');
  }

  // 2. Refused outside the isolated demo deployment — the server will not start.
  {
    const { envSchema, validatePaymentsDemoMode, databaseNameOf } = require('../config/env');
    const ok = { PAYMENTS_DEMO_MODE: 'true', DEMO_DEPLOYMENT: 'tenderbazaar-demo', DATABASE_URL: DEMO_DB };
    assert.deepEqual(validatePaymentsDemoMode(ok), [], 'the demo deployment is accepted');

    const cases: Array<[string, Record<string, string>]> = [
      ['no deployment marker', { ...ok, DEMO_DEPLOYMENT: '' }],
      ['wrong deployment marker', { ...ok, DEMO_DEPLOYMENT: 'tenderbazaar' }],
      ['production database', { ...ok, DATABASE_URL: REAL_DB }],
      ['look-alike database', { ...ok, DATABASE_URL: `${DEMO_DB}_copy` }],
      ['database name only in a parameter', { ...ok, DATABASE_URL: `${REAL_DB}?x=/tenderbazaar_demo` }],
      ['Razorpay key id present', { ...ok, RAZORPAY_KEY_ID: TEST_KEY_ID }],
      ['Razorpay secret present', { ...ok, RAZORPAY_KEY_SECRET: TEST_KEY_SECRET }],
    ];
    for (const [label, input] of cases) {
      assert.ok(validatePaymentsDemoMode(input).length > 0, `${label} must be refused`);
    }

    assert.equal(databaseNameOf(DEMO_DB), 'tenderbazaar_demo');
    assert.equal(databaseNameOf(`${DEMO_DB}?schema=public`), 'tenderbazaar_demo');
    assert.equal(databaseNameOf('not a url'), null);

    // Startup: the env schema itself fails, in every NODE_ENV.
    for (const nodeEnv of ['production', 'development', 'test']) {
      const result = envSchema.safeParse({
        ...PROD_BASE,
        NODE_ENV: nodeEnv,
        DATABASE_URL: REAL_DB,
        PAYMENTS_DEMO_MODE: 'true',
        DEMO_DEPLOYMENT: 'tenderbazaar-demo',
      });
      assert.equal(result.success, false, `${nodeEnv}: demo mode against a non-demo database must fail startup`);
      const messages = result.success ? '' : JSON.stringify(result.error.issues);
      assert.ok(!messages.includes('unit-test-db-pass'), 'startup errors must not contain secret values');
    }
    const accepted = envSchema.safeParse({ ...DEMO_ENV, PAYMENTS_DEMO_MODE: 'true' });
    assert.equal(accepted.success, true, 'the demo deployment configuration must start');

    // Defence in depth: the service re-checks even if startup were bypassed.
    const svc = loadPayments(DEMO_ENV);
    assert.equal(svc.isPaymentsDemoMode(), true);
    console.log('✓ Demo payments are refused at startup outside the isolated demo deployment');
  }

  // 3–4. Demo checkout: order → explicit confirmation → active subscription.
  {
    const { paymentService, db } = loadPayments(DEMO_ENV);

    const order = await paymentService.createOrder('user_a', 'starter', 'MONTHLY');
    assert.equal(order.paymentMode, 'demo');
    assert.equal(order.isSimulated, true);
    assert.match(order.orderId, /^order_demo_[0-9a-f]{16}$/);
    assert.equal(db.payments[0].status, 'PENDING', 'creating a demo order takes no payment');
    assert.equal(db.subscriptions.length, 0, 'creating a demo order activates nothing');

    // The real verification endpoint never completes a demo order.
    await rejectsWith(
      paymentService.verifyPayment('user_a', order.orderId, 'pay_mock_1', 'sig_mock_1'),
      'DEMO_ORDER',
      'fake signature on a demo order',
    );
    // Another user cannot confirm it.
    await rejectsWith(paymentService.confirmDemoPayment('user_b', order.orderId), 'UNAUTHORIZED', 'other user');
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.subscriptions.length, 0);

    const result = await paymentService.confirmDemoPayment('user_a', order.orderId);
    assert.equal(result.isSimulated, true);
    assert.match(result.message, /no payment was taken/);
    const row = db.payments[0];
    assert.equal(row.status, 'SUCCESS');
    assert.match(row.razorpayPaymentId, /^pay_demo_[0-9a-f]{16}$/, 'demo payments are labelled in the payment id');
    assert.equal(row.razorpaySignature, null, 'no signature is invented for a demo payment');
    assert.ok(row.paidAt instanceof Date);
    assert.equal(db.subscriptions.length, 1);
    assert.equal(db.subscriptions[0].status, 'ACTIVE');
    assert.equal(db.subscriptions[0].planId, 'plan_starter');
    assert.equal(db.subscriptions[0].razorpayOrderId, order.orderId);
    assert.equal(db.notifications[0].data.demo, true, 'the notification marks the demo transaction');

    // Exactly once.
    await rejectsWith(paymentService.confirmDemoPayment('user_a', order.orderId), 'PAYMENT_ALREADY_VERIFIED', 'replay');
    await rejectsWith(paymentService.confirmDemoPayment('user_a', 'order_demo_0000000000000000'), 'PAYMENT_NOT_FOUND', 'unknown order');
    await rejectsWith(paymentService.confirmDemoPayment('user_a', 'order_ABCdef123'), 'NOT_A_DEMO_ORDER', 'real-looking order');

    // A failed payment cannot be confirmed into a subscription.
    const second = await paymentService.createOrder('user_c', 'starter', 'YEARLY');
    db.payments[1].status = 'FAILED';
    await rejectsWith(paymentService.confirmDemoPayment('user_c', second.orderId), 'INVALID_PAYMENT_STATUS', 'failed payment');
    assert.equal(db.subscriptions.filter((s) => s.userId === 'user_c').length, 0);

    // No gateway event can complete a demo order either.
    const third = await paymentService.createOrder('user_d', 'starter', 'MONTHLY');
    await paymentService.handlePaymentCaptured({
      payload: { payment: { entity: { id: 'pay_x', order_id: third.orderId } } },
    });
    assert.equal(db.payments[2].status, 'PENDING');
    assert.equal(db.subscriptions.filter((s) => s.userId === 'user_d').length, 0);

    // Retry also stays in demo mode.
    const retried = await paymentService.retryPayment('user_c', db.payments[1].id);
    assert.equal(retried.paymentMode, 'demo');
    assert.match(retried.orderId, /^order_demo_/);

    // H1 under demo mode (whose Razorpay secret is empty by requirement): a
    // legacy non-demo row cannot be completed with an empty-key HMAC.
    db.payments.push({
      id: 'legacy_failed', userId: 'user_a', status: 'FAILED', amount: 11798.82,
      razorpayOrderId: 'order_mock_aabbccddeeff0011', planSlug: 'starter', billingCycle: 'YEARLY',
    });
    const subsBefore = db.subscriptions.length;
    await rejectsWith(
      paymentService.verifyPayment(
        'user_a', 'order_mock_aabbccddeeff0011', 'pay_forged_2',
        signatureFor('order_mock_aabbccddeeff0011', 'pay_forged_2', ''),
      ),
      'PAYMENTS_NOT_CONFIGURED',
      'empty-key HMAC in demo mode',
    );
    assert.equal(db.payments.find((p) => p.id === 'legacy_failed')!.status, 'FAILED');
    assert.equal(db.subscriptions.length, subsBefore);
    console.log('✓ Demo checkout activates the subscription only via the owner\'s single confirmation');
  }

  // 5–6. Real-payment mode without credentials: clear errors, no fake orders,
  //      and nothing the client sends can complete a payment.
  {
    const { paymentService, db } = loadPayments({ ...PROD_BASE, DATABASE_URL: REAL_DB });

    await rejectsWith(paymentService.createOrder('user_a', 'starter', 'MONTHLY'), 'PAYMENTS_NOT_CONFIGURED', 'checkout');
    assert.equal(db.payments.length, 0, 'no payment row (and no mock order) is created');

    // Forged demo order and forged demo flags.
    db.payments.push({
      id: 'forged_demo', userId: 'user_a', status: 'PENDING', amount: 1768.82,
      razorpayOrderId: 'order_demo_00112233445566ff', planSlug: 'starter', billingCycle: 'MONTHLY',
    });
    await rejectsWith(
      paymentService.confirmDemoPayment('user_a', 'order_demo_00112233445566ff'),
      'DEMO_PAYMENTS_DISABLED',
      'demo confirmation while demo mode is off',
    );

    // Legacy mock order + fabricated success: refused before any signature is
    // considered, and nothing is mutated.
    db.payments.push({
      id: 'legacy_mock', userId: 'user_a', status: 'PENDING', amount: 1768.82,
      razorpayOrderId: 'order_mock_00112233445566ff', planSlug: 'starter', billingCycle: 'MONTHLY',
    });
    await rejectsWith(
      paymentService.verifyPayment('user_a', 'order_mock_00112233445566ff', 'pay_mock_123', 'sig_mock_123'),
      'PAYMENTS_NOT_CONFIGURED',
      'fabricated mock success',
    );
    assert.equal(db.payments.find((p) => p.id === 'legacy_mock')!.status, 'PENDING', 'state is not mutated');

    // H1: an HMAC keyed with the EMPTY secret is computable by anyone. It must
    // not verify — for PENDING, FAILED (legacy rows on the demo server) or
    // REFUNDED rows — and must leave payment and subscription state untouched.
    for (const status of ['PENDING', 'FAILED', 'REFUNDED']) {
      const orderId = `order_mock_h1${status.toLowerCase().padEnd(8, '0').slice(0, 8)}`;
      db.payments.push({
        id: `h1_${status}`, userId: 'user_a', status, amount: 11798.82,
        razorpayOrderId: orderId, planSlug: 'starter', billingCycle: 'YEARLY',
      });
      const before = db.log.length;
      await assert.rejects(
        paymentService.verifyPayment('user_a', orderId, 'pay_forged_1', signatureFor(orderId, 'pay_forged_1', '')),
        (err: any) => {
          // REFUNDED is refused even earlier, by the status rule (H2).
          const expected = status === 'REFUNDED' ? 'INVALID_PAYMENT_STATUS' : 'PAYMENTS_NOT_CONFIGURED';
          assert.equal(err.code, expected, `${status}: forged empty-key HMAC`);
          if (expected === 'PAYMENTS_NOT_CONFIGURED') assert.equal(err.statusCode, 503);
          return true;
        },
      );
      const row = db.payments.find((p) => p.id === `h1_${status}`)!;
      assert.equal(row.status, status, `${status}: payment state unchanged`);
      assert.equal(row.razorpayPaymentId, undefined, `${status}: no payment id recorded`);
      assert.ok(
        !db.log.slice(before).some((op) => op.startsWith('updateMany') || op === 'subscription.upsert'),
        `${status}: no write of any kind`,
      );
    }

    // Unverifiable webhooks are refused, not processed.
    const forgedCapture = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_forged', order_id: 'order_demo_00112233445566ff' } } },
    });
    await rejectsWith(paymentService.handleWebhook(forgedCapture, 'anything'), 'WEBHOOKS_NOT_CONFIGURED', 'unsigned webhook');
    assert.equal(db.subscriptions.length, 0, 'no forged path activated a subscription');

    // A browser-supplied flag is not part of the checkout contract at all.
    const { checkoutSchema, demoConfirmSchema } = require('../modules/payments/validation');
    const parsed = checkoutSchema.parse({ planSlug: 'starter', billingCycle: 'MONTHLY', paymentMode: 'demo', demo: true });
    assert.deepEqual(Object.keys(parsed).sort(), ['billingCycle', 'planSlug'], 'client flags are stripped');
    assert.equal(demoConfirmSchema.safeParse({ orderId: 'order_ABCdef123' }).success, false);
    assert.equal(demoConfirmSchema.safeParse({ orderId: 'order_demo_00112233445566ff' }).success, true);
    console.log('✓ Without credentials: 503 and no fake order; forged demo/mock data cannot complete a payment');
  }

  // Whitespace-only credentials are missing credentials. Untrimmed, '   ' read
  // as "configured" while being a key anyone can guess, so an HMAC keyed with
  // it (or with '') could have "verified" a payment or a webhook.
  {
    const { envSchema } = require('../config/env');
    const parsed = envSchema.parse({ RAZORPAY_KEY_ID: '  ', RAZORPAY_KEY_SECRET: '\t', RAZORPAY_WEBHOOK_SECRET: ' \n ' });
    assert.equal(parsed.RAZORPAY_KEY_ID, '', 'whitespace key id parses as empty');
    assert.equal(parsed.RAZORPAY_KEY_SECRET, '', 'whitespace key secret parses as empty');
    assert.equal(parsed.RAZORPAY_WEBHOOK_SECRET, '', 'whitespace webhook secret parses as empty');
    const padded = envSchema.parse({ RAZORPAY_KEY_ID: ` ${TEST_KEY_ID}\n`, RAZORPAY_KEY_SECRET: `${TEST_KEY_SECRET} ` });
    assert.equal(padded.RAZORPAY_KEY_ID, TEST_KEY_ID, 'a real value keeps its content');
    assert.equal(padded.RAZORPAY_KEY_SECRET, TEST_KEY_SECRET);

    const combos: Array<[string, Record<string, string>]> = [
      ['whitespace key id and secret', { RAZORPAY_KEY_ID: '   ', RAZORPAY_KEY_SECRET: ' \t ' }],
      ['real-looking key id, whitespace secret', { RAZORPAY_KEY_ID: TEST_KEY_ID, RAZORPAY_KEY_SECRET: '   ' }],
      ['whitespace key id, real-looking secret', { RAZORPAY_KEY_ID: '   ', RAZORPAY_KEY_SECRET: TEST_KEY_SECRET }],
    ];
    for (const [label, keys] of combos) {
      // A HALF-configured pair is refused at startup (config/env.ts,
      // validateDeploymentEnvironment): the production server never comes up,
      // so no request can reach the payment paths at all.
      const partial = (keys.RAZORPAY_KEY_ID.trim() === '') !== (keys.RAZORPAY_KEY_SECRET.trim() === '');
      if (partial) {
        assert.throws(
          () => loadPayments({ ...PROD_BASE, DATABASE_URL: REAL_DB, ...keys, RAZORPAY_WEBHOOK_SECRET: '   ' }),
          /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET: set both/,
          `${label}: production must refuse to start on half a Razorpay configuration`,
        );
        continue;
      }

      const { paymentService, db } = loadPayments({
        ...PROD_BASE,
        DATABASE_URL: REAL_DB,
        ...keys,
        RAZORPAY_WEBHOOK_SECRET: '   ',
      });
      assert.equal(require('../config/razorpay').isRazorpayConfigured(), false, `${label}: not configured`);

      // No order, real or fake.
      await rejectsWith(paymentService.createOrder('user_ws', 'starter', 'MONTHLY'), 'PAYMENTS_NOT_CONFIGURED', `${label}: checkout`);
      assert.equal(db.payments.length, 0, `${label}: no payment row`);

      // Forged HMACs keyed with '' or with the whitespace value itself.
      db.payments.push({
        id: 'ws_row', userId: 'user_ws', status: 'PENDING', amount: 1768.82,
        razorpayOrderId: 'order_ws_0011223344', planSlug: 'starter', billingCycle: 'MONTHLY',
      });
      for (const key of ['', '   ', ' \t ', keys.RAZORPAY_KEY_SECRET]) {
        await rejectsWith(
          paymentService.verifyPayment('user_ws', 'order_ws_0011223344', 'pay_ws', signatureFor('order_ws_0011223344', 'pay_ws', key)),
          'PAYMENTS_NOT_CONFIGURED',
          `${label}: HMAC keyed with ${JSON.stringify(key)}`,
        );
      }
      assert.equal(db.payments[0].status, 'PENDING', `${label}: payment untouched`);
      assert.equal(db.subscriptions.length, 0, `${label}: nothing activated`);
      assert.ok(!db.log.some((op) => op.startsWith('updateMany') || op === 'subscription.upsert'), `${label}: no writes`);

      // Whitespace webhook secret: refused, even with a body signed by '' or the whitespace value.
      const capture = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_ws', order_id: 'order_ws_0011223344' } } },
      });
      for (const key of ['', '   ']) {
        const forged = crypto.createHmac('sha256', key).update(capture).digest('hex');
        await rejectsWith(paymentService.handleWebhook(capture, forged), 'WEBHOOKS_NOT_CONFIGURED', `${label}: webhook keyed with ${JSON.stringify(key)}`);
      }
      assert.equal(db.payments[0].status, 'PENDING');
    }

    // Demo mode with whitespace keys: startup still accepts it (they are
    // empty), and a legacy non-demo row still cannot be verified.
    const { paymentService: demoService, db: demoDb, isPaymentsDemoMode } = loadPayments({
      ...DEMO_ENV,
      RAZORPAY_KEY_ID: '  ',
      RAZORPAY_KEY_SECRET: '  ',
    });
    assert.equal(isPaymentsDemoMode(), true);
    demoDb.payments.push({
      id: 'ws_legacy', userId: 'user_ws', status: 'FAILED', amount: 1768.82,
      razorpayOrderId: 'order_mock_ws00112233', planSlug: 'starter', billingCycle: 'MONTHLY',
    });
    await rejectsWith(
      demoService.verifyPayment('user_ws', 'order_mock_ws00112233', 'pay_ws', signatureFor('order_mock_ws00112233', 'pay_ws', '  ')),
      'PAYMENTS_NOT_CONFIGURED',
      'demo mode: HMAC keyed with whitespace',
    );
    assert.equal(demoDb.payments[0].status, 'FAILED');
    assert.equal(demoDb.subscriptions.length, 0);
    console.log('✓ Whitespace-only credentials are missing credentials: forged HMACs fail, and a half-configured pair cannot even start');
  }

  // 7–8. Real Razorpay mode: orders are created by the gateway, only a valid
  //      HMAC activates, and gateway failure is an error — not a mock order.
  {
    const fake: FakeRazorpay = { created: [] };
    const { paymentService, db } = loadPayments(
      { ...PROD_BASE, DATABASE_URL: REAL_DB, RAZORPAY_KEY_ID: TEST_KEY_ID, RAZORPAY_KEY_SECRET: TEST_KEY_SECRET },
      fake,
    );

    const order = await paymentService.createOrder('user_a', 'starter', 'MONTHLY');
    assert.equal(order.paymentMode, 'razorpay');
    assert.equal(order.isSimulated, false);
    assert.equal(fake.created.length, 1);
    assert.equal(order.orderId, fake.created[0].id);
    assert.equal(fake.created[0].amount, Math.round((1499 + 269.82) * 100), 'amount includes GST, in paise');

    // Invalid signatures never activate.
    await rejectsWith(paymentService.verifyPayment('user_a', order.orderId, 'pay_1', 'deadbeef'), 'INVALID_SIGNATURE', 'bad signature');
    assert.equal(db.payments[0].status, 'FAILED');
    assert.equal(db.subscriptions.length, 0);

    // Demo confirmation is unavailable in real mode, even for a demo-shaped id.
    await rejectsWith(paymentService.confirmDemoPayment('user_a', 'order_demo_00112233445566ff'), 'DEMO_PAYMENTS_DISABLED', 'demo in real mode');

    // A valid signature does — for the order's owner only.
    const order2 = await paymentService.createOrder('user_a', 'starter', 'YEARLY');
    const sig = signatureFor(order2.orderId, 'pay_real_1', TEST_KEY_SECRET);
    await rejectsWith(paymentService.verifyPayment('user_b', order2.orderId, 'pay_real_1', sig), 'UNAUTHORIZED', 'other user');
    const verified = await paymentService.verifyPayment('user_a', order2.orderId, 'pay_real_1', sig);
    assert.equal(verified.isSimulated, false);
    assert.equal(db.payments[1].status, 'SUCCESS');
    assert.equal(db.payments[1].razorpaySignature, sig);
    assert.equal(db.subscriptions[0].status, 'ACTIVE');
    assert.equal(db.subscriptions[0].billingCycle, 'YEARLY');
    await rejectsWith(paymentService.verifyPayment('user_a', order2.orderId, 'pay_real_1', sig), 'PAYMENT_ALREADY_VERIFIED', 'replay');

    // Gateway failure: a clear error and no locally minted order.
    fake.fail = true;
    const before = db.payments.length;
    await rejectsWith(paymentService.createOrder('user_e', 'starter', 'MONTHLY'), 'PAYMENT_ORDER_FAILED', 'gateway failure');
    assert.equal(db.payments.length, before, 'no payment row is created when the gateway fails');
    assert.ok(!db.payments.some((p) => String(p.razorpayOrderId).startsWith('order_mock_')));
    console.log('✓ Real mode: gateway orders, HMAC-only activation, owner check, no fallback order');
  }

  // H2: which states may be confirmed, atomic claims, replay and concurrency,
  //     and webhooks with a configured secret.
  {
    const WEBHOOK_SECRET = 'unit-test-webhook-signing-secret';
    const { paymentService, db } = loadPayments(
      {
        ...PROD_BASE,
        DATABASE_URL: REAL_DB,
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      },
      { created: [] },
    );
    const sign = (orderId: string, paymentId: string) => signatureFor(orderId, paymentId, TEST_KEY_SECRET);
    const signWebhook = (body: string) => crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const upserts = () => db.log.filter((op) => op === 'subscription.upsert').length;
    const rowFor = (orderId: string) => db.payments.find((p) => p.razorpayOrderId === orderId)!;
    const captured = (orderId: string, paymentId: string) =>
      JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } });

    // Malformed signatures are mismatches (constant-time compare), never crashes.
    const a = await paymentService.createOrder('user_h2a', 'starter', 'MONTHLY');
    const good = sign(a.orderId, 'pay_h2a');
    for (const bad of ['', 'zz', 'a'.repeat(64), `${good}00`, good.slice(0, 63), good.toUpperCase()]) {
      await rejectsWith(paymentService.verifyPayment('user_h2a', a.orderId, 'pay_h2a', bad), 'INVALID_SIGNATURE', `malformed "${bad.slice(0, 8)}…"`);
    }
    assert.equal(rowFor(a.orderId).status, 'FAILED');
    assert.equal(upserts(), 0, 'no invalid signature activated anything');

    // FAILED stays confirmable (Razorpay allows a retry within the same order)...
    await paymentService.verifyPayment('user_h2a', a.orderId, 'pay_h2a', good);
    assert.equal(rowFor(a.orderId).status, 'SUCCESS');
    assert.equal(upserts(), 1);

    // ...but a replay of the same valid request activates nothing more.
    const notificationsAfterFirst = db.notifications.length;
    await rejectsWith(paymentService.verifyPayment('user_h2a', a.orderId, 'pay_h2a', good), 'PAYMENT_ALREADY_VERIFIED', 'replay');
    assert.equal(upserts(), 1, 'replay does not activate twice');
    assert.equal(db.notifications.length, notificationsAfterFirst);

    // REFUNDED: neither the original valid signature nor a re-delivered,
    // correctly signed capture event can make it successful again.
    const refund = JSON.stringify({
      event: 'refund.processed',
      payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_h2a', amount: 176882 } } },
    });
    await paymentService.handleWebhook(refund, signWebhook(refund));
    assert.equal(rowFor(a.orderId).status, 'REFUNDED');
    await rejectsWith(paymentService.verifyPayment('user_h2a', a.orderId, 'pay_h2a', good), 'INVALID_PAYMENT_STATUS', 'refunded replay');
    const redelivered = captured(a.orderId, 'pay_h2a');
    await paymentService.handleWebhook(redelivered, signWebhook(redelivered));
    assert.equal(rowFor(a.orderId).status, 'REFUNDED', 'a capture event does not revive a refund');
    assert.equal(upserts(), 1, 'nothing re-activated');

    // Webhook signatures are checked (constant-time, malformed-safe).
    await rejectsWith(paymentService.handleWebhook(redelivered, 'deadbeef'), 'INVALID_WEBHOOK_SIGNATURE', 'short webhook signature');
    await rejectsWith(paymentService.handleWebhook(redelivered, signWebhook(`${redelivered} `)), 'INVALID_WEBHOOK_SIGNATURE', 'signature of another body');

    // A correctly signed capture for a demo-shaped order is ignored.
    db.payments.push({
      id: 'demo_row', userId: 'user_h2d', status: 'PENDING', amount: 1768.82,
      razorpayOrderId: 'order_demo_ffeeddccbbaa9988', planSlug: 'starter', billingCycle: 'MONTHLY',
    });
    const demoCapture = captured('order_demo_ffeeddccbbaa9988', 'pay_demo_forged');
    await paymentService.handleWebhook(demoCapture, signWebhook(demoCapture));
    assert.equal(rowFor('order_demo_ffeeddccbbaa9988').status, 'PENDING');
    assert.equal(upserts(), 1);

    // A genuine signed capture still activates a pending real payment.
    const b = await paymentService.createOrder('user_h2b', 'starter', 'MONTHLY');
    const genuine = captured(b.orderId, 'pay_h2b');
    await paymentService.handleWebhook(genuine, signWebhook(genuine));
    assert.equal(rowFor(b.orderId).status, 'SUCCESS');
    assert.equal(upserts(), 2);

    // Concurrent verifications: both pass the status check (two reads before
    // any write), and the conditional claim lets exactly one through.
    const c = await paymentService.createOrder('user_h2c', 'starter', 'MONTHLY');
    const cSig = sign(c.orderId, 'pay_h2c');
    const start = db.log.length;
    const results = await Promise.allSettled([
      paymentService.verifyPayment('user_h2c', c.orderId, 'pay_h2c', cSig),
      paymentService.verifyPayment('user_h2c', c.orderId, 'pay_h2c', cSig),
    ]);
    const paymentOps = db.log.slice(start).filter((op) => op !== 'subscription.upsert');
    assert.deepEqual(paymentOps.slice(0, 2), ['read', 'read'], 'both requests read the PENDING row before either claimed it');
    assert.deepEqual(paymentOps.filter((op) => op.startsWith('updateMany')), ['updateMany:1', 'updateMany:0']);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(loser.reason.code, 'PAYMENT_ALREADY_VERIFIED');
    assert.equal(upserts(), 3, 'exactly one activation');

    // Client verification racing the capture webhook: still one activation.
    const d = await paymentService.createOrder('user_h2e', 'starter', 'MONTHLY');
    const dCapture = captured(d.orderId, 'pay_h2e');
    await Promise.allSettled([
      paymentService.verifyPayment('user_h2e', d.orderId, 'pay_h2e', sign(d.orderId, 'pay_h2e')),
      paymentService.handleWebhook(dCapture, signWebhook(dCapture)),
    ]);
    assert.equal(rowFor(d.orderId).status, 'SUCCESS');
    assert.equal(upserts(), 4, 'verify + webhook race activates once');
    console.log('✓ H2: only PENDING/FAILED confirmable; REFUNDED stays refunded; atomic single activation under replay and races');
  }

  // Development without keys keeps its existing mock checkout, labelled as such.
  {
    const { paymentService } = loadPayments({
      NODE_ENV: 'development',
      RAZORPAY_KEY_ID: undefined,
      RAZORPAY_KEY_SECRET: undefined,
      PAYMENTS_DEMO_MODE: undefined,
    });
    const order = await paymentService.createOrder('user_a', 'starter', 'MONTHLY');
    assert.equal(order.paymentMode, 'dev-mock');
    assert.match(order.orderId, /^order_mock_/);
    console.log('✓ Development mock checkout is unchanged and reported as dev-mock');
  }

  setEnv({});
  console.log('--- All Payments Demo-Mode Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
