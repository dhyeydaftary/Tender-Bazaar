/**
 * Drives the REAL admin user-management endpoints (Express app, authenticate
 * middleware, admin router, controller, service) over HTTP in a fresh process,
 * with Prisma and Redis replaced in-process. Reports, per scenario, the HTTP
 * status, the error code, whether the response body carries any sensitive
 * user field anywhere, and the writes the data layer saw.
 *
 * Used by admin-authorization.test.ts to check privilege escalation and
 * password-hash exposure against the actual response payloads.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { makeFakePrisma, makeFakeRedis, injectModule } from './fake-prisma';

const SUPER = { id: 'super-1', email: 'super@example.com', name: 'Super', role: 'SUPER_ADMIN', passwordHash: '$2a$12$superhash', googleId: null, isEmailVerified: true };
const SUPER_2 = { id: 'super-2', email: 'super2@example.com', name: 'Super Two', role: 'SUPER_ADMIN', passwordHash: '$2a$12$super2hash', googleId: null, isEmailVerified: true };
const ADMIN = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', passwordHash: '$2a$12$adminhash', googleId: 'google-admin', isEmailVerified: true };
const ADMIN_2 = { id: 'admin-2', email: 'admin2@example.com', name: 'Admin Two', role: 'ADMIN', passwordHash: '$2a$12$admin2hash', googleId: null, isEmailVerified: true };
const USER = { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER', passwordHash: '$2a$12$userhash', googleId: 'google-user', isEmailVerified: true };

const db = makeFakePrisma([SUPER, SUPER_2, ADMIN, ADMIN_2, USER]);
injectModule('../../config/database', { prisma: db.prisma, default: db.prisma });
const redis = makeFakeRedis();
injectModule('../../config/redis', { redis, default: redis });

/* eslint-disable @typescript-eslint/no-var-requires */
const { env } = require('../../config/env');
const app = require('../../app').default;
const { containsSensitiveUserFields } = require('../../shared/serializers/user');
/* eslint-enable @typescript-eslint/no-var-requires */

function tokenFor(user: { id: string; email: string; role: string }): string {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });
}

interface Result {
  status: number;
  code: string | null;
  leaks: boolean;
  body: any;
}

function request(port: number, method: string, path: string, token: string | null, body?: unknown): Promise<Result> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            parsed = null;
          }
          resolve({
            status: res.statusCode ?? 0,
            code: parsed?.error?.code ?? null,
            leaks: containsSensitiveUserFields(parsed),
            body: parsed,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;

  const superToken = tokenFor(SUPER);
  const adminToken = tokenFor(ADMIN);
  const userToken = tokenFor(USER);
  const results: Record<string, Result> = {};
  const run = async (name: string, method: string, path: string, token: string | null, body?: unknown) => {
    results[name] = await request(port, method, path, token, body);
  };

  // Reads: password hashes must never appear, for any role.
  await run('super.getUser', 'GET', `/api/v1/admin/users/${USER.id}`, superToken);
  await run('admin.getUser', 'GET', `/api/v1/admin/users/${USER.id}`, adminToken);
  await run('admin.getAdmin', 'GET', `/api/v1/admin/users/${SUPER.id}`, adminToken);
  await run('admin.listUsers', 'GET', '/api/v1/admin/users', adminToken);
  await run('user.getUser', 'GET', `/api/v1/admin/users/${USER.id}`, userToken);
  await run('anon.getUser', 'GET', `/api/v1/admin/users/${USER.id}`, null);
  await run('admin.me', 'GET', '/api/v1/auth/me', adminToken);

  // Privilege escalation attempts by an ADMIN.
  await run('admin.promoteSelf', 'PATCH', `/api/v1/admin/users/${ADMIN.id}`, adminToken, { role: 'SUPER_ADMIN' });
  await run('admin.promoteUser', 'PATCH', `/api/v1/admin/users/${USER.id}`, adminToken, { role: 'SUPER_ADMIN' });
  await run('admin.promoteUserToAdmin', 'PATCH', `/api/v1/admin/users/${USER.id}`, adminToken, { role: 'ADMIN' });
  await run('admin.demoteSuper', 'PATCH', `/api/v1/admin/users/${SUPER.id}`, adminToken, { role: 'USER' });
  await run('admin.renameSuper', 'PATCH', `/api/v1/admin/users/${SUPER.id}`, adminToken, { email: 'taken-over@example.com' });
  await run('admin.renameAdmin', 'PATCH', `/api/v1/admin/users/${ADMIN_2.id}`, adminToken, { name: 'Renamed' });
  await run('admin.resetSuperPassword', 'POST', `/api/v1/admin/users/${SUPER.id}/reset-password`, adminToken);
  await run('admin.resetAdminPassword', 'POST', `/api/v1/admin/users/${ADMIN_2.id}/reset-password`, adminToken);
  await run('admin.deactivateAdmin', 'DELETE', `/api/v1/admin/users/${ADMIN_2.id}`, adminToken);
  await run('admin.deactivateSelf', 'DELETE', `/api/v1/admin/users/${ADMIN.id}`, adminToken);
  // Legitimate ADMIN work on ordinary users keeps working.
  await run('admin.renameUser', 'PATCH', `/api/v1/admin/users/${USER.id}`, adminToken, { name: 'Renamed User' });
  await run('admin.resetUserPassword', 'POST', `/api/v1/admin/users/${USER.id}/reset-password`, adminToken);
  const roleBeforeSuperActions = db.users.find((u) => u.id === USER.id)!.role;
  const writesByAdmin = [...db.writes];

  // An ordinary user never reaches the admin API.
  await run('user.promoteSelf', 'PATCH', `/api/v1/admin/users/${USER.id}`, userToken, { role: 'SUPER_ADMIN' });

  // SUPER_ADMIN: allowed role changes, with the self and last-admin guards.
  await run('super.changeOwnRole', 'PATCH', `/api/v1/admin/users/${SUPER.id}`, superToken, { role: 'ADMIN' });
  await run('super.promoteUser', 'PATCH', `/api/v1/admin/users/${USER.id}`, superToken, { role: 'ADMIN' });
  await run('super.demoteOtherSuper', 'PATCH', `/api/v1/admin/users/${SUPER_2.id}`, superToken, { role: 'ADMIN' });
  // SUPER_2 is now ADMIN; SUPER is the last SUPER_ADMIN and must stay so.
  await run('super.demoteLastSuper', 'PATCH', `/api/v1/admin/users/${SUPER.id}`, tokenFor(SUPER_2) /* now an ADMIN */, { role: 'USER' });
  await run('super.resetAdminPassword', 'POST', `/api/v1/admin/users/${ADMIN.id}/reset-password`, superToken);
  await run('super.deactivateSuper', 'DELETE', `/api/v1/admin/users/${SUPER.id}`, superToken);

  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(
    JSON.stringify({
      results,
      roleBeforeSuperActions,
      finalRoles: Object.fromEntries(db.users.map((u) => [u.id, u.role])),
      writesByAdmin,
      writes: db.writes,
    }),
  );
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
