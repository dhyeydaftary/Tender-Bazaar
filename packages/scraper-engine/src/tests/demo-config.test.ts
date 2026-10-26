import assert from 'node:assert/strict';

import { cronEnvKey, parseDemoConfig } from '../demo/demo-config';
import { DEMO_PORTALS } from '../demo/demo-portals';

/**
 * Demo scraper configuration: simulated-failure frequencies, the concurrency
 * cap, and per-portal schedules (UTC cron, at most hourly, individually
 * disableable).
 */

console.log('--- Starting Demo Config Tests ---');

// Defaults.
{
  const c = parseDemoConfig({});
  assert.equal(c.failureEvery, 6);
  assert.equal(c.pageErrorsEvery, 3);
  assert.equal(c.concurrency, 2);
  assert.equal(c.scheduleEnabled, false);
  assert.ok([...c.schedules.values()].every((v) => v === null), 'no schedules unless enabled');
  console.log('  ✓ defaults: failure every 6th run, page errors every 3rd, concurrency 2, scheduling off');
}

// 0 disables; bad numbers are rejected.
{
  const c = parseDemoConfig({ DEMO_FAILURE_EVERY: '0', DEMO_PAGE_ERRORS_EVERY: '0' });
  assert.equal(c.failureEvery, 0);
  assert.equal(c.pageErrorsEvery, 0);
  for (const bad of ['-1', '2.5', 'six', ' 3x']) {
    assert.throws(() => parseDemoConfig({ DEMO_FAILURE_EVERY: bad }), /DEMO_FAILURE_EVERY must be a whole number/);
  }
  assert.throws(() => parseDemoConfig({ DEMO_CONCURRENCY: '3' }), /between 1 and 2/);
  assert.throws(() => parseDemoConfig({ DEMO_CONCURRENCY: '0' }), /between 1 and 2/);
  assert.equal(parseDemoConfig({ DEMO_CONCURRENCY: '1' }).concurrency, 1);
  console.log('  ✓ 0 disables a simulation; invalid numbers and concurrency outside 1–2 are rejected');
}

// Schedules: built-in 2–6 hour defaults, per-portal override, per-portal off.
{
  const builtIn = parseDemoConfig({ DEMO_SCHEDULE_ENABLED: 'true' });
  for (const p of DEMO_PORTALS) {
    const cron = builtIn.schedules.get(p.name)!;
    assert.equal(cron, p.cronExpression);
    const hours = Number(/^\d+ \*\/(\d) \* \* \*$/.exec(cron)?.[1]);
    assert.ok(hours >= 2 && hours <= 6, `${p.name} default interval is 2–6 hours (${cron})`);
  }
  const gem = DEMO_PORTALS[0];
  const cppp = DEMO_PORTALS[1];
  assert.equal(cronEnvKey(gem), 'DEMO_CRON_GEM_DEMO');
  const custom = parseDemoConfig({
    DEMO_SCHEDULE_ENABLED: 'true',
    [cronEnvKey(gem)]: '15 */4 * * *',
    [cronEnvKey(cppp)]: 'off',
  });
  assert.equal(custom.schedules.get(gem.name), '15 */4 * * *');
  assert.equal(custom.schedules.get(cppp.name), null, 'a single portal can be switched off');
  // Global switch wins over per-portal settings.
  const off = parseDemoConfig({ DEMO_SCHEDULE_ENABLED: 'false', [cronEnvKey(gem)]: '15 */4 * * *' });
  assert.equal(off.schedules.get(gem.name), null);
  console.log('  ✓ per-portal schedules: 2–6 h defaults, DEMO_CRON_<KEY> override or "off", global switch');
}

// Unsafe or invalid schedules are rejected at boot.
{
  const gem = DEMO_PORTALS[0];
  for (const bad of ['* * * * *', '*/5 * * * *', '0,30 * * * *']) {
    assert.throws(
      () => parseDemoConfig({ DEMO_SCHEDULE_ENABLED: 'true', [cronEnvKey(gem)]: bad }),
      /at most once an hour/,
      `"${bad}" must be rejected`,
    );
  }
  assert.throws(
    () => parseDemoConfig({ DEMO_SCHEDULE_ENABLED: 'true', [cronEnvKey(gem)]: 'every day' }),
    /not a valid cron expression/,
  );
  console.log('  ✓ invalid crons and anything more frequent than hourly are rejected');
}

console.log('--- Demo Config Tests passed ---');
