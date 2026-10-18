/**
 * Schema-state probe for the db-init container.
 *
 * Prints exactly one word to stdout:
 *
 *   fresh     — no application tables and no migration history: a normal
 *               `prisma migrate deploy` will create everything.
 *   baseline  — application tables exist but there is no _prisma_migrations
 *               table. This is a database created by the old
 *               `prisma db push` startup path. The initial migration must be
 *               marked as already applied (baselined) before deploying, or
 *               `migrate deploy` would try to CREATE TABLE over live tables
 *               and fail.
 *   deploy    — migration history exists: deploy pending migrations only.
 *
 * Read-only: it issues a single SELECT and never modifies the database.
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ log: ['warn', 'error'] });
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_history,
              to_regclass('public."User"')             IS NOT NULL AS has_tables`
    );
    const { has_history: hasHistory, has_tables: hasTables } = rows[0];

    if (hasHistory) {
      process.stdout.write('deploy');
    } else if (hasTables) {
      process.stdout.write('baseline');
    } else {
      process.stdout.write('fresh');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // Never echo the connection string: it carries the password.
  console.error(`[db-init] schema probe failed: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
