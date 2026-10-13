import assert from 'node:assert/strict';
import {
  createAlertSchema,
  updateAlertSchema,
  toggleAlertSchema,
  hasAlertFilterCriteria,
  supportedAlertCategories,
  canonicaliseAlertCategory,
  SUPPORTED_ALERT_CATEGORIES,
} from '../modules/alerts/validation';

console.log('--- Starting Alerts & Notification Pipeline Tests ---');

// 1. Validation tests
{
  // Valid alert creation
  const valid = createAlertSchema.safeParse({
    name: 'Road Construction in Gujarat',
    keywords: ['highway', 'road'],
    categories: ['WORKS'],
    states: ['Gujarat'],
    minValue: 1000000,
    maxValue: 50000000,
    frequency: 'DAILY',
    emailEnabled: true,
    pushEnabled: false,
    whatsappEnabled: false,
  });
  assert.ok(valid.success, 'Valid alert creation should succeed');

  // Empty name
  const emptyName = createAlertSchema.safeParse({
    name: '',
    keywords: ['highway'],
    frequency: 'DAILY',
  });
  assert.ok(!emptyName.success, 'Empty name must fail validation');

  /* ── Keywords contract ───────────────────────────────────────────────────
     The original assertion here was `!emptyKeywords.success` — "Empty keywords
     array must fail validation" — written against the earlier
     `keywords: z.array(z.string().min(1)).min(1)` schema.

     That assertion is incompatible with category-only alerts. The create
     dialog (apps/web/src/app/(dashboard)/alerts/page.tsx) submits
     `keywords: finalKeywords` with whatever the user entered — frequently
     nothing, because choosing a category alone is a supported way to build an
     alert, and the dialog even derives the alert's name from the category in
     that case (`${category} Tenders`). Server-side,
     `buildTenderWhereClause` adds the keyword clause only when
     `keywords.length > 0`, so a keyword-less alert is a well-defined
     category/state/value filter. Requiring an array-level min(1) therefore
     rejected a flow the product offers, returning 400 for every
     category-only alert.

     The array-level requirement is gone; element-level strictness is not. ── */

  // (a) Omitted entirely — the category-only path.
  const noKeywords = createAlertSchema.safeParse({
    name: 'Category Only Alert',
    categories: ['WORKS'],
    frequency: 'DAILY',
  });
  assert.ok(noKeywords.success, 'Alert with no keywords field must be accepted');
  assert.deepEqual(
    noKeywords.success && noKeywords.data.keywords,
    [],
    'Omitted keywords must default to an empty array',
  );

  // (b) Explicit empty array — equivalent to omitting it.
  const emptyKeywords = createAlertSchema.safeParse({
    name: 'Valid Name',
    keywords: [],
    // A co-filter is required: an alert with NO filter at all is rejected
    // separately (see section 6), which would otherwise mask what this checks.
    categories: ['WORKS'],
    frequency: 'DAILY',
  });
  assert.ok(emptyKeywords.success, 'Explicit empty keywords array must be accepted');
  assert.deepEqual(
    emptyKeywords.success && emptyKeywords.data.keywords,
    [],
    'An empty array must survive validation as an empty array',
  );

  // (c) Valid non-empty keywords are preserved in order, and trimmed.
  const withKeywords = createAlertSchema.safeParse({
    name: 'Valid Name',
    keywords: ['highway', '  road  ', 'bridge'],
    frequency: 'DAILY',
  });
  assert.ok(withKeywords.success, 'Non-empty keywords must be accepted');
  assert.deepEqual(
    withKeywords.success && withKeywords.data.keywords,
    ['highway', 'road', 'bridge'],
    'Keywords must be preserved in order and trimmed',
  );

  // (d) Malformed keyword input must still be rejected. A blank entry is the
  //     dangerous one: `contains: ''` matches every tender, which would turn
  //     the alert into a notify-on-everything subscription.
  const malformedKeywords: Array<[string, unknown]> = [
    ['blank string', ['']],
    ['whitespace only', ['   ']],
    ['blank among valid', ['highway', '']],
    ['non-string element', [123]],
    ['null element', [null]],
    ['object element', [{ term: 'highway' }]],
    ['nested array', [['highway']]],
    ['string instead of array', 'highway'],
    ['null instead of array', null],
    ['number instead of array', 7],
  ];

  for (const [label, keywords] of malformedKeywords) {
    const result = createAlertSchema.safeParse({
      name: 'Valid Name',
      keywords,
      // Carries a valid category so the only possible cause of failure is the
      // malformed keywords themselves, not the missing-filter refinement.
      categories: ['WORKS'],
      frequency: 'DAILY',
    });
    assert.ok(!result.success, `Malformed keywords (${label}) must fail validation`);

    const onKeywords = result.success
      ? false
      : result.error.issues.some((i) => i.path[0] === 'keywords');
    assert.ok(onKeywords, `Malformed keywords (${label}) must be reported on the keywords path`);
  }

  // The same contract holds on update, where keywords may be omitted to leave
  // them unchanged or emptied to drop back to a category-only alert.
  assert.ok(
    updateAlertSchema.safeParse({ name: 'Renamed' }).success,
    'Update without keywords must be accepted',
  );
  assert.ok(
    updateAlertSchema.safeParse({ keywords: [] }).success,
    'Update clearing keywords must be accepted',
  );
  assert.ok(
    !updateAlertSchema.safeParse({ keywords: [''] }).success,
    'Update with a blank keyword must fail validation',
  );

  // Invalid frequency
  const invalidFreq = createAlertSchema.safeParse({
    name: 'Valid Name',
    keywords: ['road'],
    frequency: 'MONTHLY',
  });
  assert.ok(!invalidFreq.success, 'Invalid frequency must fail validation');

  // Toggle schema
  const validToggle = toggleAlertSchema.safeParse({ isActive: false });
  assert.ok(validToggle.success, 'Valid toggle schema should succeed');

  const invalidToggle = toggleAlertSchema.safeParse({ isActive: 'no' });
  assert.ok(!invalidToggle.success, 'Invalid toggle type must fail');

  console.log('✓ Validation rules verified: keywords optional (omitted/empty accepted for category-only alerts), malformed and blank keywords rejected, frequency enums, toggle');
}

// 2. Frequency and cadence rules
{
  const HOUR_MS = 60 * 60 * 1000;
  const CADENCE_MS: Record<string, number> = {
    INSTANT: HOUR_MS,
    DAILY: 24 * HOUR_MS,
    WEEKLY: 7 * 24 * HOUR_MS,
  };

  assert.equal(CADENCE_MS.INSTANT, 3600000, 'INSTANT cadence is exactly 1 hour');
  assert.equal(CADENCE_MS.DAILY, 86400000, 'DAILY cadence is exactly 24 hours');
  assert.equal(CADENCE_MS.WEEKLY, 604800000, 'WEEKLY cadence is exactly 7 days');
  console.log('✓ Alert frequency cadence matches product definitions (1h, 24h, 7d)');
}

// 3. Channel entitlement logic
{
  function isChannelAllowed(
    channel: 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS',
    alertOpts: { emailEnabled: boolean; pushEnabled: boolean; whatsappEnabled: boolean; smsEnabled: boolean },
    userPrefs: { emailEnabled: boolean; pushEnabled: boolean; whatsappEnabled: boolean; smsEnabled: boolean },
    plan: { emailAlerts: boolean; pushAlerts: boolean; whatsappAlerts: boolean },
    user: { email: string | null; phone: string | null },
    fcmToken: string | null,
  ): boolean {
    switch (channel) {
      case 'EMAIL':
        return alertOpts.emailEnabled && userPrefs.emailEnabled && plan.emailAlerts && !!user.email;
      case 'PUSH':
        return alertOpts.pushEnabled && userPrefs.pushEnabled && plan.pushAlerts && !!fcmToken;
      case 'WHATSAPP':
        return alertOpts.whatsappEnabled && userPrefs.whatsappEnabled && plan.whatsappAlerts && !!user.phone;
      case 'SMS':
        return alertOpts.smsEnabled && userPrefs.smsEnabled && !!user.phone;
    }
  }

  // Free user (emailAlerts=false, pushAlerts=false, whatsappAlerts=false)
  const freePlan = { emailAlerts: false, pushAlerts: false, whatsappAlerts: false };
  const alertOpts = { emailEnabled: true, pushEnabled: true, whatsappEnabled: true, smsEnabled: true };
  const userPrefs = { emailEnabled: true, pushEnabled: true, whatsappEnabled: true, smsEnabled: true };
  const user = { email: 'user@example.com', phone: '+919876543210' };

  assert.equal(
    isChannelAllowed('EMAIL', alertOpts, userPrefs, freePlan, user, 'token123'),
    false,
    'Free plan should not deliver email alerts when plan disallows it',
  );
  assert.equal(
    isChannelAllowed('WHATSAPP', alertOpts, userPrefs, freePlan, user, 'token123'),
    false,
    'Free plan should not deliver WhatsApp alerts when plan disallows it',
  );

  // Paid user (emailAlerts=true, pushAlerts=true, whatsappAlerts=true)
  const proPlan = { emailAlerts: true, pushAlerts: true, whatsappAlerts: true };
  assert.equal(
    isChannelAllowed('EMAIL', alertOpts, userPrefs, proPlan, user, 'token123'),
    true,
    'Pro plan delivers email alerts when all conditions are met',
  );
  assert.equal(
    isChannelAllowed('WHATSAPP', alertOpts, userPrefs, proPlan, user, 'token123'),
    true,
    'Pro plan delivers WhatsApp alerts when all conditions are met',
  );
  assert.equal(
    isChannelAllowed('PUSH', alertOpts, userPrefs, proPlan, user, null),
    false,
    'Push alerts require a valid session FCM token',
  );
  console.log('✓ Channel entitlement rules enforce plan restrictions and user preferences strictly');
}

// 4. Deduplication simulation
{
  const existingNotifications = [
    { data: { tenderId: 'tender-1', alertId: 'alert-1' } },
    { data: { tenderId: 'tender-2', alertId: 'alert-1' } },
  ];

  const matchingTenders = [
    { id: 'tender-1', title: 'Tender 1', organization: 'Org A' },
    { id: 'tender-2', title: 'Tender 2', organization: 'Org B' },
    { id: 'tender-3', title: 'Tender 3', organization: 'Org C' },
  ];

  const alreadyNotifiedTenderIds = new Set(
    existingNotifications.map((n) => n.data.tenderId),
  );

  const newMatchingTenders = matchingTenders.filter(
    (t) => !alreadyNotifiedTenderIds.has(t.id),
  );

  assert.equal(newMatchingTenders.length, 1, 'Only unnotified tender-3 should be notified');
  assert.equal(newMatchingTenders[0].id, 'tender-3');
  console.log('✓ Deduplication filters out previously notified tenders for the same alert');
}

// 5. Disabled alert filtering
{
  const allAlerts = [
    { id: 'alert-1', isActive: true, frequency: 'DAILY' },
    { id: 'alert-2', isActive: false, frequency: 'DAILY' },
    { id: 'alert-3', isActive: true, frequency: 'WEEKLY' },
  ];

  const activeDailyAlerts = allAlerts.filter(
    (a) => a.isActive && a.frequency === 'DAILY',
  );

  assert.equal(activeDailyAlerts.length, 1);
  assert.equal(activeDailyAlerts[0].id, 'alert-1');
  console.log('✓ Disabled alerts and mismatched frequencies are strictly excluded from matching');
}

// 6. Unbounded alerts are rejected; every single-filter alert still works
{
  const base = { name: 'Filter Test', frequency: 'DAILY' as const };

  // Each of these narrows the tender set, so each must be accepted on its own.
  // These mirror the branches of buildTenderWhereClause one-for-one.
  const singleFilterAlerts: Array<[string, Record<string, unknown>]> = [
    ['category-only', { categories: ['WORKS'] }],
    ['keyword-only', { keywords: ['highway'] }],
    ['state-only', { states: ['Gujarat'] }],
    ['value-range-only (both bounds)', { minValue: 100000, maxValue: 5000000 }],
    ['value-range-only (min only)', { minValue: 100000 }],
    ['value-range-only (max only)', { maxValue: 5000000 }],
    ['min of zero is a real bound', { minValue: 0 }],
    ['organization-only', { organizations: ['NHAI'] }],
    ['tender-type-only', { tenderTypes: ['OPEN'] }],
  ];

  for (const [label, filters] of singleFilterAlerts) {
    const result = createAlertSchema.safeParse({ ...base, ...filters });
    assert.ok(result.success, `A ${label} alert must be accepted`);
  }

  // A completely unfiltered alert matches every ACTIVE tender, so it is
  // rejected rather than silently subscribing the user to the whole catalogue.
  const emptyVariants: Array<[string, Record<string, unknown>]> = [
    ['no filter fields at all', {}],
    ['all arrays explicitly empty', { keywords: [], categories: [], states: [] }],
    ['empty arrays incl. org/type', {
      keywords: [],
      categories: [],
      states: [],
      organizations: [],
      tenderTypes: [],
    }],
    ['channels set but no filters', {
      keywords: [],
      emailEnabled: true,
      pushEnabled: true,
    }],
  ];

  for (const [label, filters] of emptyVariants) {
    const result = createAlertSchema.safeParse({ ...base, ...filters });
    assert.ok(!result.success, `An alert with ${label} must be rejected`);

    // The 400 VALIDATION_ERROR details are built from issue.path, so the
    // issue must carry a path the client can display.
    const issue = !result.success
      ? result.error.issues.find((i) => i.path.join('.') === 'filters')
      : undefined;
    assert.ok(issue, `Rejection for "${label}" must be reported on the filters path`);
    assert.match(
      issue!.message,
      /at least one filter/i,
      'The message must say a filter is required',
    );
  }

  console.log('✓ Filter-less alerts rejected; category/keyword/state/value/org/type-only alerts all still accepted');
}

// 7. The same rule holds on update, evaluated against the merged result
{
  // Partial updates that touch no filter must remain valid: the predicate is
  // applied to existing-merged-with-incoming, not to the patch alone.
  assert.equal(
    hasAlertFilterCriteria({ keywords: ['highway'], categories: [], states: [] }),
    true,
    'An existing keyword alert stays valid when only its name changes',
  );

  // Clearing the last remaining filter is what the update guard must catch.
  assert.equal(
    hasAlertFilterCriteria({ keywords: [], categories: [], states: [] }),
    false,
    'Stripping every filter must be detected as unbounded',
  );

  assert.equal(
    hasAlertFilterCriteria({ keywords: [], categories: ['WORKS'] }),
    true,
    'Dropping keywords while keeping a category stays valid',
  );

  assert.equal(
    hasAlertFilterCriteria({ minValue: null, maxValue: null, keywords: [] }),
    false,
    'Null value bounds do not count as filters',
  );

  assert.equal(
    hasAlertFilterCriteria({ minValue: 0 }),
    true,
    'A zero minimum is an explicit bound, not an absent one',
  );

  // Schema-level: omitting keywords on update leaves them unchanged and must
  // not itself be treated as removing a filter.
  assert.ok(
    updateAlertSchema.safeParse({ name: 'Renamed Only' }).success,
    'A name-only update must pass schema validation',
  );

  console.log('✓ Update path preserves partial edits and detects stripping the last filter');
}

// 8. Category values are validated against the canonical TenderCategory list
{
  const base = { name: 'Category Validation', frequency: 'DAILY' as const };

  // The canonical list comes from the Prisma enum, so it must stay in sync
  // with the Tender.category column the matcher compares against.
  assert.deepEqual(
    [...SUPPORTED_ALERT_CATEGORIES].sort(),
    ['CONSULTANCY', 'GOODS', 'SERVICES', 'WORKS'],
    'Supported categories must match the TenderCategory enum',
  );

  // (a) Valid categories, in any casing the UI might send. The alerts dialog
  //     offers 'Works' and uppercases it, so both forms must be accepted and
  //     normalised to the canonical value.
  for (const input of ['WORKS', 'Works', 'works', '  works  ']) {
    const result = createAlertSchema.safeParse({ ...base, categories: [input] });
    assert.ok(result.success, `Category '${input}' must be accepted`);
    assert.deepEqual(
      result.success && result.data.categories,
      ['WORKS'],
      `Category '${input}' must be canonicalised to 'WORKS'`,
    );
  }

  const allValid = createAlertSchema.safeParse({
    ...base,
    categories: ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'],
  });
  assert.ok(allValid.success, 'Every supported category must be accepted together');

  // (b) Unsupported categories are rejected, with the offending index named so
  //     the 400 VALIDATION_ERROR details point at the right element.
  for (const bad of ['BOGUS', 'Construction', 'CIVIL', 'ALL', '']) {
    const result = createAlertSchema.safeParse({ ...base, categories: [bad] });
    assert.ok(!result.success, `Unsupported category '${bad}' must be rejected`);

    const issue = !result.success
      ? result.error.issues.find((i) => i.path[0] === 'categories')
      : undefined;
    assert.ok(issue, `Rejection of '${bad}' must be reported on the categories path`);
    assert.match(
      issue!.message,
      /must be one of/i,
      'The message must name the supported categories',
    );
  }

  // (c) Mixed valid/invalid: one bad value fails the whole write rather than
  //     being silently dropped, which would leave a narrower filter than asked.
  const mixed = createAlertSchema.safeParse({
    ...base,
    categories: ['WORKS', 'BOGUS'],
  });
  assert.ok(!mixed.success, 'A mix of valid and invalid categories must be rejected');
  assert.ok(
    !mixed.success && mixed.error.issues.some((i) => i.path.join('.') === 'categories.1'),
    'The invalid element index must be identified',
  );

  // (d) A category-only alert with a VALID category is still accepted.
  const categoryOnly = createAlertSchema.safeParse({ ...base, categories: ['GOODS'] });
  assert.ok(categoryOnly.success, 'A valid category-only alert must still be accepted');

  // (e) An alert whose ONLY filter is an unsupported category is rejected. This
  //     is the edge case that previously slipped through: the write succeeded,
  //     the matcher dropped the category, and the query matched everything.
  const bogusOnly = createAlertSchema.safeParse({ ...base, categories: ['BOGUS'] });
  assert.ok(!bogusOnly.success, "An alert filtered only by 'BOGUS' must be rejected");

  // (f) Completely empty is still rejected by the filter refinement.
  const empty = createAlertSchema.safeParse({ ...base, categories: [] });
  assert.ok(!empty.success, 'A completely empty alert must still be rejected');

  // (g) The same rules apply on update.
  assert.ok(
    updateAlertSchema.safeParse({ categories: ['services'] }).success,
    'Update with a valid category (any casing) must be accepted',
  );
  assert.ok(
    !updateAlertSchema.safeParse({ categories: ['BOGUS'] }).success,
    'Update with an unsupported category must be rejected',
  );

  console.log('✓ Category values validated against the TenderCategory enum; casing normalised, unsupported rejected');
}

// 9. Legacy stored categories: tolerated on read, never match-everything
{
  // `Alert.categories` is a free-form String[], so rows predating validation
  // can hold anything. Reads must not throw on them.
  assert.deepEqual(
    supportedAlertCategories(['WORKS', 'Construction', 'GOODS']),
    ['WORKS', 'GOODS'],
    'Unsupported legacy values must be ignored, supported ones kept',
  );
  assert.deepEqual(
    supportedAlertCategories(['Construction', 'CIVIL']),
    [],
    'An all-legacy category list yields no usable filter',
  );
  assert.deepEqual(
    supportedAlertCategories(['works', 'WORKS', 'Works']),
    ['WORKS'],
    'Duplicates after canonicalisation are collapsed',
  );
  assert.deepEqual(supportedAlertCategories(undefined), [], 'Absent categories yield []');
  assert.deepEqual(
    supportedAlertCategories([null, 42, 'GOODS'] as unknown as string[]),
    ['GOODS'],
    'Non-string legacy entries are skipped rather than throwing',
  );

  assert.equal(canonicaliseAlertCategory('consultancy'), 'CONSULTANCY');
  assert.equal(canonicaliseAlertCategory('Construction'), null);
  assert.equal(canonicaliseAlertCategory(undefined), null);

  // The filter predicate — which the query builder's safety net uses — must
  // treat an all-unsupported category list as NO filter, so a legacy row is
  // matched against nothing rather than against every active tender.
  assert.equal(
    hasAlertFilterCriteria({ categories: ['BOGUS'] }),
    false,
    'An unsupported-only category list must not count as a filter',
  );
  assert.equal(
    hasAlertFilterCriteria({ categories: ['Construction'], keywords: [] }),
    false,
    'A legacy category with no other filter must not count as a filter',
  );
  assert.equal(
    hasAlertFilterCriteria({ categories: ['BOGUS'], states: ['Gujarat'] }),
    true,
    'A legacy category alongside a real filter is still a valid alert',
  );
  assert.equal(
    hasAlertFilterCriteria({ categories: ['Works'] }),
    true,
    'A lower-cased supported category still counts as a filter',
  );

  console.log('✓ Legacy category values tolerated on read; all-unsupported lists never yield a match-everything query');
}

console.log('--- All Alert & Notification Tests Passed Successfully! ---');
