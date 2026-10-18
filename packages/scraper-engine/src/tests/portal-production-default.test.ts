import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Real government portals must be OPT-IN in production.
 *
 * Before this, all 13 real portals defaulted to `enabled: true`, so merely
 * starting the production stack would begin scraping every one of them —
 * including the three Playwright portals, whose memory profile has never been
 * measured. A deployment had to remember to opt OUT, and forgetting was
 * silent.
 *
 * `PORTAL_CONFIGS` reads the environment at module load, so each case below
 * evaluates the registry in a FRESH PROCESS with a chosen environment. Nothing
 * here constructs a scraper or opens a socket: no real portal is contacted.
 */

console.log('--- Starting Portal Production-Default Tests ---');

// tsx transpiles this suite to CJS, so `__dirname` is the portable choice here;
// `import.meta.dirname` is undefined under that loader.
const HELPER = path.join(__dirname, 'helpers', 'print-portal-enablement.ts');

const REAL_PORTAL_KEYS = [
  'gem', 'cppp', 'eprocure', 'gujarat', 'maharashtra', 'rajasthan', 'karnataka',
  'tamilnadu', 'up', 'mp', 'delhi', 'kerala', 'westbengal',
];

interface Enablement {
  nodeEnv: string;
  isProd: boolean;
  total: number;
  all: Array<[string, boolean]>;
  enabledKeys: string[];
  testPortalRegistered: boolean;
}

/**
 * Evaluate the registry in a fresh process.
 *
 * The child inherits only an explicitly-built environment: every PORTAL_* key
 * from this process is stripped first, so a stray value in the developer's
 * shell cannot make a production-default test pass.
 */
function enablementUnder(env: Record<string, string>): Enablement {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (k.startsWith('PORTAL_') || k === 'NODE_ENV') continue;
    base[k] = v;
  }
  // Invoke node directly with the tsx loader rather than going through the
  // `npx` shim: `npx` needs a shell on Windows, and this repository's path
  // contains spaces, which the shell splits into separate arguments.
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', HELPER], {
    env: { ...base, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout) as Enablement;
}

// 1. Production with nothing set: every real portal is OFF.
{
  const r = enablementUnder({ NODE_ENV: 'production' });

  assert.equal(r.isProd, true, 'the child must actually be in production mode');
  assert.equal(r.total, 13, 'all 13 portals stay REGISTERED — registered is not enabled');

  const enabled = r.all.filter(([, on]) => on).map(([k]) => k);
  assert.deepEqual(
    enabled,
    [],
    `no real portal may be enabled by default in production, found: ${enabled.join(', ')}`,
  );
  assert.deepEqual(r.enabledKeys, [], 'getEnabledPortals() must be empty in production');

  console.log('✓ Production defaults every one of the 13 real portals to DISABLED');
}

// 2. Production opt-in is per portal, and enables ONLY that portal.
{
  const r = enablementUnder({ NODE_ENV: 'production', PORTAL_GEM_ENABLED: 'true' });

  assert.deepEqual(r.enabledKeys, ['gem'], 'exactly the opted-in portal is enabled');

  const others = r.all.filter(([k, on]) => on && k !== 'gem').map(([k]) => k);
  assert.deepEqual(others, [], `opting into gem must not enable: ${others.join(', ')}`);

  console.log('✓ An explicit PORTAL_GEM_ENABLED=true enables GeM and nothing else');
}

// 3. Two independent opt-ins compose, and still exclude the rest.
{
  const r = enablementUnder({
    NODE_ENV: 'production',
    PORTAL_GEM_ENABLED: 'true',
    PORTAL_CPPP_ENABLED: 'true',
  });

  assert.deepEqual([...r.enabledKeys].sort(), ['cppp', 'gem'], 'both opt-ins take effect');
  assert.equal(r.enabledKeys.length, 2, 'and only those two');

  console.log('✓ Per-portal opt-in composes without enabling the other 11');
}

// 4. Development is UNCHANGED — this must not break existing workflows.
{
  const r = enablementUnder({ NODE_ENV: 'development' });

  assert.equal(r.isProd, false);
  const disabled = r.all.filter(([, on]) => !on).map(([k]) => k);
  assert.deepEqual(
    disabled,
    [],
    `development must keep defaulting to enabled, found disabled: ${disabled.join(', ')}`,
  );
  assert.equal(r.enabledKeys.length, 13, 'all 13 enabled in development, as before');

  console.log('✓ Development behaviour is unchanged (all 13 still default to enabled)');
}

// 5. The explicit kill switch still works in development.
{
  const r = enablementUnder({ NODE_ENV: 'development', PORTAL_GEM_ENABLED: 'false' });

  assert.ok(!r.enabledKeys.includes('gem'), 'an explicit false must still disable the portal');
  assert.equal(r.enabledKeys.length, 12, 'and only that one');

  console.log('✓ PORTAL_*_ENABLED=false remains a working kill switch in development');
}

// 6. The local mock portal is governed separately, and is NOT a real portal.
//    A production deployment that opts into nothing must register no portal
//    that could reach the public internet, and must not register the mock.
{
  const prod = enablementUnder({ NODE_ENV: 'production' });
  assert.equal(
    prod.testPortalRegistered,
    false,
    'the mock portal must not be registered without PORTAL_TEST_ENABLED',
  );

  for (const key of REAL_PORTAL_KEYS) {
    assert.ok(
      prod.all.some(([k]) => k === key),
      `real portal '${key}' must remain registered (so it can be opted into)`,
    );
  }

  console.log('✓ The mock portal stays separate; all 13 real portals remain registerable');
}

console.log('--- All Portal Production-Default Tests Passed ---');
