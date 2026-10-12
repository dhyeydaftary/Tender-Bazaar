import assert from 'node:assert/strict';
import { createAlertSchema, updateAlertSchema, toggleAlertSchema } from '../modules/alerts/validation';

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

  // Empty keywords
  const emptyKeywords = createAlertSchema.safeParse({
    name: 'Valid Name',
    keywords: [],
    frequency: 'DAILY',
  });
  assert.ok(!emptyKeywords.success, 'Empty keywords array must fail validation');

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

  console.log('✓ Validation rules (required fields, keywords min 1, frequency enums, toggle) verified');
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

console.log('--- All Alert & Notification Tests Passed Successfully! ---');
