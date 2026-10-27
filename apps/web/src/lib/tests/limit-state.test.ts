import assert from 'node:assert/strict';
import { computeLimitState } from '../limit-state';

/**
 * The AI Checks card's numbers (via useLimitGate → computeLimitState).
 *
 * The card used to read `used` from a usage list that the AI Eligibility page
 * never loaded, so an empty list rendered as a confident "0 used" — and the
 * upgrade banner flashed on every load because the unknown plan read as a
 * limit of 0. These cases pin the figures for each loading state and plan
 * boundary. Plan values mirror the seeded plans (Free 1 lifetime, Starter 10
 * and Professional 50 monthly, Enterprise -1 unlimited).
 */

console.log('--- Starting Limit State Tests ---');

const plan = (maxAiChecks: number, aiChecksResetMonthly = true) =>
  ({ name: 'Plan', slug: 'plan', maxAiChecks, aiChecksResetMonthly } as any);
const usage = (used: number, limit: number, resetType: 'monthly' | 'lifetime' = 'monthly') => [
  { feature: 'maxAiChecks', label: 'AI Eligibility Checks', used, limit, resetType, percentage: 0 },
];
const state = (over: Partial<Parameters<typeof computeLimitState>[0]>) =>
  computeLimitState({
    limitName: 'maxAiChecks',
    currentPlan: plan(10),
    usage: usage(0, 10),
    subscriptionStatus: 'loaded',
    usageStatus: 'loaded',
    ...over,
  });

// 1. Loading and error states are never presented as "0 used".
{
  assert.equal(state({ subscriptionStatus: 'unknown', currentPlan: null, usage: [] }).status, 'loading');
  assert.equal(state({ usageStatus: 'unknown', usage: [] }).status, 'loading', 'plan known, usage not yet');
  assert.equal(state({ subscriptionStatus: 'loaded', currentPlan: null }).status, 'loading');
  assert.equal(state({ usageStatus: 'error' }).status, 'error');
  assert.equal(state({ subscriptionStatus: 'error', currentPlan: null }).status, 'error');
  assert.equal(state({}).status, 'ready');
  console.log('✓ loading / error / ready derived from both the plan and the usage');
}

// 2. Used comes from the usage API, limit from the plan.
{
  const s = state({ currentPlan: plan(10), usage: usage(3, 10) });
  assert.deepEqual([s.used, s.limit, s.remaining, s.percentage, s.hasCapacity], [3, 10, 7, 30, true]);
  assert.equal(s.resetType, 'monthly');
  console.log('✓ Starter 3/10: 7 remaining, 30%');
}

// 3. Boundaries: one below, at, and above the limit.
{
  const below = state({ currentPlan: plan(50), usage: usage(49, 50) });
  assert.deepEqual([below.remaining, below.hasCapacity, below.percentage], [1, true, 98]);
  const at = state({ currentPlan: plan(50), usage: usage(50, 50) });
  assert.deepEqual([at.remaining, at.hasCapacity, at.percentage], [0, false, 100]);
  const over = state({ currentPlan: plan(10), usage: usage(12, 10) });
  assert.deepEqual([over.remaining, over.hasCapacity, over.percentage], [0, false, 100], 'capped, never negative or >100%');
  console.log('✓ 49/50, 50/50 and 12/10 boundaries');
}

// 4. Free: lifetime allowance of 1.
{
  const fresh = state({ currentPlan: plan(1, false), usage: usage(0, 1, 'lifetime') });
  assert.deepEqual([fresh.used, fresh.limit, fresh.remaining, fresh.hasCapacity, fresh.resetType], [0, 1, 1, true, 'lifetime']);
  const spent = state({ currentPlan: plan(1, false), usage: usage(1, 1, 'lifetime') });
  assert.deepEqual([spent.remaining, spent.hasCapacity, spent.percentage], [0, false, 100]);
  console.log('✓ Free 0/1 → 1/1 (lifetime)');
}

// 5. Enterprise: unlimited regardless of usage.
{
  const s = state({ currentPlan: plan(-1), usage: usage(500, -1) });
  assert.deepEqual([s.isUnlimited, s.hasCapacity, s.remaining, s.percentage], [true, true, -1, 0]);
  console.log('✓ Enterprise unlimited: capacity always, 0%');
}

// 6. Zero allowance and a missing usage entry once loaded.
{
  const zero = state({ currentPlan: plan(0), usage: usage(0, 0) });
  assert.deepEqual([zero.hasCapacity, zero.percentage, zero.remaining], [false, 100, 0], 'no NaN');
  const none = state({ usage: [] });
  assert.deepEqual([none.status, none.used, none.remaining], ['ready', 0, 10], 'loaded with no entry = nothing used');
  const missingField = state({ currentPlan: { name: 'Plan', slug: 'plan' } as any });
  assert.deepEqual([missingField.limit, missingField.percentage], [0, 100], 'missing plan field is 0, not NaN');
  console.log('✓ zero allowance, missing usage entry, missing plan field');
}

console.log('--- All Limit State Tests Passed ---');
