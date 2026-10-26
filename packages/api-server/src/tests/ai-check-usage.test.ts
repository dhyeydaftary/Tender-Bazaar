import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AI Eligibility "AI Checks" card ↔ what the API actually enforces.
 *
 * The card shows `used / limit` from GET /subscription/usage, which reads the
 * plan's `maxAiChecks` and the subscription counters. The eligibility service
 * used to enforce its own hardcoded limits (Starter 5 while the plan says 10)
 * and count checks in a Redis key nothing else read — so the card showed 0 used
 * forever, against a limit that was not the one enforced.
 *
 * This suite runs the real eligibility service and planConfigService against an
 * in-memory database and pins one contract: after every check, the usage API
 * reports exactly the count and the limit that the next check is judged by.
 * Plan limits are read from prisma/seed.ts — the authoritative definitions —
 * rather than restated here.
 */

console.log('--- Starting AI Check Usage Consistency Tests ---');

// ─── Plan definitions from the seed ─────────────────────────────────────────

const SEED = readFileSync(join(__dirname, '..', '..', '..', '..', 'prisma', 'seed.ts'), 'utf8');

function seededPlan(slug: string) {
  const start = SEED.indexOf(`slug: '${slug}'`);
  assert.ok(start >= 0, `seed defines the ${slug} plan`);
  const block = SEED.slice(start, start + 4000);
  const num = (field: string) => {
    const m = new RegExp(`${field}:\\s*(-?\\d+)`).exec(block);
    assert.ok(m, `${slug}.${field} is seeded`);
    return Number(m![1]);
  };
  const bool = (field: string) => {
    const m = new RegExp(`${field}:\\s*(true|false)`).exec(block);
    assert.ok(m, `${slug}.${field} is seeded`);
    return m![1] === 'true';
  };
  return {
    id: `plan_${slug}`,
    slug,
    name: slug[0].toUpperCase() + slug.slice(1),
    maxAiChecks: num('maxAiChecks'),
    aiChecksResetMonthly: bool('aiChecksResetMonthly'),
    maxAlerts: 0,
    maxSavedTenders: 0,
    maxComparisonTenders: 0,
    isActive: true,
  };
}

const PLANS = ['free', 'starter', 'professional', 'enterprise'].map(seededPlan);
const plan = (slug: string) => PLANS.find((p) => p.slug === slug)!;

// ─── In-memory stand-ins ─────────────────────────────────────────────────────

type Row = Record<string, any>;

function makeDb() {
  const subscriptions: Row[] = [];
  const checks: Row[] = [];
  const apply = (row: Row, data: Row) => {
    for (const [k, v] of Object.entries(data)) {
      row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] ?? 0) + v.increment : v;
    }
  };
  // Equality, plus Prisma's `{ gte: Date }` for the monthly window.
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === 'object' && 'gte' in v ? row[k] instanceof Date && row[k] >= v.gte : row[k] === v,
    );
  const prisma = {
    subscriptionPlan: {
      findUnique: async ({ where }: any) => PLANS.find((p) => p.slug === where.slug) ?? null,
    },
    subscription: {
      findUnique: async ({ where, include }: any) => {
        const s = subscriptions.find((r) => r.userId === where.userId);
        if (!s) return null;
        return include?.plan ? { ...s, plan: PLANS.find((p) => p.id === s.planId) } : { ...s };
      },
      update: async ({ where, data }: any) => {
        const s = subscriptions.find((r) => r.userId === where.userId);
        if (!s) throw new Error('Record to update not found');
        apply(s, data);
        return { ...s };
      },
      updateMany: async ({ where, data }: any) => {
        const rows = subscriptions.filter((r) => matches(r, where));
        rows.forEach((r) => apply(r, data));
        return { count: rows.length };
      },
    },
    eligibilityCheck: {
      count: async ({ where }: any) => checks.filter((c) => matches(c, where)).length,
      upsert: async ({ where, create, update }: any) => {
        const key = where.userId_tenderId;
        const found = checks.find((c) => c.userId === key.userId && c.tenderId === key.tenderId);
        const now = new Date(); // @updatedAt
        if (found) Object.assign(found, update, { updatedAt: now });
        else checks.push({ id: `chk_${checks.length + 1}`, ...create, createdAt: now, updatedAt: now });
        return found ?? checks[checks.length - 1];
      },
    },
    companyProfile: {
      findUnique: async () => ({
        id: 'cp',
        workCategories: ['WORKS'],
        statesOperated: ['Delhi'],
        msmeRegistered: true,
        startupDpiit: false,
        isoRegistered: false,
        isoCertificates: [],
        pastProjectValues: [],
        documents: [],
      }),
    },
    tender: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        title: 'Test tender',
        category: 'WORKS',
        state: 'Delhi',
        reservedForMSME: false,
        reservedForStartups: false,
        requiredCertifications: [],
      }),
    },
    savedTender: { count: async () => 0 },
    alert: { count: async () => 0 },
  };
  return { prisma, subscriptions, checks };
}

function makeRedis() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    setex: async (k: string, _ttl: number, v: string) => void store.set(k, v),
    del: async (...keys: string[]) => keys.forEach((k) => store.delete(k)),
    keys: async (pattern: string) => [...store.keys()].filter((k) => k.startsWith(pattern.replace('*', ''))),
    store,
  };
}

function inject(modulePath: string, exports: unknown): void {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as any;
}

function load() {
  for (const m of [
    '../modules/subscriptions/plan-config.service',
    '../modules/eligibility/service',
  ]) {
    delete require.cache[require.resolve(m)];
  }
  const db = makeDb();
  const redis = makeRedis();
  inject('../config/database', { prisma: db.prisma });
  inject('../config/redis', { __esModule: true, default: redis });
  // The AI service is unreachable: the rule-based fallback answers instead.
  const axios = { post: async () => Promise.reject(new Error('AI service unavailable in tests')) };
  inject(require.resolve('axios'), { __esModule: true, default: axios, ...axios });

  const { planConfigService } = require('../modules/subscriptions/plan-config.service');
  const { eligibilityService } = require('../modules/eligibility/service');
  return { db, redis, planConfigService, eligibilityService };
}

function subscribe(db: ReturnType<typeof makeDb>, userId: string, slug: string, extra: Row = {}) {
  db.subscriptions.push({
    id: `sub_${userId}`,
    userId,
    planId: plan(slug).id,
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 30 * 86400_000),
    aiChecksUsed: 0,
    lifetimeAiChecksUsed: 0,
    ...extra,
  });
}

async function card(planConfigService: any, userId: string) {
  const stats = await planConfigService.getUsageStats(userId);
  return stats.find((s: Row) => s.feature === 'maxAiChecks');
}

async function check(eligibilityService: any, userId: string, tenderId: string) {
  try {
    await eligibilityService.checkEligibility(userId, tenderId);
    return 'ok';
  } catch (err: any) {
    return err.code ?? err.message;
  }
}

const originalWarn = console.warn;
const originalError = console.error;

async function main(): Promise<void> {
  // The fallback path logs a warning per check; keep test output readable.
  console.warn = () => undefined;
  console.error = () => undefined;

  // 0. The seed is the authority, and it defines the agreed allowances:
  //    Free 1/month, Starter 10/month, Professional 50/month, Enterprise unlimited.
  {
    const allowances = PLANS.map((p) => [p.slug, p.maxAiChecks, p.aiChecksResetMonthly]);
    assert.deepEqual(allowances, [
      ['free', 1, true],
      ['starter', 10, true],
      ['professional', 50, true],
      ['enterprise', -1, true],
    ]);
    originalWarn.call(console, `  seeded maxAiChecks: ${PLANS.map((p) => `${p.slug}=${p.maxAiChecks}`).join(', ')} (all monthly)`);
  }

  // 1. Starter (monthly): the card counts every check, shows the seeded limit,
  //    and the check after the limit is refused — at exactly that boundary.
  {
    const { db, planConfigService, eligibilityService } = load();
    subscribe(db, 'u_starter', 'starter');
    const limit = plan('starter').maxAiChecks;

    let c = await card(planConfigService, 'u_starter');
    assert.deepEqual([c.used, c.limit, c.resetType, c.percentage], [0, limit, 'monthly', 0]);

    for (let i = 1; i <= limit; i++) {
      assert.equal(await check(eligibilityService, 'u_starter', `t${i}`), 'ok', `check ${i} of ${limit}`);
      c = await card(planConfigService, 'u_starter');
      assert.equal(c.used, i, `card shows ${i} used after ${i} checks`);
      const gate = await planConfigService.checkLimit('u_starter', 'maxAiChecks');
      assert.deepEqual([gate.used, gate.limit], [c.used, c.limit], 'middleware and card agree');
    }
    assert.equal(c.percentage, 100);
    assert.equal(await check(eligibilityService, 'u_starter', 'over'), 'PLAN_LIMIT_EXCEEDED', 'limit + 1 is refused');
    assert.equal((await card(planConfigService, 'u_starter')).used, limit, 'a refused check is not counted');
    originalWarn.call(console, `✓ Starter: card counts 0→${limit} with each check; check ${limit + 1} refused`);
  }

  // 2. Professional boundary: one below the limit still runs, the limit blocks.
  {
    const { db, planConfigService, eligibilityService } = load();
    const limit = plan('professional').maxAiChecks;
    subscribe(db, 'u_pro', 'professional', { aiChecksUsed: limit - 1, lifetimeAiChecksUsed: limit - 1, aiChecksResetDate: new Date() });
    assert.equal((await card(planConfigService, 'u_pro')).used, limit - 1);
    assert.equal(await check(eligibilityService, 'u_pro', 'a'), 'ok');
    const c = await card(planConfigService, 'u_pro');
    assert.deepEqual([c.used, c.limit], [limit, limit]);
    assert.equal(await check(eligibilityService, 'u_pro', 'b'), 'PLAN_LIMIT_EXCEEDED');
    originalWarn.call(console, `✓ Professional: ${limit - 1}→${limit} allowed, then refused`);
  }

  // 3. Enterprise: unlimited on the card and in enforcement.
  {
    const { db, planConfigService, eligibilityService } = load();
    subscribe(db, 'u_ent', 'enterprise', { aiChecksUsed: 500 });
    for (const t of ['a', 'b', 'c']) assert.equal(await check(eligibilityService, 'u_ent', t), 'ok');
    const c = await card(planConfigService, 'u_ent');
    assert.deepEqual([c.limit, c.percentage], [-1, 0]);
    originalWarn.call(console, '✓ Enterprise: unlimited (limit -1, 0%) and never refused');
  }

  // 4. Free user with no subscription row (every new sign-up): 1 per month,
  //    counted from the checks recorded this month; renews next month.
  {
    const { db, planConfigService, eligibilityService } = load();
    let c = await card(planConfigService, 'u_free');
    assert.deepEqual([c.used, c.limit, c.resetType], [0, 1, 'monthly']);
    assert.equal(await check(eligibilityService, 'u_free', 'a'), 'ok', 'no subscription row: the check is not broken by counting');
    c = await card(planConfigService, 'u_free');
    assert.equal(c.used, 1, 'the free check shows as used');
    assert.equal(await check(eligibilityService, 'u_free', 'b'), 'PLAN_LIMIT_EXCEEDED');
    assert.equal(await check(eligibilityService, 'u_free', 'a'), 'PLAN_LIMIT_EXCEEDED', 're-checking the same tender is refused too');
    assert.equal(db.subscriptions.length, 0, 'no subscription row is created');

    // Next month: last month's check no longer counts.
    db.checks.forEach((r) => (r.updatedAt = new Date(Date.UTC(2000, 0, 15))));
    c = await card(planConfigService, 'u_free');
    assert.equal(c.used, 0, 'allowance renews in a new month');
    assert.equal(await check(eligibilityService, 'u_free', 'b'), 'ok');
    assert.equal(await check(eligibilityService, 'u_free', 'c'), 'PLAN_LIMIT_EXCEEDED');
    originalWarn.call(console, '✓ Free (no subscription row): 1/month, refused at 2, renews next month');
  }

  // 5. Free via an expired paid subscription: the stale paid counter does not
  //    count; this month's recorded checks against Free's 1 do.
  {
    const { db, planConfigService, eligibilityService } = load();
    subscribe(db, 'u_expired', 'professional', {
      endDate: new Date(Date.now() - 86400_000),
      aiChecksUsed: 3,
      aiChecksResetDate: new Date(),
      lifetimeAiChecksUsed: 40,
    });
    let c = await card(planConfigService, 'u_expired');
    assert.deepEqual([c.used, c.limit, c.resetType], [0, 1, 'monthly']);
    assert.equal(await check(eligibilityService, 'u_expired', 'a'), 'ok');
    c = await card(planConfigService, 'u_expired');
    assert.equal(c.used, 1);
    assert.equal(await check(eligibilityService, 'u_expired', 'b'), 'PLAN_LIMIT_EXCEEDED');
    originalWarn.call(console, '✓ Expired paid subscription: Free 1/month shown and enforced');
  }

  // 5b. Monthly rollover for a subscription counter, with no scheduled job:
  //     a counter from an earlier month reads 0 and restarts at 1.
  {
    const { db, planConfigService, eligibilityService } = load();
    const lastMonth = new Date(Date.UTC(2000, 0, 15));
    subscribe(db, 'u_roll', 'starter', { aiChecksUsed: 10, aiChecksResetDate: lastMonth, lifetimeAiChecksUsed: 10 });
    let c = await card(planConfigService, 'u_roll');
    assert.equal(c.used, 0, 'last month\'s 10/10 does not block this month');
    assert.equal(await check(eligibilityService, 'u_roll', 'a'), 'ok');
    const sub = db.subscriptions[0];
    assert.equal(sub.aiChecksUsed, 1, 'counter restarted');
    assert.ok(sub.aiChecksResetDate > lastMonth, 'new window recorded');
    assert.equal(sub.lifetimeAiChecksUsed, 11, 'lifetime total keeps counting');
    c = await card(planConfigService, 'u_roll');
    assert.equal(c.used, 1);
    originalWarn.call(console, '✓ Monthly rollover: previous month 10/10 → this month 0/10 → 1/10');
  }

  // 5c. Free plan with its own active subscription row (e.g. after a downgrade).
  {
    const { db, planConfigService, eligibilityService } = load();
    subscribe(db, 'u_freerow', 'free');
    assert.equal(await check(eligibilityService, 'u_freerow', 'a'), 'ok');
    assert.equal((await card(planConfigService, 'u_freerow')).used, 1);
    assert.equal(await check(eligibilityService, 'u_freerow', 'b'), 'PLAN_LIMIT_EXCEEDED');
    originalWarn.call(console, '✓ Free with an active subscription row: 1/month via its counter');
  }

  // 6. A plan that grants no checks: 100%, never NaN/Infinity.
  {
    const { db, planConfigService } = load();
    const zero = { ...plan('starter'), id: 'plan_zero', slug: 'zero', maxAiChecks: 0 };
    PLANS.push(zero);
    subscribe(db, 'u_zero', 'zero');
    const c = await card(planConfigService, 'u_zero');
    PLANS.pop();
    assert.deepEqual([c.used, c.limit, c.percentage], [0, 0, 100]);
    originalWarn.call(console, '✓ Zero allowance: 0/0 at 100%, no NaN');
  }

  // 7. No second, private counter or limit table remains in the service.
  {
    const src = readFileSync(join(__dirname, '..', 'modules', 'eligibility', 'service.ts'), 'utf8');
    assert.ok(!/PLAN_ELIGIBILITY_LIMITS/.test(src), 'no hardcoded eligibility limits');
    assert.ok(!/eligibility:count:/.test(src), 'no private Redis counter');
    assert.ok(/planConfigService\.checkLimit\(userId, 'maxAiChecks'\)/.test(src), 'limit via planConfigService');
    assert.ok(/planConfigService\.incrementUsage\(userId, 'maxAiChecks'\)/.test(src), 'count via planConfigService');
    originalWarn.call(console, '✓ Eligibility service uses the shared plan limit and counter only');
  }

  console.warn = originalWarn;
  console.error = originalError;
  console.log('--- All AI Check Usage Consistency Tests Passed ---');
}

main().catch((err) => {
  console.warn = originalWarn;
  console.error = originalError;
  console.error(err);
  process.exit(1);
});
