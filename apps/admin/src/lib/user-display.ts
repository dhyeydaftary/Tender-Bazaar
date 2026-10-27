/**
 * How the Users page labels roles and email verification.
 *
 * Roles mirror the UserRole enum (prisma/schema.prisma): USER, ADMIN,
 * SUPER_ADMIN. The list API filters on any of them; the page used to offer only
 * USER and ADMIN and badged only ADMIN, so super admins were neither filterable
 * nor marked.
 *
 * There is deliberately no "account status" here. The User model has no
 * active/deactivated field and login does not check `isEmailVerified`, so the
 * old "Active / Inactive" column was email verification under the wrong name —
 * an unverified user is not an inactive account.
 */

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

/** Badge for elevated roles; ordinary users get none. */
export function roleBadge(role: string): { label: string; className: string } | null {
  switch (role) {
    case 'SUPER_ADMIN':
      return { label: 'SUPER ADMIN', className: 'bg-purple-500/15 text-purple-400' };
    case 'ADMIN':
      return { label: 'ADMIN', className: 'bg-amber-500/15 text-amber-400' };
    default:
      return null;
  }
}

export type EmailVerifiedFilter = 'verified' | 'unverified';

export const EMAIL_FILTER_OPTIONS: ReadonlyArray<{ value: EmailVerifiedFilter; label: string }> = [
  { value: 'verified', label: 'Email verified' },
  { value: 'unverified', label: 'Email unverified' },
];
