import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

import { StorageWriter } from '../storage/writer';

/**
 * Recovery of runs interrupted by a dying process (audit finding B19).
 *
 * Nothing used to reset `ScrapingRun.status = RUNNING` at startup. The only
 * cleanup lived inside the admin dashboard's list handler, so a killed scraper
 * left rows RUNNING indefinitely unless a human happened to open that page —
 * and that page mutated data on a GET.
 *
 * Requires a DISPOSABLE PostgreSQL database with the schema applied:
 *   docker run -d --name tbtest-pg -e POSTGRES_PASSWORD=... -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=... npx prisma migrate deploy
 *   TEST_DATABASE_URL=... pnpm --filter @tenderbazaar/scraper-engine test
 *
 * It writes and deletes its own ScrapingRun rows (prefixed `test-stale-`) and
 * touches nothing else. It SKIPS when TEST_DATABASE_URL is unset.
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

console.log('--- Starting Stale Run Recovery Tests ---');

async function main() {
  if (!TEST_DATABASE_URL) {
    console.log('! SKIPPED: TEST_DATABASE_URL is not set (needs a disposable database)');
    console.log('--- Stale Run Recovery Tests SKIPPED ---');
    return;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
    log: ['warn', 'error'],
  });

  try {
    await prisma.$connect();
  } catch (err) {
    console.log(
      `! SKIPPED: cannot reach TEST_DATABASE_URL (${
        err instanceof Error ? err.message.split('\n')[0] : err
      })`,
    );
    console.log('--- Stale Run Recovery Tests SKIPPED ---');
    await prisma.$disconnect().catch(() => {});
    return;
  }

  const writer = new StorageWriter(prisma);
  const PORTAL = 'TestStalePortal';

  /** Remove only this test's rows. */
  async function cleanup() {
    await prisma.scrapingRun.deleteMany({ where: { portalName: PORTAL } });
  }

  await cleanup();

  try {
    const longAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const justNow = new Date(Date.now() - 60 * 1000); // 1 minute ago

    const stale = await prisma.scrapingRun.create({
      data: {
        portalName: PORTAL,
        status: 'RUNNING',
        triggeredBy: 'schedule',
        startedAt: longAgo,
        createdAt: longAgo,
      },
      select: { id: true },
    });

    const inProgress = await prisma.scrapingRun.create({
      data: {
        portalName: PORTAL,
        status: 'RUNNING',
        triggeredBy: 'schedule',
        startedAt: justNow,
        createdAt: justNow,
      },
      select: { id: true },
    });

    const completed = await prisma.scrapingRun.create({
      data: {
        portalName: PORTAL,
        status: 'COMPLETED',
        triggeredBy: 'schedule',
        startedAt: longAgo,
        completedAt: longAgo,
        createdAt: longAgo,
      },
      select: { id: true },
    });

    // ── 1. Old RUNNING rows are failed; fresh ones and finished ones are not ─
    {
      const recovered = await writer.recoverStaleRuns(15);
      assert.ok(recovered >= 1, `At least the stale row must be recovered (got ${recovered})`);

      const staleAfter = await prisma.scrapingRun.findUnique({
        where: { id: stale.id },
        select: { status: true, errorMessage: true, completedAt: true },
      });
      assert.equal(staleAfter?.status, 'FAILED', 'An interrupted run must end up FAILED');
      assert.match(
        String(staleAfter?.errorMessage),
        /interrupted/i,
        'The reason must say the run was interrupted',
      );
      assert.ok(staleAfter?.completedAt, 'completedAt must be stamped so the row is terminal');

      const freshAfter = await prisma.scrapingRun.findUnique({
        where: { id: inProgress.id },
        select: { status: true },
      });
      assert.equal(
        freshAfter?.status,
        'RUNNING',
        'A run that started a minute ago is still in progress and must be left alone',
      );

      const completedAfter = await prisma.scrapingRun.findUnique({
        where: { id: completed.id },
        select: { status: true },
      });
      assert.equal(completedAfter?.status, 'COMPLETED', 'Finished runs must not be touched');

      console.log(
        `✓ Interrupted RUNNING rows are failed at startup (${recovered} recovered); in-progress and finished runs untouched`,
      );
    }

    // ── 2. Idempotent: a second sweep changes nothing ───────────────────────
    {
      const again = await writer.recoverStaleRuns(15);
      const stillRunning = await prisma.scrapingRun.count({
        where: { portalName: PORTAL, status: 'RUNNING' },
      });
      assert.equal(stillRunning, 1, 'Only the genuinely in-progress run may remain RUNNING');
      assert.equal(again, 0, 'Re-running the sweep must recover nothing new');

      console.log('✓ The sweep is idempotent — a second pass recovers nothing');
    }

    // ── 3. The threshold is honoured ────────────────────────────────────────
    {
      const recovered = await writer.recoverStaleRuns(0.5); // 30 seconds
      assert.equal(recovered, 1, 'With a 30s threshold the 1-minute-old run is now stale');

      const none = await prisma.scrapingRun.count({
        where: { portalName: PORTAL, status: 'RUNNING' },
      });
      assert.equal(none, 0);

      console.log('✓ The staleness threshold is honoured');
    }
  } finally {
    await cleanup().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }

  console.log('--- All Stale Run Recovery Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
