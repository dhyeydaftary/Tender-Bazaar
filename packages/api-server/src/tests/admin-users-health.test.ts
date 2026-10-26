import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Admin panel: Users list (status + roles) and Service Health.
 *
 *   1. The Users list reported `status: 'Active' | 'Inactive'` derived purely
 *      from `isEmailVerified`. The User model has no account active/deactivated
 *      field and login does not consult that flag, so "Inactive" was email
 *      verification under the wrong name. The API now reports and filters
 *      email verification as such.
 *   2. SUPER_ADMIN must be filterable (the enum already allowed it).
 *   3. /health is also served at /api/v1/health — the only path browser clients
 *      reach through the gateway — and reports each dependency's real state.
 */

console.log('--- Starting Admin Users & Health Tests ---');

function inject(modulePath: string, exports: unknown): void {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports } as any;
}

type Row = Record<string, any>;

const USERS: Row[] = [
  { id: 'u1', name: 'Demo Administrator', email: 'admin@demo.tenderbazaar.local', role: 'SUPER_ADMIN', isEmailVerified: true },
  { id: 'u2', name: 'Demo Admin', email: 'client@demo.tenderbazaar.local', role: 'ADMIN', isEmailVerified: true },
  { id: 'u3', name: 'Nakshatra', email: 'nakshatra@example.invalid', role: 'USER', isEmailVerified: false },
].map((u) => ({
  phone: null,
  isPhoneVerified: false,
  createdAt: new Date('2026-10-23T09:42:00Z'),
  updatedAt: new Date('2026-10-23T09:42:00Z'),
  subscription: null,
  companyProfile: null,
  _count: { savedTenders: 0, alerts: 0, payments: 0 },
  ...u,
}));

/** Minimal Prisma `where` evaluator for the shapes the users service builds. */
function matches(user: Row, where: Row): boolean {
  if (!where || Object.keys(where).length === 0) return true;
  if (where.AND) return where.AND.every((w: Row) => matches(user, w));
  return Object.entries(where).every(([k, v]) => user[k] === v);
}

const calls: Row[] = [];
inject('../config/database', {
  prisma: {
    user: {
      findMany: async ({ where }: Row) => {
        calls.push(where);
        return USERS.filter((u) => matches(u, where));
      },
      count: async ({ where }: Row) => USERS.filter((u) => matches(u, where)).length,
    },
  },
});

const { usersService } = require('../modules/admin/services/users.service');
const { userListQuerySchema, exportUsersQuerySchema } = require('../modules/admin/validation');
const { buildHealthReport } = require('../shared/health');

const list = (filters: Row) =>
  usersService.getUserList({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc', ...filters });

async function main(): Promise<void> {
  // 1. No invented account status; email verification reported and filtered as such.
  {
    const all = await list({});
    assert.equal(all.total, 3);
    for (const u of all.users) {
      assert.ok(!('status' in u), 'no derived account status field');
      assert.ok(!('isActive' in u), 'no derived isActive field');
      assert.equal(typeof u.isEmailVerified, 'boolean');
    }
    assert.ok(!JSON.stringify(all).includes('Inactive'), 'nobody is labelled Inactive');
    const nakshatra = all.users.find((u: Row) => u.name === 'Nakshatra');
    assert.deepEqual([nakshatra.role, nakshatra.isEmailVerified], ['USER', false], 'actual state preserved');

    const unverified = await list({ emailVerified: 'unverified' });
    assert.deepEqual(unverified.users.map((u: Row) => u.name), ['Nakshatra']);
    assert.deepEqual(calls[calls.length - 1], { AND: [{ isEmailVerified: false }] });
    const verified = await list({ emailVerified: 'verified' });
    assert.equal(verified.total, 2);

    const exported = await usersService.exportUsers({ emailVerified: 'unverified' });
    assert.deepEqual(calls[calls.length - 1], { isEmailVerified: false });
    assert.deepEqual(exported.map((u: Row) => [u.name, u.emailVerified]), [['Nakshatra', false]]);
    assert.ok(!('isActive' in exported[0]), 'export column is emailVerified, not isActive');
    console.log('✓ Users list/export: email verification reported and filtered as such; no "Inactive"');
  }

  // 2. All three roles filter; validation accepts exactly the UserRole enum.
  {
    for (const role of ['USER', 'ADMIN', 'SUPER_ADMIN']) {
      const res = await list({ role });
      assert.deepEqual(res.users.map((u: Row) => u.role), [role], `${role} filter`);
    }
    const parsed = userListQuerySchema.parse({ role: 'SUPER_ADMIN', emailVerified: 'unverified' });
    assert.deepEqual([parsed.role, parsed.emailVerified], ['SUPER_ADMIN', 'unverified']);
    assert.equal(userListQuerySchema.safeParse({ role: 'OWNER' }).success, false);
    assert.equal(userListQuerySchema.safeParse({ emailVerified: 'active' }).success, false, 'old status values rejected');
    assert.equal(exportUsersQuerySchema.safeParse({ role: 'SUPER_ADMIN', emailVerified: 'verified' }).success, true);
    const schema = readFileSync(join(__dirname, '..', '..', '..', '..', 'prisma', 'schema.prisma'), 'utf8');
    const roles = /enum UserRole \{([^}]*)\}/.exec(schema)![1].match(/[A-Z_]+/g);
    assert.deepEqual(roles, ['USER', 'ADMIN', 'SUPER_ADMIN'], 'enum unchanged; no role added or removed');
    console.log('✓ USER / ADMIN / SUPER_ADMIN filter; validation matches the UserRole enum');
  }

  // 3. Health report reflects each dependency, never the API's own reachability.
  {
    const ok = () => Promise.resolve();
    const fail = () => Promise.reject(new Error('down'));

    const healthy = await buildHealthReport({ database: ok, redis: ok, elasticsearch: async () => 'healthy' }, 1);
    assert.deepEqual([healthy.status, healthy.services], ['ok', { database: 'healthy', redis: 'healthy', elasticsearch: 'healthy' }]);

    const redisDown = await buildHealthReport({ database: ok, redis: fail, elasticsearch: async () => 'healthy' }, 1);
    assert.deepEqual([redisDown.status, redisDown.services.redis, redisDown.services.database], ['degraded', 'unhealthy', 'healthy']);

    const noIndex = await buildHealthReport({ database: ok, redis: ok, elasticsearch: async () => 'index "tenders" missing' }, 1);
    assert.deepEqual([noIndex.status, noIndex.services.elasticsearch], ['degraded', 'index "tenders" missing']);

    const esDown = await buildHealthReport({ database: fail, redis: ok, elasticsearch: () => Promise.reject(new Error('x')) }, 1);
    assert.deepEqual([esDown.status, esDown.services.database, esDown.services.elasticsearch], ['degraded', 'unhealthy', 'unhealthy']);

    const app = readFileSync(join(__dirname, '..', 'app.ts'), 'utf8');
    assert.ok(/app\.get\('\/health', healthHandler\)/.test(app), '/health still served (container health checks)');
    assert.ok(/app\.get\('\/api\/v1\/health', healthHandler\)/.test(app), '/api/v1/health served for browser clients');
    assert.ok(app.indexOf("app.get('/api/v1/health'") < app.indexOf("app.use('/api/v1/auth'"), 'registered before the routers');
    assert.ok(/res\.status\(health\.status === 'ok' \? 200 : 503\)/.test(app), 'degraded still answers 503');
    assert.ok(!/healthHandler[\s\S]{0,80}authenticate/.test(app), 'same (public) access as /health');
    console.log('✓ Health: per-dependency states; /health and /api/v1/health share one handler');
  }

  console.log('--- All Admin Users & Health Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
