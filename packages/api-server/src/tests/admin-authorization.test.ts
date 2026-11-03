import assert from 'node:assert/strict';
import {
  assertCanAssignRole,
  assertCanDeactivateUser,
  assertCanManageUser,
} from '../modules/admin/authorization';
import { containsSensitiveUserFields, stripSensitiveUserFields, toSafeUser } from '../shared/serializers/user';
import { runProbe } from './probes/run-probe';

/**
 * Admin user management: privilege escalation and password-hash exposure.
 *
 * Before this, any ADMIN could PATCH `{ role: 'SUPER_ADMIN' }` onto any user
 * (themselves included), change a super administrator's email, and reset a
 * super administrator's password; and GET /admin/users/:id returned the full
 * User row, bcrypt hash and Google id included. Sections 1-2 pin the pure
 * rules and the serializer; section 3 drives the real HTTP endpoints with the
 * data layer stubbed in-process and inspects the actual response bodies.
 */

console.log('--- Starting Admin Authorization Tests ---');

const SUPER = { id: 'super-1', role: 'SUPER_ADMIN' };
const ADMIN = { id: 'admin-1', role: 'ADMIN' };
const ADMIN_2 = { id: 'admin-2', role: 'ADMIN' };
const USER = { id: 'user-1', role: 'USER' };

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (err: any) {
    return err.code ?? String(err);
  }
}

// 1. The rules.
{
  // Only a SUPER_ADMIN assigns roles; never their own.
  assert.equal(code(() => assertCanAssignRole(ADMIN, ADMIN, 'SUPER_ADMIN')), 'ROLE_CHANGE_FORBIDDEN', 'admin cannot promote self');
  assert.equal(code(() => assertCanAssignRole(ADMIN, USER, 'SUPER_ADMIN')), 'ROLE_CHANGE_FORBIDDEN', 'admin cannot promote a user');
  assert.equal(code(() => assertCanAssignRole(ADMIN, USER, 'ADMIN')), 'ROLE_CHANGE_FORBIDDEN', 'admin cannot even grant ADMIN');
  assert.equal(code(() => assertCanAssignRole(ADMIN, SUPER, 'USER')), 'ROLE_CHANGE_FORBIDDEN', 'admin cannot demote a super admin');
  assert.equal(code(() => assertCanAssignRole(SUPER, SUPER, 'ADMIN')), 'CANNOT_CHANGE_OWN_ROLE', 'super admin cannot change own role');
  assert.equal(code(() => assertCanAssignRole(SUPER, USER, 'ADMIN')), null, 'super admin grants ADMIN');
  assert.equal(code(() => assertCanAssignRole(SUPER, USER, 'SUPER_ADMIN')), null, 'super admin grants SUPER_ADMIN');
  assert.equal(code(() => assertCanAssignRole(SUPER, ADMIN, 'USER')), null, 'super admin demotes an admin');
  assert.equal(code(() => assertCanAssignRole(SUPER, USER, 'ROOT')), 'INVALID_ROLE');
  assert.equal(code(() => assertCanAssignRole({ id: 'x', role: 'USER' }, USER, 'ADMIN')), 'ROLE_CHANGE_FORBIDDEN');

  // Managing privileged accounts (name, email, password reset) needs SUPER_ADMIN.
  assert.equal(code(() => assertCanManageUser(ADMIN, USER)), null, 'admin manages ordinary users');
  assert.equal(code(() => assertCanManageUser(ADMIN, ADMIN_2)), 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'admin cannot manage another admin');
  assert.equal(code(() => assertCanManageUser(ADMIN, ADMIN)), 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'admin edits own account via /profile, not the admin API');
  assert.equal(code(() => assertCanManageUser(ADMIN, SUPER)), 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'admin cannot touch a super admin');
  assert.equal(code(() => assertCanManageUser(SUPER, ADMIN)), null);
  assert.equal(code(() => assertCanManageUser(SUPER, SUPER)), null);
  assert.equal(code(() => assertCanManageUser({ id: 'x', role: 'USER' }, USER)), 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'a non-admin role manages nobody');

  // Deactivation.
  assert.equal(code(() => assertCanDeactivateUser(ADMIN, USER)), null);
  assert.equal(code(() => assertCanDeactivateUser(ADMIN, ADMIN_2)), 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(code(() => assertCanDeactivateUser(ADMIN, ADMIN)), 'CANNOT_DEACTIVATE_SELF');
  assert.equal(code(() => assertCanDeactivateUser(SUPER, SUPER)), 'CANNOT_DEACTIVATE_SELF');
  assert.equal(code(() => assertCanDeactivateUser(SUPER, { id: 'super-2', role: 'SUPER_ADMIN' })), 'CANNOT_DELETE_SUPER_ADMIN');
  assert.equal(code(() => assertCanDeactivateUser(SUPER, ADMIN)), null);
  console.log('✓ Roles are assigned only by a super admin, never to oneself; admins manage ordinary users only');
}

// 2. The serializer strips authentication material at any depth.
{
  const row = {
    id: 'u', email: 'a@b.c', passwordHash: '$2a$12$x', googleId: 'g', createdAt: new Date(0),
    companyProfile: { companyName: 'Acme', user: { id: 'u', passwordHash: 'nested' } },
    sessions: [{ id: 's', user: { googleId: 'deep' } }],
  };
  const safe = toSafeUser(row);
  assert.equal(containsSensitiveUserFields(safe), false);
  assert.equal((safe as any).passwordHash, undefined);
  assert.equal(safe.email, 'a@b.c');
  assert.ok(safe.createdAt instanceof Date, 'dates survive');
  assert.equal(safe.companyProfile.companyName, 'Acme');
  assert.equal(containsSensitiveUserFields(row), true, 'the detector sees the original');
  assert.deepEqual(stripSensitiveUserFields([{ passwordHash: 'x', ok: 1 }]), [{ ok: 1 }]);
  assert.equal(stripSensitiveUserFields(null), null);
  console.log('✓ Serializer removes passwordHash and googleId at every depth and keeps everything else');
}

// 3. The real endpoints.
{
  const probe = runProbe('admin-users-probe.ts', { NODE_ENV: 'development' });
  assert.equal(probe.status, 0, `the admin probe must run: ${probe.stderr}`);
  const { results: r, finalRoles, writesByAdmin } = probe.json;
  assert.ok(r, probe.stdout);

  // Password hashes and Google ids never leave the server, for any caller.
  for (const name of ['super.getUser', 'admin.getUser', 'admin.listUsers', 'admin.me', 'admin.renameUser', 'super.promoteUser']) {
    assert.equal(r[name].status, 200, `${name}: served (${JSON.stringify(r[name].body?.error)})`);
    assert.equal(r[name].leaks, false, `${name}: response carries no passwordHash/googleId`);
  }
  assert.equal(r['super.getUser'].body.data.email, 'user@example.com', 'the detail endpoint still returns the user');
  assert.ok(Array.isArray(r['super.getUser'].body.data.payments), 'and its relations');
  assert.equal(r['admin.getAdmin'].status, 200, 'an admin may still VIEW a super admin');
  assert.equal(r['admin.getAdmin'].leaks, false);
  for (const name of Object.keys(r)) {
    assert.equal(r[name].leaks, false, `${name}: no response of any kind leaks authentication material`);
  }

  // Non-admins and anonymous callers are out.
  assert.equal(r['user.getUser'].status, 403);
  assert.equal(r['user.promoteSelf'].status, 403);
  assert.equal(r['anon.getUser'].status, 401);

  // ADMIN escalation attempts, all refused with no write.
  assert.equal(r['admin.promoteSelf'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'admin cannot touch own (privileged) account');
  assert.equal(r['admin.promoteUser'].code, 'ROLE_CHANGE_FORBIDDEN');
  assert.equal(r['admin.promoteUserToAdmin'].code, 'ROLE_CHANGE_FORBIDDEN');
  assert.equal(r['admin.demoteSuper'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(r['admin.renameSuper'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN', 'no email takeover of a super admin');
  assert.equal(r['admin.renameAdmin'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(r['admin.resetSuperPassword'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(r['admin.resetAdminPassword'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(r['admin.deactivateAdmin'].code, 'PRIVILEGED_ACCOUNT_FORBIDDEN');
  assert.equal(r['admin.deactivateSelf'].code, 'CANNOT_DEACTIVATE_SELF');
  for (const name of ['admin.promoteSelf', 'admin.promoteUser', 'admin.promoteUserToAdmin', 'admin.demoteSuper', 'admin.renameSuper', 'admin.renameAdmin', 'admin.resetSuperPassword', 'admin.resetAdminPassword', 'admin.deactivateAdmin', 'admin.deactivateSelf']) {
    assert.equal(r[name].status, 403, `${name}: 403`);
  }
  assert.equal(finalRoles['admin-1'], 'ADMIN', 'the admin is still an admin');
  assert.equal(finalRoles['admin-2'], 'ADMIN');
  assert.ok(
    writesByAdmin.every((w: string) => w.includes(':user-1') || w.includes('user.create')),
    `an admin's requests only ever wrote the ordinary user: ${JSON.stringify(writesByAdmin)}`,
  );

  // Legitimate ADMIN work on ordinary users.
  assert.equal(r['admin.renameUser'].status, 200);
  assert.equal(r['admin.resetUserPassword'].status, 200, 'an admin may reset an ordinary user\'s password');
  assert.equal(probe.json.roleBeforeSuperActions, 'USER', 'the admin\'s attempts never changed the user\'s role');

  // SUPER_ADMIN.
  assert.equal(r['super.changeOwnRole'].code, 'CANNOT_CHANGE_OWN_ROLE');
  assert.equal(r['super.promoteUser'].status, 200);
  assert.equal(finalRoles['user-1'], 'ADMIN', 'a super admin promoted the user');
  assert.equal(r['super.demoteOtherSuper'].status, 200);
  assert.equal(finalRoles['super-2'], 'ADMIN');
  assert.equal(r['super.demoteLastSuper'].status, 403, 'a demoted admin cannot demote the last super admin');
  assert.equal(finalRoles['super-1'], 'SUPER_ADMIN', 'the platform always keeps a super admin');
  assert.equal(r['super.resetAdminPassword'].status, 200, 'a super admin may reset an admin\'s password');
  assert.equal(r['super.resetAdminPassword'].leaks, false);
  assert.equal(r['super.deactivateSuper'].code, 'CANNOT_DEACTIVATE_SELF');
  console.log('✓ Real endpoints: admins cannot escalate or take over privileged accounts; super admins keep full control; no hash leaves the API');
}

console.log('--- All Admin Authorization Tests Passed ---');
