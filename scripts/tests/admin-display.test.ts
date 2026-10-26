/**
 * Admin panel display logic — synthetic fixtures only.
 *
 *   npx tsx scripts/tests/admin-display.test.ts
 *
 * Covers the four admin-panel defects:
 *   - Users showed "Inactive" for email-unverified accounts (there is no
 *     account active/deactivated state to show).
 *   - SUPER_ADMIN had no badge and was missing from the role filter.
 *   - Service Health requested /health on the admin origin and showed every
 *     row Disconnected (or Connected while still loading).
 *   - Secondary/Accent colors had no visible effect: Tailwind cannot apply
 *     opacity to a var(--x, #hex) color, so their /NN classes were never
 *     generated, and Secondary had no consumer at all.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EMAIL_FILTER_OPTIONS, ROLE_OPTIONS, roleBadge } from '../../apps/admin/src/lib/user-display';
import { isHealthReport, serviceRows, type SystemHealthResponse } from '../../apps/admin/src/lib/service-health';
import {
  ACCENT_VAR,
  DEFAULT_BRAND_COLORS,
  SECONDARY_VAR,
  brandColorProperties,
  hexToRgbChannels,
} from '../../apps/admin/src/lib/theme-colors';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

console.log('--- Starting Admin Display Tests ---');

// 1–2. Users: roles and email verification.
{
  const schema = read('prisma/schema.prisma');
  const enumRoles = /enum UserRole \{([^}]*)\}/.exec(schema)![1].match(/[A-Z_]+/g);
  assert.deepEqual(ROLE_OPTIONS.map((r) => r.value), enumRoles, 'role filter offers every UserRole');
  assert.deepEqual(ROLE_OPTIONS.map((r) => r.label), ['User', 'Admin', 'Super Admin']);

  assert.equal(roleBadge('USER'), null, 'ordinary users get no badge');
  assert.equal(roleBadge('ADMIN')!.label, 'ADMIN');
  assert.equal(roleBadge('SUPER_ADMIN')!.label, 'SUPER ADMIN');
  assert.notEqual(roleBadge('SUPER_ADMIN')!.className, roleBadge('ADMIN')!.className, 'distinguishable badges');

  const validation = read('packages/api-server/src/modules/admin/validation.ts');
  for (const opt of EMAIL_FILTER_OPTIONS) {
    assert.ok(validation.includes(`'${opt.value}'`), `API accepts emailVerified=${opt.value}`);
  }
  assert.ok(EMAIL_FILTER_OPTIONS.every((o) => /email/i.test(o.label)), 'filter labelled as email verification');

  const page = read('apps/admin/src/app/users/page.tsx');
  assert.ok(!/Inactive|statusBadge|STATUSES/.test(page), 'no Active/Inactive account status on the Users page');
  assert.ok(/ROLE_OPTIONS\.map/.test(page) && /roleBadge\(user\.role\)/.test(page), 'page uses the shared role options and badge');
  console.log('✓ Users: all three roles filterable and badged; email verification labelled as such');
}

// 3. Service Health rows.
{
  const report = (services: SystemHealthResponse['services'], status: 'ok' | 'degraded' = 'degraded'): SystemHealthResponse => ({
    status,
    timestamp: '2026-10-23T12:00:00Z',
    uptime: 1,
    services,
  });

  const loading = serviceRows({ phase: 'loading' });
  assert.ok(loading.every((r) => r.status === 'checking'), 'nothing shows connected while checking');

  const error = serviceRows({ phase: 'error' });
  assert.deepEqual(error.map((r) => r.status), ['unknown', 'unknown', 'unknown', 'disconnected'], 'API unreachable: dependencies unknown');

  const healthy = serviceRows({
    phase: 'ready',
    latencyMs: 12,
    report: report({ database: 'healthy', redis: 'healthy', elasticsearch: 'healthy' }, 'ok'),
  });
  assert.deepEqual(healthy.map((r) => r.status), ['connected', 'connected', 'connected', 'connected']);
  assert.equal(healthy[3].detail, '12 ms', 'measured latency, not a placeholder');

  // A 503 body: the API is up, its dependencies are not all healthy.
  const degraded = serviceRows({
    phase: 'ready',
    latencyMs: 30,
    report: report({ database: 'healthy', redis: 'unhealthy', elasticsearch: 'index "tenders" missing' }),
  });
  assert.deepEqual(
    degraded.map((r) => [r.name, r.status]),
    [
      ['PostgreSQL Database', 'connected'],
      ['Redis Cache', 'disconnected'],
      ['Elasticsearch Engine', 'degraded'],
      ['TenderBazaar API Server', 'connected'],
    ],
  );
  assert.equal(degraded[2].detail, 'index "tenders" missing');

  const missing = serviceRows({ phase: 'ready', latencyMs: 5, report: report({ database: 'healthy' }) });
  assert.equal(missing[1].status, 'unknown', 'a dependency the API did not report is unknown, not connected');

  assert.equal(isHealthReport('<!DOCTYPE html><html>404</html>'), false, 'the admin app 404 page is not a health report');
  assert.equal(isHealthReport({ status: 'ok', services: {} }), true);

  const adminApi = read('apps/admin/src/lib/admin-api.ts');
  assert.ok(!/replace\(\/\\\/api\\\/v1/.test(adminApi), 'no longer strips /api/v1 to reach the admin origin');
  assert.ok(/api\.get\('\/health', \{ validateStatus/.test(adminApi), 'requests /api/v1/health and accepts the 503 body');
  console.log('✓ Service Health: real per-dependency states, checking/unknown states, 503 body used');
}

// 4. Brand colors.
{
  assert.equal(hexToRgbChannels('#00D4AA'), '0 212 170');
  assert.equal(hexToRgbChannels('#1B2845'), '27 40 69');
  assert.equal(hexToRgbChannels('0da'), '0 221 170');
  assert.equal(hexToRgbChannels('teal'), null);
  assert.deepEqual(brandColorProperties(ACCENT_VAR, '#123456'), {
    '--color-accent-500': '#123456',
    '--color-accent-500-rgb': '18 52 86',
  });
  assert.deepEqual(brandColorProperties(SECONDARY_VAR, 'not-a-color'), {}, 'invalid input sets nothing');

  // Tailwind tokens use the channel variables (so /NN opacity classes exist),
  // with fallbacks equal to the default brand colors.
  const tw = read('apps/admin/tailwind.config.ts');
  assert.ok(tw.includes(`900: 'rgb(var(--color-secondary-900-rgb, ${hexToRgbChannels(DEFAULT_BRAND_COLORS.secondary)}) / <alpha-value>)'`));
  assert.ok(tw.includes(`500: 'rgb(var(--color-accent-500-rgb, ${hexToRgbChannels(DEFAULT_BRAND_COLORS.accent)}) / <alpha-value>)'`));

  // Applied at runtime and before hydration (saved colors survive reloads).
  const appearance = read('apps/admin/src/lib/appearance.tsx');
  assert.ok(/brandColorProperties\(SECONDARY_VAR, secondaryColor\)/.test(appearance));
  assert.ok(/brandColorProperties\(ACCENT_VAR, accentColor\)/.test(appearance));
  const layout = read('apps/admin/src/app/layout.tsx');
  assert.ok(/setBrand\('--color-secondary-900', parsed\.secondary\)/.test(layout));
  assert.ok(/setBrand\('--color-accent-500', parsed\.accent\)/.test(layout));
  assert.ok(/name \+ '-rgb'/.test(layout), 'pre-hydration script also sets the channel variables');

  // Secondary now has visible consumers (brand chrome), Accent replaces hard-coded hex.
  assert.ok(/text-secondary-900 dark:text-foreground/.test(layout), 'brand text uses Secondary');
  assert.ok(/ring-secondary-900\/60/.test(layout), 'logo ring uses Secondary');
  assert.ok(/from-secondary-900\/40 to-accent-500\/40/.test(layout), 'avatar gradient uses Secondary and Accent');
  assert.ok(/backgroundColor: secondaryColor/.test(read('apps/admin/src/app/page.tsx')), 'dashboard tooltips use Secondary');
  assert.ok(/fill=\{accentColor\}/.test(read('apps/admin/src/app/page.tsx')), 'signups chart uses Accent');
  assert.ok(!/#00D4AA/i.test(read('apps/admin/src/app/scrapers/page.tsx')), 'scraper success bars use the Accent token');
  assert.ok(/bg-secondary-900\/95/.test(read('apps/admin/src/app/analytics/page.tsx')));
  console.log('✓ Brand colors: channel variables, alpha-capable tokens, Secondary/Accent consumers');
}

console.log('--- All Admin Display Tests Passed ---');
