import assert from 'node:assert/strict';

import { PORTAL_CONFIGS, getPortalConfig, getEnabledPortals, assertTestPortalUrl } from '../config';
import { TEST_PORTAL_KEY } from '../scrapers/test-portal-scraper';
import { getAllScraperClasses } from '../index';
import { buildDefaultSchedules } from '../scheduler/scheduler';

/**
 * Guards the portal registry against drift during deployment work.
 *
 * The audit recorded exactly 13 registered portals and NO GUJRERA scraper.
 * This suite fails if a portal is dropped, renamed away from its scraper class,
 * or invented.
 */

console.log('--- Starting Portal Registry Tests ---');

const EXPECTED_PORTALS: Array<[key: string, name: string, cron: string]> = [
  ['gem', 'GeM', '0 */2 * * *'],
  ['cppp', 'CPPP', '0 */4 * * *'],
  ['eprocure', 'eProcure', '30 */4 * * *'],
  ['gujarat', 'Gujarat', '0 */6 * * *'],
  ['maharashtra', 'Maharashtra', '10 */6 * * *'],
  ['rajasthan', 'Rajasthan', '20 */6 * * *'],
  ['karnataka', 'Karnataka', '30 */6 * * *'],
  ['tamilnadu', 'TamilNadu', '40 */6 * * *'],
  ['up', 'UP', '50 */6 * * *'],
  ['mp', 'MP', '0 1,7,13,19 * * *'],
  ['delhi', 'Delhi', '10 1,7,13,19 * * *'],
  ['kerala', 'Kerala', '20 1,7,13,19 * * *'],
  ['westbengal', 'WestBengal', '30 1,7,13,19 * * *'],
];

// 1. Exactly the 13 expected portals, with their names and cadences intact.
{
  assert.equal(PORTAL_CONFIGS.length, 13, 'There must be exactly 13 registered portals');

  for (const [key, name, cron] of EXPECTED_PORTALS) {
    const portal = getPortalConfig(key);
    assert.ok(portal, `Portal '${key}' must still be registered`);
    assert.equal(portal!.name, name, `Portal '${key}' must keep the name '${name}'`);
    assert.equal(
      portal!.cronExpression,
      cron,
      `Portal '${key}' must keep its cadence (${cron})`,
    );
  }

  const keys = PORTAL_CONFIGS.map((p) => p.key).sort();
  assert.deepEqual(
    keys,
    EXPECTED_PORTALS.map(([key]) => key).sort(),
    'No portal may be added or removed without updating this test deliberately',
  );

  console.log('✓ All 13 portals are registered with their original names and cadences');
}

// 2. Every portal has a scraper class, and every class has a portal.
//
// 'testportal' is the one deliberate exception: its scraper class is always
// linked, but the registry entry appears only when PORTAL_TEST_ENABLED=true.
// This suite runs with the flag unset, so the class is present and the entry
// is not — asserted explicitly in block 6 rather than waved through here.
{
  const classes = getAllScraperClasses() as Record<string, unknown>;

  for (const portal of PORTAL_CONFIGS) {
    assert.ok(
      classes[portal.key],
      `Portal '${portal.key}' has no scraper class — scheduled runs would fail with "No scraper class"`,
    );
  }

  for (const key of Object.keys(classes)) {
    if (key === TEST_PORTAL_KEY) continue;
    assert.ok(
      getPortalConfig(key),
      `Scraper class '${key}' has no registry entry, so nothing can schedule it`,
    );
  }

  assert.equal(Object.keys(classes).length, 14, '13 real portals + the gated local test portal');

  console.log('✓ Portal registry and scraper classes correspond exactly (13 real + 1 gated test portal)');
}

// 3. No GUJRERA scraper is claimed anywhere.
{
  const haystack = [
    ...PORTAL_CONFIGS.map((p) => `${p.key} ${p.name} ${p.url} ${p.state ?? ''}`),
    ...Object.keys(getAllScraperClasses()),
  ]
    .join(' ')
    .toLowerCase();

  assert.equal(
    /gujrera|rera/.test(haystack),
    false,
    'The audit found no GUJRERA scraper; none may be claimed here',
  );

  console.log('✓ No GUJRERA/RERA portal is claimed by the registry');
}

// 4. Schedules are derived from the registry, with no second source of truth.
{
  const schedules = buildDefaultSchedules();
  assert.equal(schedules.length, 13);

  for (const schedule of schedules) {
    const portal = getPortalConfig(schedule.portalName);
    assert.ok(
      portal,
      `Schedule '${schedule.portalName}' is not a registry key — it could never resolve a scraper`,
    );
    assert.equal(schedule.cronExpression, portal!.cronExpression);
  }

  console.log('✓ Default schedules are derived from the registry (every portalName is a valid key)');
}

// 5. All portals are enabled by default.
{
  assert.equal(
    getEnabledPortals().length,
    13,
    'All 13 portals are expected to be enabled by default (PORTAL_*_ENABLED unset)',
  );

  console.log('✓ Scheduling is enabled by default for all 13 portals');
}

// 6. The local test portal is opt-in and can never aim at the public internet.
{
  assert.equal(
    getPortalConfig(TEST_PORTAL_KEY),
    undefined,
    'The local test portal must NOT be registered unless PORTAL_TEST_ENABLED=true',
  );

  assert.equal(
    PORTAL_CONFIGS.some((p) => p.key === TEST_PORTAL_KEY),
    false,
    'PORTAL_CONFIGS must contain no test portal with the flag unset',
  );

  for (const allowed of [
    'http://127.0.0.1:18080',
    'http://localhost:18080',
    'http://mock-portal:18080',
    'http://10.1.2.3:18080',
    'http://192.168.1.10:8080',
    'http://172.18.0.4:18080',
  ]) {
    assert.doesNotThrow(() => assertTestPortalUrl(allowed), `${allowed} must be accepted`);
  }

  for (const rejected of [
    'https://gem.gov.in',
    'http://eprocure.gov.in/cppp',
    'https://example.com:18080',
    'ftp://127.0.0.1',
    'not-a-url',
    'http://172.15.0.1',
    'http://11.0.0.1.nip.io',
  ]) {
    assert.throws(
      () => assertTestPortalUrl(rejected),
      `${rejected} must be refused — the test portal may never reach a real site`,
    );
  }

  console.log('✓ Local test portal is opt-in, and non-private TEST_PORTAL_URLs are refused');
}

console.log('--- All Portal Registry Tests Passed ---');
