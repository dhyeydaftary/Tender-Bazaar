/**
 * One-time backfill: move GeM bid-PDF URLs out of `Tender.sourceUrl` and into
 * `TenderDocument`, then point `sourceUrl` at the verified public listing.
 *
 * WHY
 * ---
 * The GeM adapter stored the bid *document* endpoint in `sourceUrl`, so the
 * detail page's "View Original" / "View this tender on GeM" actions downloaded
 * a PDF instead of opening a page. Verified against the live portal:
 *
 *   showradocumentPdf/<id>        200 application/pdf
 *                                 Content-Disposition: attachment; GeM-RA-<id>.pdf
 *   showbidDocument/<id>          200 application/pdf
 *                                 Content-Disposition: attachment; GeM-Bidding-<id>.pdf
 *   showdirectradocumentPdf/<id>  same family (direct RA)
 *   list-ra-schedules/<id>        200 text/html  <- a real bid-specific page
 *   bidplus.gem.gov.in/all-bids   200 text/html  <- GeM's public listing
 *
 * GeM publishes no per-bid detail page (its own listing links the bid number
 * straight at showbidDocument), so no detail route is invented. The PDF URL is
 * preserved byte-for-byte as a document; `sourceUrl` becomes the listing.
 *
 * SAFETY
 * ------
 *  - Dry run by default. Writes only with an explicit `--apply`.
 *  - Only rows whose host is bidplus.gem.gov.in AND whose path is one of the
 *    three PDF segments are considered. `list-ra-schedules` rows are left
 *    exactly as they are (they already open a bid-specific page), as are
 *    eProcure and portal-root rows.
 *  - Idempotent: a document is created only when no TenderDocument already
 *    exists for the same (tenderId, fileUrl). Re-running changes nothing.
 *  - The PDF URL can never be lost: within a per-row transaction the document
 *    is created/confirmed FIRST, and the `sourceUrl` update only happens once
 *    that row is present.
 *  - Nothing is ever deleted. TenderResult, other portals' sourceUrls, and all
 *    unrelated fields are untouched.
 *  - `--limit N` processes only the first N matches, for a small trial run.
 *
 * USAGE
 *   tsx scripts/backfill-gem-source-urls.ts                 # dry run (default)
 *   tsx scripts/backfill-gem-source-urls.ts --limit 5       # dry run, 5 rows
 *   tsx scripts/backfill-gem-source-urls.ts --apply --limit 5
 *   tsx scripts/backfill-gem-source-urls.ts --apply         # full backfill
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GEM_HOST = 'bidplus.gem.gov.in';
const GEM_ALL_BIDS_URL = `https://${GEM_HOST}/all-bids`;

/** PDF endpoints -> the document name to record. */
const PDF_SEGMENTS: Record<string, string> = {
  showradocumentPdf: 'GeM RA Bid Document',
  showdirectradocumentPdf: 'GeM Direct RA Bid Document',
  showbidDocument: 'GeM Bid Document',
};

interface Target {
  tenderId: string;
  referenceNumber: string;
  pdfUrl: string;
  documentName: string;
}

/** Classify a stored sourceUrl; returns null when the row must not be touched. */
export function classifyForBackfill(
  sourceUrl: string | null | undefined,
): { documentName: string } | null {
  if (!sourceUrl) return null;

  let u: URL;
  try {
    u = new URL(sourceUrl);
  } catch {
    return null; // malformed: leave alone, do not guess
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.host.toLowerCase() !== GEM_HOST) return null;

  const segment = u.pathname.split('/').filter(Boolean)[0];
  if (!segment) return null;

  const documentName = PDF_SEGMENTS[segment];
  return documentName ? { documentName } : null;
}

async function collectTargets(limit?: number): Promise<Target[]> {
  const rows = await prisma.tender.findMany({
    where: { sourceUrl: { contains: GEM_HOST } },
    select: { id: true, referenceNumber: true, sourceUrl: true },
  });

  const targets: Target[] = [];
  for (const row of rows) {
    const hit = classifyForBackfill(row.sourceUrl);
    if (!hit) continue;
    targets.push({
      tenderId: row.id,
      referenceNumber: row.referenceNumber,
      pdfUrl: row.sourceUrl,
      documentName: hit.documentName,
    });
    if (limit && targets.length >= limit) break;
  }
  return targets;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;

  if (limitArg >= 0 && (!Number.isSafeInteger(limit) || (limit as number) <= 0)) {
    throw new Error('--limit must be a positive integer');
  }

  console.log(`mode: ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}${limit ? `  limit=${limit}` : ''}`);

  const totalTenders = await prisma.tender.count();
  const docsBefore = await prisma.tenderDocument.count();
  const targets = await collectTargets(limit);

  console.log(`tenders in database:            ${totalTenders}`);
  console.log(`TenderDocument rows before:     ${docsBefore}`);
  console.log(`rows matching a GeM PDF URL:    ${targets.length}`);

  const byName = targets.reduce<Record<string, number>>((acc, t) => {
    acc[t.documentName] = (acc[t.documentName] ?? 0) + 1;
    return acc;
  }, {});
  console.log('breakdown by document name:', JSON.stringify(byName));

  // What would be skipped as already done (idempotency check).
  let alreadyHasDocument = 0;
  for (const t of targets) {
    const existing = await prisma.tenderDocument.findFirst({
      where: { tenderId: t.tenderId, fileUrl: t.pdfUrl },
      select: { id: true },
    });
    if (existing) alreadyHasDocument++;
  }
  console.log(`of those, document already present: ${alreadyHasDocument}`);
  console.log(`would create documents:             ${targets.length - alreadyHasDocument}`);
  console.log(`would repoint sourceUrl ->          ${GEM_ALL_BIDS_URL}`);

  if (targets.length > 0) {
    console.log('\nsample (first 3):');
    for (const t of targets.slice(0, 3)) {
      console.log(`  ${t.referenceNumber}`);
      console.log(`    document: "${t.documentName}" -> ${t.pdfUrl}`);
      console.log(`    sourceUrl: ${t.pdfUrl}`);
      console.log(`            -> ${GEM_ALL_BIDS_URL}`);
    }
  }

  if (!apply) {
    console.log('\nDRY RUN — nothing was written. Re-run with --apply to perform the backfill.');
    return;
  }

  let created = 0;
  let reused = 0;
  let repointed = 0;
  let failed = 0;

  for (const t of targets) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Ensure the document exists FIRST, so the PDF URL is preserved
        //    before sourceUrl is overwritten. Keyed on (tenderId, fileUrl),
        //    matching the scraper writer's own dedupe rule.
        const existing = await tx.tenderDocument.findFirst({
          where: { tenderId: t.tenderId, fileUrl: t.pdfUrl },
          select: { id: true },
        });

        if (existing) {
          reused++;
        } else {
          await tx.tenderDocument.create({
            data: {
              tenderId: t.tenderId,
              name: t.documentName,
              fileUrl: t.pdfUrl,
              fileType: 'pdf',
            },
          });
          created++;
        }

        // 2. Only now repoint sourceUrl, and only if it still holds the PDF
        //    URL (guards against a concurrent change between read and write).
        const updated = await tx.tender.updateMany({
          where: { id: t.tenderId, sourceUrl: t.pdfUrl },
          data: { sourceUrl: GEM_ALL_BIDS_URL },
        });
        repointed += updated.count;
      });
    } catch (error) {
      failed++;
      console.error(`  FAILED ${t.referenceNumber}: ${(error as Error).message}`);
    }
  }

  console.log('\napplied:');
  console.log(`  documents created:   ${created}`);
  console.log(`  documents reused:    ${reused}`);
  console.log(`  sourceUrl repointed: ${repointed}`);
  console.log(`  failures:            ${failed}`);
  console.log(`  TenderDocument rows after: ${await prisma.tenderDocument.count()}`);

  const remaining = (await collectTargets()).length;
  console.log(
    `  rows still holding a GeM PDF URL: ${remaining}` +
      (limit
        ? ` (a --limit run leaves the rest; drop --limit to finish)`
        : ` (expect 0)`),
  );

  // Worth knowing before repeating a limited run: `--limit N` takes the first N
  // rows that STILL match, so a second `--limit N` migrates the NEXT N records
  // rather than re-touching the previous batch. Per-record idempotency is
  // separate and always holds — the same row processed twice reuses its
  // existing document and its sourceUrl update is a no-op.
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
