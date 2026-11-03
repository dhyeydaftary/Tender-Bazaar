import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

/**
 * Authentication paths that must not be bypassable, exercised through the real
 * middleware and service code with Prisma and Redis stubbed in-process.
 *
 * Runs as an EXPLICIT development server on purpose: the removed shortcuts
 * (hardcoded fallback JWT secrets, unsigned Google sign-in) were development
 * conveniences, so proving they are gone in development proves they are gone
 * everywhere.
 */

const GOOGLE_CLIENT_ID = '1234567890-testclient.apps.googleusercontent.com';
process.env.NODE_ENV = 'development';
process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
process.env.ALLOW_DEMO_GOOGLE_AUTH = 'true';

// Required after the environment is set: the env module parses once on import.
/* eslint-disable @typescript-eslint/no-var-requires */
const { env, DEV_JWT_SECRET, DEV_JWT_REFRESH_SECRET } = require('../config/env');
const { prisma } = require('../config/database');
const redis = require('../config/redis').default;
const { authenticate } = require('../shared/middleware/auth');
const { authService, INVALID_CREDENTIALS_MESSAGE } = require('../modules/auth/service');
const { verifyGoogleIdToken } = require('../modules/auth/google-verifier');
/* eslint-enable @typescript-eslint/no-var-requires */

console.log('--- Starting Authentication Security Tests ---');

/** Literal secrets that used to be accepted as fallbacks (one per line). */
const FORMER_FALLBACK_SECRETS = [
  'your-jwt-secret-change-in-production',
  'your-jwt-refresh-secret-change-in-production',
];

const USER = { id: 'user-1', email: 'user@example.com', role: 'USER' };
const ADMIN = { id: 'admin-1', email: 'admin@example.com', role: 'SUPER_ADMIN' };

// ─── Stubs ──────────────────────────────────────────────────────────────────

redis.get = async () => null;
redis.setex = async () => 'OK';

const db: any = prisma;
let usersById: Record<string, any> = {};
let created: any[] = [];
let updated: any[] = [];
db.user.findUnique = async ({ where }: any) => {
  if (where.id) return usersById[where.id] ?? null;
  if (where.googleId) return Object.values(usersById).find((u: any) => u.googleId === where.googleId) ?? null;
  if (where.email) return Object.values(usersById).find((u: any) => u.email === where.email) ?? null;
  return null;
};
db.user.findMany = async ({ where }: any) =>
  Object.values(usersById).filter(
    (u: any) => u.email.toLowerCase() === String(where.email.equals).toLowerCase(),
  );
db.user.create = async ({ data }: any) => {
  const user = { id: `new-${created.length}`, role: 'USER', ...data };
  created.push(data);
  usersById[user.id] = user;
  return user;
};
db.user.update = async ({ where, data }: any) => {
  updated.push({ where, data });
  usersById[where.id] = { ...usersById[where.id], ...data };
  return usersById[where.id];
};
db.adminSetting.findUnique = async () => null;
db.session.create = async () => ({});
db.session.findUnique = async () => null;

function reset(users: any[]) {
  usersById = Object.fromEntries(users.map((u) => [u.id, { ...u }]));
  created = [];
  updated = [];
}

/** Run the real authenticate middleware and report what it passed to next(). */
async function runAuthenticate(token: string): Promise<{ error: any; user: any }> {
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  let error: any;
  await authenticate(req, {} as any, (err?: any) => {
    error = err;
  });
  return { error, user: req.user };
}

async function expectAppError(promise: Promise<unknown>, code: string, status?: number) {
  try {
    await promise;
  } catch (err: any) {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    if (status !== undefined) assert.equal(err.statusCode, status);
    return err;
  }
  assert.fail(`expected ${code}, but the call succeeded`);
}

(async () => {
  // 1. Access tokens: only the configured secret and algorithm are accepted.
  {
    reset([USER]);
    const payload = { userId: USER.id, email: USER.email, role: USER.role };

    const genuine = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const ok = await runAuthenticate(genuine);
    assert.equal(ok.error, undefined, 'a token signed with the configured secret must be accepted');
    assert.equal(ok.user.id, USER.id);

    for (const secret of FORMER_FALLBACK_SECRETS) {
      const forged = jwt.sign(payload, secret, { algorithm: 'HS256' });
      const result = await runAuthenticate(forged);
      assert.equal(result.error?.code, 'INVALID_TOKEN', 'a token signed with a former fallback secret must be rejected');
      assert.equal(result.user, undefined);
    }

    const otherAlgorithm = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS512' });
    assert.equal((await runAuthenticate(otherAlgorithm)).error?.code, 'INVALID_TOKEN', 'only HS256 is accepted');

    const unsigned = jwt.sign(payload, '', { algorithm: 'none' } as any);
    assert.equal((await runAuthenticate(unsigned)).error?.code, 'INVALID_TOKEN', 'unsigned tokens are rejected');

    const refreshAsAccess = jwt.sign(payload, DEV_JWT_REFRESH_SECRET, { algorithm: 'HS256' });
    assert.equal(
      (await runAuthenticate(refreshAsAccess)).error?.code,
      'INVALID_TOKEN',
      'a refresh token is not an access token',
    );
    console.log('✓ Access tokens: configured secret only, HS256 only, no fallback secrets');
  }

  // 2. Refresh tokens: forged ones are rejected before any session lookup.
  {
    for (const secret of [...FORMER_FALLBACK_SECRETS, DEV_JWT_SECRET]) {
      const forged = jwt.sign({ userId: ADMIN.id, email: ADMIN.email, role: ADMIN.role }, secret, { algorithm: 'HS256' });
      await expectAppError(authService.refreshToken(forged), 'INVALID_REFRESH_TOKEN', 401);
    }
    console.log('✓ Refresh tokens signed with any other secret are rejected');
  }

  // 3. No hardcoded token secrets remain outside config/env.ts and the tests.
  {
    const srcRoot = join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== 'tests') walk(path);
          continue;
        }
        if (!path.endsWith('.ts') || path.endsWith(join('config', 'env.ts'))) continue;
        const text = readFileSync(path, 'utf8');
        if (/change-in-production/.test(text)) offenders.push(path);
      }
    };
    walk(srcRoot);
    assert.deepEqual(offenders, [], 'no source file may embed a token secret');
    console.log('✓ No hardcoded token secrets in application source');
  }

  // 4. Login does not reveal whether an account exists.
  {
    const passwordHash = await bcrypt.hash('Correct-Horse-9', 4);
    reset([
      { ...USER, passwordHash, subscription: null },
      { id: 'google-only', email: 'google@example.com', role: 'USER', passwordHash: null, subscription: null },
    ]);

    const failures = [
      await expectAppError(authService.login({ email: 'nobody@example.com', password: 'Whatever-1' }), 'INVALID_CREDENTIALS', 401),
      await expectAppError(authService.login({ email: 'google@example.com', password: 'Whatever-1' }), 'INVALID_CREDENTIALS', 401),
      await expectAppError(authService.login({ email: USER.email, password: 'Wrong-Password-1' }), 'INVALID_CREDENTIALS', 401),
    ];
    for (const err of failures) {
      assert.equal(err.message, INVALID_CREDENTIALS_MESSAGE, 'every failure must carry the same message');
    }

    const success = await authService.login({ email: USER.email, password: 'Correct-Horse-9' });
    assert.equal(success.user.id, USER.id, 'a correct password still signs in');
    assert.ok(success.accessToken && success.refreshToken);
    console.log('✓ Unknown email, password-less account and wrong password are indistinguishable');

    // Tokens minted in the same second must differ, or refresh rotation is a
    // no-op (the "new" token equals the old one) and two sign-ins collide on
    // the unique Session.refreshToken column.
    const again = await authService.login({ email: USER.email, password: 'Correct-Horse-9' });
    assert.notEqual(again.refreshToken, success.refreshToken, 'two refresh tokens issued in the same second differ');
    assert.notEqual(again.accessToken, success.accessToken, 'two access tokens issued in the same second differ');
    const rotated = await (async () => {
      db.session.findUnique = async ({ where }: any) =>
        where.refreshToken === success.refreshToken ? { id: 's1', userId: USER.id, expiresAt: new Date(Date.now() + 60_000) } : null;
      db.session.delete = async () => ({});
      return authService.refreshToken(success.refreshToken);
    })();
    assert.notEqual(rotated.refreshToken, success.refreshToken, 'rotation produces a genuinely new refresh token');
    db.session.findUnique = async () => null;
    console.log('✓ Refresh rotation issues a distinct token every time');
  }

  // 5. Google ID tokens are verified: signature, issuer, audience, expiry, email.
  {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const { privateKey: attackerKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = 'test-key';
    const certs = { [kid]: publicKey.export({ type: 'spki', format: 'pem' }).toString() };

    // Every OAuth2Client (including the verifier's shared one) gets our keys
    // instead of fetching Google's, so tokens we sign play the role of Google's.
    (OAuth2Client.prototype as any).getFederatedSignonCertsAsync = async () => ({ certs, format: 'PEM' });

    const now = Math.floor(Date.now() / 1000);
    const claims = (overrides: Record<string, unknown> = {}) => ({
      iss: 'https://accounts.google.com',
      aud: GOOGLE_CLIENT_ID,
      sub: 'google-sub-1',
      email: 'person@example.com',
      email_verified: true,
      name: 'Person',
      iat: now,
      exp: now + 600,
      ...overrides,
    });
    const sign = (c: object, key = privateKey) =>
      jwt.sign(c, key.export({ type: 'pkcs8', format: 'pem' }), { algorithm: 'RS256', keyid: kid });

    const identity = await verifyGoogleIdToken(sign(claims()));
    assert.equal(identity.sub, 'google-sub-1');
    assert.equal(identity.email, 'person@example.com');

    const rejected: Array<[string, string, string]> = [
      ['signed by another key', sign(claims(), attackerKey), 'INVALID_GOOGLE_TOKEN'],
      ['unsigned (the old development token shape)', jwt.sign(claims(), '', { algorithm: 'none' } as any), 'INVALID_GOOGLE_TOKEN'],
      ['wrong audience', sign(claims({ aud: '999-other.apps.googleusercontent.com' })), 'INVALID_GOOGLE_TOKEN'],
      ['wrong issuer', sign(claims({ iss: 'https://evil.example.com' })), 'INVALID_GOOGLE_TOKEN'],
      ['expired', sign(claims({ iat: now - 7200, exp: now - 3600 })), 'INVALID_GOOGLE_TOKEN'],
      ['unverified email', sign(claims({ email_verified: false })), 'GOOGLE_EMAIL_UNVERIFIED'],
      ['no email', sign(claims({ email: undefined })), 'GOOGLE_EMAIL_UNVERIFIED'],
    ];
    for (const [why, token, code] of rejected) {
      await expectAppError(verifyGoogleIdToken(token), code).catch((e) => {
        throw new Error(`${why}: ${e.message}`);
      });
    }

    await expectAppError(
      verifyGoogleIdToken(sign(claims()), { audience: [] }),
      'GOOGLE_AUTH_DISABLED',
      503,
    );
    console.log('✓ Google tokens: signature, issuer, audience, expiry and verified email are all enforced');

    // 6. Google sign-in through the real service.
    reset([USER, { ...ADMIN }, { id: 'linked', email: 'linked@example.com', role: 'USER', googleId: 'someone-else' }]);

    // ALLOW_DEMO_GOOGLE_AUTH=true and NODE_ENV=development are set above: an
    // unsigned token naming the admin must still be refused.
    const unsignedAdmin = jwt.sign(claims({ email: ADMIN.email, sub: 'attacker' }), '', { algorithm: 'none' } as any);
    await expectAppError(authService.googleAuth(unsignedAdmin), 'INVALID_GOOGLE_TOKEN', 401);

    await expectAppError(
      authService.googleAuth(sign(claims({ email: ADMIN.email, sub: 'admin-google' }))),
      'GOOGLE_LINK_FORBIDDEN',
      403,
    );
    assert.equal(usersById[ADMIN.id].googleId, undefined, 'the admin account must not be linked');

    await expectAppError(
      authService.googleAuth(sign(claims({ email: 'linked@example.com', sub: 'impostor' }))),
      'GOOGLE_ACCOUNT_MISMATCH',
      409,
    );

    const fresh = await authService.googleAuth(
      sign(claims({ email: 'new@example.com', sub: 'new-sub', role: 'SUPER_ADMIN' })),
    );
    assert.equal(created.length, 1);
    assert.equal(created[0].role, undefined, 'token claims must never set a role');
    assert.equal(created[0].googleId, 'new-sub');
    assert.ok(fresh.accessToken);
    const decoded: any = jwt.verify(fresh.accessToken, env.JWT_SECRET);
    assert.equal(decoded.role, 'USER', 'a new Google user is an ordinary user');

    const linkedExisting = await authService.googleAuth(sign(claims({ email: USER.email, sub: 'user-google' })));
    assert.ok(linkedExisting.accessToken);
    assert.equal(usersById[USER.id].googleId, 'user-google', 'an ordinary account links to its verified Google identity');

    const again = await authService.googleAuth(sign(claims({ email: 'changed@example.com', sub: 'user-google' })));
    const againDecoded: any = jwt.verify(again.accessToken, env.JWT_SECRET);
    assert.equal(againDecoded.userId, USER.id, 'a linked Google account signs in as its own user, found by subject');
    console.log('✓ Google sign-in: no unsigned path, no implicit admin linking, no identity takeover, no role from claims');
  }

  console.log('--- All Authentication Security Tests Passed ---');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
