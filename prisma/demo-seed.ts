/**
 * Demo tender seed — ISOLATED DEMO DATABASE ONLY.
 *
 * Writes the synthetic dataset from ./demo/demo-tenders.ts. Run by the
 * `demo-seed` service in docker-compose.demo-local.yml before api-server
 * starts (api-server's boot reindex then loads it into the demo Elasticsearch).
 *
 * Refuses to run unless BOTH:
 *   - DEMO_SEED_TARGET=tenderbazaar-demo, and
 *   - the connected database is literally `tenderbazaar_demo` (checked against
 *     the server with current_database(), not just the URL).
 *
 * Idempotent: tenders are upserted on their unique (sourceId, sourcePortal);
 * documents and results on fixed ids. Re-running updates content and moves
 * dates relative to "now" (keeping ACTIVE deadlines in the future) without
 * creating duplicates. It only ever touches records whose sourcePortal is one
 * of the `*-Demo` portals, and never deletes anything.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildDemoDataset, DEMO_SOURCE_PORTALS } from './demo/demo-tenders';
import { resolveDemoAdmins, type DemoAdmin } from './demo/demo-admins';

const EXPECTED_TARGET = 'tenderbazaar-demo';
const EXPECTED_DATABASE = 'tenderbazaar_demo';

function databaseNameFromUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(new URL(raw).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
}

/**
 * Create the configured demo administrator accounts (prisma/demo/demo-admins.ts)
 * when they do not exist yet. Existing accounts are never modified: no
 * password or role is rewritten on a re-run. bcrypt cost 12, as in seed.ts.
 */
async function createMissingDemoAdmins(prisma: PrismaClient, admins: DemoAdmin[]): Promise<void> {
  if (admins.length === 0) {
    console.log('[demo-seed] No demo admin accounts configured (DEMO_ADMIN_* / DEMO_STAFF_ADMIN_*).');
    return;
  }
  for (const admin of admins) {
    const existing = await prisma.user.findUnique({ where: { email: admin.email }, select: { role: true } });
    if (existing) {
      console.log(`[demo-seed] Unchanged: ${admin.email} already exists (role ${existing.role}).`);
      continue;
    }
    await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        passwordHash: await bcrypt.hash(admin.password, 12),
        role: admin.role,
        isEmailVerified: true,
      },
    });
    console.log(`[demo-seed] Created: ${admin.email} (${admin.role}).`);
  }
}

async function main() {
  if (process.env.DEMO_SEED_TARGET !== EXPECTED_TARGET) {
    throw new Error(`Refusing to seed: DEMO_SEED_TARGET must be "${EXPECTED_TARGET}".`);
  }
  const urlDatabase = databaseNameFromUrl(process.env.DATABASE_URL);
  if (urlDatabase !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to seed: DATABASE_URL must target the "${EXPECTED_DATABASE}" database.`);
  }

  // Validate demo admin configuration before any database access.
  const demoAdmins = resolveDemoAdmins(process.env);

  const prisma = new PrismaClient();
  try {
    const [{ current_database: connected }] = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;
    if (connected !== EXPECTED_DATABASE) {
      throw new Error(`Refusing to seed: connected to "${connected}", not "${EXPECTED_DATABASE}".`);
    }

    const now = new Date();
    const { tenders, documents, results } = buildDemoDataset(now);
    if (!tenders.every((t) => (DEMO_SOURCE_PORTALS as readonly string[]).includes(t.sourcePortal))) {
      throw new Error('Dataset contains a non-demo sourcePortal; aborting.');
    }

    const before = await prisma.tender.count({ where: { sourcePortal: { in: [...DEMO_SOURCE_PORTALS] } } });
    const idBySourceId = new Map<string, string>();
    for (const tender of tenders) {
      const row = await prisma.tender.upsert({
        where: { sourceId_sourcePortal: { sourceId: tender.sourceId, sourcePortal: tender.sourcePortal } },
        create: tender,
        update: tender,
        select: { id: true },
      });
      idBySourceId.set(tender.sourceId, row.id);
    }

    for (const doc of documents) {
      const { id, sourceId, ...data } = doc;
      const tenderId = idBySourceId.get(sourceId)!;
      await prisma.tenderDocument.upsert({
        where: { id },
        create: { id, tenderId, ...data },
        update: { tenderId, ...data },
      });
    }

    for (const result of results) {
      const { id, sourceId, ...data } = result;
      const tenderId = idBySourceId.get(sourceId)!;
      await prisma.tenderResult.upsert({
        where: { id },
        create: { id, tenderId, ...data },
        update: { tenderId, ...data },
      });
    }

    await createMissingDemoAdmins(prisma, demoAdmins);

    const after = await prisma.tender.count({ where: { sourcePortal: { in: [...DEMO_SOURCE_PORTALS] } } });
    const other = await prisma.tender.count({ where: { sourcePortal: { notIn: [...DEMO_SOURCE_PORTALS] } } });
    console.log(
      `[demo-seed] ${tenders.length} demo tenders upserted (${after - before} new, ${before} refreshed), ` +
        `${documents.length} documents, ${results.length} award results. ` +
        `Non-demo tenders in this database: ${other}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[demo-seed] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
