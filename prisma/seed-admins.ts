/**
 * Which administrator accounts prisma/seed.ts should create when missing.
 *
 * Pure (no database, no I/O) so it can be validated before any write and tested
 * on its own. seed.ts calls it before touching the database.
 *
 *   - SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (any environment): one SUPER_ADMIN.
 *     The password must be at least MIN_SEED_ADMIN_PASSWORD_LENGTH characters.
 *     Supplying only one of the two, or a short password, throws — a
 *     misconfigured admin is an error, never silently skipped.
 *   - Development only (NODE_ENV !== 'production'): the two fixture accounts
 *     below are added as well. Their credentials are public in this repository,
 *     so they must never be created in production.
 *   - Production without SEED_ADMIN_*: no administrator is created (unchanged
 *     behaviour; the operator provisions one explicitly).
 */

export type SeedAdmin = {
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
};

export const MIN_SEED_ADMIN_PASSWORD_LENGTH = 12;

/** Development fixture accounts. Never created when NODE_ENV=production. */
export const DEV_FIXTURE_ADMINS: readonly SeedAdmin[] = [
  {
    name: 'Parth Savajadiya',
    email: 'superadmin@tenderbazaar.com',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN',
  },
  {
    name: 'Karthik Iyer',
    email: 'admin@tenderbazaar.com',
    password: 'Admin@123',
    role: 'ADMIN',
  },
];

export function resolveSeedAdmins(env: NodeJS.ProcessEnv): SeedAdmin[] {
  const isProduction = env.NODE_ENV === 'production';
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const password = env.SEED_ADMIN_PASSWORD;
  const admins: SeedAdmin[] = [];

  if (email || password) {
    if (!email || !password) {
      throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set together.');
    }
    if (password.length < MIN_SEED_ADMIN_PASSWORD_LENGTH) {
      throw new Error(
        `SEED_ADMIN_PASSWORD must be at least ${MIN_SEED_ADMIN_PASSWORD_LENGTH} characters long.`,
      );
    }
    admins.push({
      name: env.SEED_ADMIN_NAME?.trim() || 'Administrator',
      email,
      password,
      role: 'SUPER_ADMIN',
    });
  }

  if (!isProduction) {
    for (const fixture of DEV_FIXTURE_ADMINS) {
      if (!admins.some((a) => a.email === fixture.email)) admins.push({ ...fixture });
    }
  }

  return admins;
}
