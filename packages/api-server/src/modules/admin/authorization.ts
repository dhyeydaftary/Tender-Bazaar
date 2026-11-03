import { AppError } from '../../shared/middleware/error-handler';

/**
 * Who may do what to whom in the admin user-management endpoints.
 *
 * Every rule here runs on the server, on every request, whatever the admin UI
 * shows or hides. Before this module an ADMIN could PATCH any user with
 * `{ role: 'SUPER_ADMIN' }` (themselves included), change any user's email
 * and reset any user's password, super administrators included: full
 * takeover of the platform from the lower admin tier. The rules:
 *
 *   - Roles are assigned only by a SUPER_ADMIN.
 *   - Nobody changes their own role, so a SUPER_ADMIN cannot lock the platform
 *     out by demoting themselves by accident, and an ADMIN cannot promote
 *     themselves at all.
 *   - The last SUPER_ADMIN cannot be demoted (checked in the service, which
 *     knows how many exist).
 *   - An ADMIN manages ordinary users only. Accounts holding ADMIN or
 *     SUPER_ADMIN are managed by a SUPER_ADMIN: name, email, deactivation and
 *     password resets of a privileged account are privileged operations.
 *   - Nobody deactivates their own account through the admin API.
 *
 * Pure functions over plain role strings so they can be unit-tested without a
 * database; the service applies them after loading the target.
 */

export const USER_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AdminActor {
  id: string;
  role: string;
}

export interface ManagedUser {
  id: string;
  role: string;
}

export function isPrivilegedRole(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * May `actor` modify `target` at all (name, email, deactivation, password
 * reset)? ADMINs manage ordinary users; SUPER_ADMINs manage everyone.
 */
export function assertCanManageUser(actor: AdminActor, target: ManagedUser): void {
  if (actor.role === 'SUPER_ADMIN') return;
  if (actor.role === 'ADMIN' && !isPrivilegedRole(target.role)) return;
  throw new AppError(
    'Only a super administrator can manage administrator accounts.',
    403,
    'PRIVILEGED_ACCOUNT_FORBIDDEN',
  );
}

/** May `actor` set `target`'s role to `newRole`? */
export function assertCanAssignRole(actor: AdminActor, target: ManagedUser, newRole: string): void {
  if (!(USER_ROLES as readonly string[]).includes(newRole)) {
    throw new AppError('Unknown role', 400, 'INVALID_ROLE');
  }
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError(
      'Only a super administrator can change user roles.',
      403,
      'ROLE_CHANGE_FORBIDDEN',
    );
  }
  if (actor.id === target.id) {
    throw new AppError('You cannot change your own role.', 403, 'CANNOT_CHANGE_OWN_ROLE');
  }
}

/** May `actor` deactivate `target`? */
export function assertCanDeactivateUser(actor: AdminActor, target: ManagedUser): void {
  if (actor.id === target.id) {
    throw new AppError('You cannot deactivate your own account.', 403, 'CANNOT_DEACTIVATE_SELF');
  }
  if (target.role === 'SUPER_ADMIN') {
    throw new AppError('Cannot delete super admin', 403, 'CANNOT_DELETE_SUPER_ADMIN');
  }
  assertCanManageUser(actor, target);
}
