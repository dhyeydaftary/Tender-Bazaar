import assert from 'node:assert/strict';

console.log('--- Starting Subscription Badges Mapping Tests ---');

// Features and minimum plan definitions
const MIN_PLAN_FOR_FEATURE: Record<string, string> = {
  paginationAllowed: 'Starter',
  advancedFilters: 'Starter',
  emailAlerts: 'Starter',
  pushAlerts: 'Starter',
  whatsappAlerts: 'Professional',
  corrigendumAlerts: 'Professional',
  aiChecksResetMonthly: 'Starter',
  aiTenderSummary: 'Starter',
  tenderComparison: 'Professional',
  competitorAnalysis: 'Professional',
  documentDownload: 'Starter',
  bulkDownload: 'Professional',
  exportEnabled: 'Starter',
  tenderCalendar: 'Starter',
  multiLanguage: 'Professional',
  eTenderingSupport: 'Enterprise',
  dedicatedManager: 'Enterprise',
};

// Test plans representing real plan data
const mockPlans = [
  { name: 'Free', slug: 'free', displayOrder: 0, maxAlerts: 0, maxSavedTenders: 0, tenderCalendar: false, tenderComparison: false },
  { name: 'Starter', slug: 'starter', displayOrder: 1, maxAlerts: 5, maxSavedTenders: 50, tenderCalendar: true, tenderComparison: false },
  { name: 'Professional', slug: 'professional', displayOrder: 2, maxAlerts: 25, maxSavedTenders: -1, tenderCalendar: true, tenderComparison: true },
  { name: 'Enterprise', slug: 'enterprise', displayOrder: 3, maxAlerts: -1, maxSavedTenders: -1, tenderCalendar: true, tenderComparison: true },
];

function deriveRequiredPlanForLimit(limitName: string, plans: typeof mockPlans) {
  const sorted = [...plans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return sorted.find((p) => {
    const val = (p as any)[limitName];
    return typeof val === 'number' && val !== 0;
  })?.name ?? null;
}

function computeBadgeVisibility({
  kind,
  name,
  userPlan,
  subscriptionStatus,
  plans,
}: {
  kind: 'feature' | 'limit';
  name: string;
  userPlan: (typeof mockPlans)[0] | null;
  subscriptionStatus: 'idle' | 'loading' | 'loaded' | 'error';
  plans: typeof mockPlans;
}): { showBadge: boolean; requiredPlan: string | null } {
  // If subscription not loaded, show nothing (no guessing)
  if (subscriptionStatus !== 'loaded') return { showBadge: false, requiredPlan: null };

  if (kind === 'feature') {
    const hasAccess = userPlan ? Boolean((userPlan as any)[name]) : false;
    const required = MIN_PLAN_FOR_FEATURE[name] ?? null;
    if (hasAccess || !required) return { showBadge: false, requiredPlan: null };
    return { showBadge: true, requiredPlan: required };
  } else {
    const limit = userPlan ? ((userPlan as any)[name] as number) : 0;
    const hasAccess = limit !== 0; // -1 (unlimited) or >0 grants access
    const required = deriveRequiredPlanForLimit(name, plans);
    if (hasAccess || !required) return { showBadge: false, requiredPlan: null };
    return { showBadge: true, requiredPlan: required };
  }
}

// 1. Navigation item badges for FREE user
{
  const freeUser = mockPlans[0];

  // Tender Calendar -> requires Starter
  const calendarBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderCalendar',
    userPlan: freeUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(calendarBadge.showBadge, true);
  assert.equal(calendarBadge.requiredPlan, 'Starter');

  // Saved Tenders -> requires Starter
  const savedBadge = computeBadgeVisibility({
    kind: 'limit',
    name: 'maxSavedTenders',
    userPlan: freeUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(savedBadge.showBadge, true);
  assert.equal(savedBadge.requiredPlan, 'Starter');

  // My Alerts (when Free has maxAlerts = 0 in current DB) -> requires Starter
  const alertsBadge = computeBadgeVisibility({
    kind: 'limit',
    name: 'maxAlerts',
    userPlan: freeUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(alertsBadge.showBadge, true);
  assert.equal(alertsBadge.requiredPlan, 'Starter');

  // Tender Comparison -> requires Professional
  const compareBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderComparison',
    userPlan: freeUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(compareBadge.showBadge, true);
  assert.equal(compareBadge.requiredPlan, 'Professional');

  console.log('✓ Free user correctly sees: Calendar (Starter), Saved (Starter), Alerts (Starter), Compare (Professional)');
}

// 2. Starter user: should NOT see badges for Calendar, Saved, Alerts
{
  const starterUser = mockPlans[1];

  const calendarBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderCalendar',
    userPlan: starterUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(calendarBadge.showBadge, false, 'Starter user should NOT see badge for Tender Calendar');

  const savedBadge = computeBadgeVisibility({
    kind: 'limit',
    name: 'maxSavedTenders',
    userPlan: starterUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(savedBadge.showBadge, false, 'Starter user should NOT see badge for Saved Tenders');

  const alertsBadge = computeBadgeVisibility({
    kind: 'limit',
    name: 'maxAlerts',
    userPlan: starterUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(alertsBadge.showBadge, false, 'Starter user should NOT see badge for My Alerts');

  const compareBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderComparison',
    userPlan: starterUser,
    subscriptionStatus: 'loaded',
    plans: mockPlans,
  });
  assert.equal(compareBadge.showBadge, true, 'Starter user DOES see badge for Tender Comparison');
  assert.equal(compareBadge.requiredPlan, 'Professional');

  console.log('✓ Starter user has access to Calendar/Saved/Alerts (no badge), sees badge on Comparison only');
}

// 3. Professional user: should NOT see any upgrade badges on these items
{
  const proUser = mockPlans[2];

  for (const item of [
    { kind: 'feature' as const, name: 'tenderCalendar' },
    { kind: 'limit' as const, name: 'maxSavedTenders' },
    { kind: 'limit' as const, name: 'maxAlerts' },
    { kind: 'feature' as const, name: 'tenderComparison' },
  ]) {
    const badge = computeBadgeVisibility({
      ...item,
      userPlan: proUser,
      subscriptionStatus: 'loaded',
      plans: mockPlans,
    });
    assert.equal(badge.showBadge, false, `Pro user should NOT see badge on ${item.name}`);
  }
  console.log('✓ Professional user sees NO upgrade badges on any of the workspace items');
}

// 4. Loading or unhydrated state (subscriptionStatus !== 'loaded'): NO badges shown
{
  const loadingBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderCalendar',
    userPlan: null,
    subscriptionStatus: 'loading',
    plans: mockPlans,
  });
  assert.equal(loadingBadge.showBadge, false, 'Do not show badge while subscription is loading');

  const errorBadge = computeBadgeVisibility({
    kind: 'feature',
    name: 'tenderCalendar',
    userPlan: null,
    subscriptionStatus: 'error',
    plans: mockPlans,
  });
  assert.equal(errorBadge.showBadge, false, 'Do not guess badge when subscription status is error');
  console.log('✓ Loading or error state handles gracefully without flashing or guessing badges');
}

// 5. If Free plan is updated in DB to grant maxAlerts = 1 (matching seed)
{
  const freeWithAlert = { ...mockPlans[0], maxAlerts: 1 };
  const plansWithFreeAlert = [freeWithAlert, ...mockPlans.slice(1)];

  const badge = computeBadgeVisibility({
    kind: 'limit',
    name: 'maxAlerts',
    userPlan: freeWithAlert,
    subscriptionStatus: 'loaded',
    plans: plansWithFreeAlert,
  });
  assert.equal(badge.showBadge, false, 'When Free has alert allowance, no upgrade badge is shown');
  console.log('✓ Dynamic reflection: if Free plan has maxAlerts > 0, badge automatically disappears');
}

console.log('--- All Subscription Badge Mapping Tests Passed Successfully! ---');
