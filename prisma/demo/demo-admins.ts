/**
 * Demo administrator accounts for prisma/demo-seed.ts.
 *
 * Pure (no database, no I/O) so the configuration is validated before any
 * write and can be tested on its own.
 *
 * Only explicitly configured accounts are created — never a built-in account
 * and never a fallback password:
 *
 *   DEMO_ADMIN_EMAIL + DEMO_ADMIN_PASSWORD (+ DEMO_ADMIN_NAME)   → SUPER_ADMIN
 *   DEMO_STAFF_ADMIN_EMAIL + DEMO_STAFF_ADMIN_PASSWORD           → ADMIN
 *
 * A pair that is partly set, or whose password is shorter than
 * MIN_DEMO_ADMIN_PASSWORD_LENGTH (the same rule as SEED_ADMIN_PASSWORD in
 * prisma/seed-admins.ts), throws. A pair left entirely unset is skipped.
 */

export type DemoAdmin = {
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
};

export const MIN_DEMO_ADMIN_PASSWORD_LENGTH = 12;

const PAIRS = [
  { prefix: 'DEMO_ADMIN', role: 'SUPER_ADMIN', defaultName: 'Demo Administrator' },
  { prefix: 'DEMO_STAFF_ADMIN', role: 'ADMIN', defaultName: 'Demo Admin' },
] as const;

export function resolveDemoAdmins(env: NodeJS.ProcessEnv): DemoAdmin[] {
  const admins: DemoAdmin[] = [];
  for (const pair of PAIRS) {
    const email = env[`${pair.prefix}_EMAIL`]?.trim();
    const password = env[`${pair.prefix}_PASSWORD`];
    if (!email && !password) continue;
    if (!email || !password) {
      throw new Error(`${pair.prefix}_EMAIL and ${pair.prefix}_PASSWORD must be set together.`);
    }
    if (password.length < MIN_DEMO_ADMIN_PASSWORD_LENGTH) {
      throw new Error(
        `${pair.prefix}_PASSWORD must be at least ${MIN_DEMO_ADMIN_PASSWORD_LENGTH} characters long.`,
      );
    }
    if (admins.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      throw new Error(`${pair.prefix}_EMAIL duplicates another demo admin email.`);
    }
    admins.push({
      name: (pair.prefix === 'DEMO_ADMIN' ? env.DEMO_ADMIN_NAME?.trim() : undefined) || pair.defaultName,
      email,
      password,
      role: pair.role,
    });
  }
  return admins;
}
