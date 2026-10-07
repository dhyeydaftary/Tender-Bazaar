import { BaseScraper, ScrapedTender, ScrapeResult } from './base-scraper';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Shared helpers for state portal scrapers
// ---------------------------------------------------------------------------

interface StateScraperOptions {
  prisma?: PrismaClient;
  maxConcurrency?: number;
  requestDelay?: number;
  /** Max listing pages for this run; falls back to the scraper's getMaxPages(). */
  maxPages?: number;
  /** Re-fetch already-known tenders (used by the daily full re-scrape). */
  fullRescrape?: boolean;
}

/**
 * Common scrape loop used by all state scrapers.
 * Fetches listing pages, parses them, fetches detail pages, and saves tenders.
 */
async function runStateScrapeLoop(
  scraper: BaseScraper & {
    parseTenderList(html: string): Partial<ScrapedTender>[];
    parseTenderDetail(html: string): Partial<ScrapedTender>;
    buildListingUrl(page: number): string;
    buildDetailUrl(sourceId: string): string;
    getStateName(): string;
    getMaxPages(): number;
  },
): Promise<ScrapeResult> {
  const startTime = Date.now();
  let totalFound = 0;
  let newTenders = 0;
  let updatedTenders = 0;
  let errors = 0;
  let skippedExisting = 0;
  let pagesScraped = 0;

  const logger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
      console.log(`[${scraper.portalName}] INFO: ${msg}`, meta ? JSON.stringify(meta) : ''),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      console.warn(`[${scraper.portalName}] WARN: ${msg}`, meta ? JSON.stringify(meta) : ''),
    error: (msg: string, meta?: Record<string, unknown>) =>
      console.error(`[${scraper.portalName}] ERROR: ${msg}`, meta ? JSON.stringify(meta) : ''),
  };

  logger.info('Starting scraping run');

  try {
    // Prefer the run's configured page budget (PORTAL_CONFIGS.maxPages, threaded
    // through main.ts); fall back to the scraper's own default.
    const pageBudget = (scraper as any).maxPages ?? scraper.getMaxPages();

    for (let page = 1; page <= pageBudget; page++) {
      try {
        const listingUrl = scraper.buildListingUrl(page);
        const listingHtml = await (scraper as any).fetchPage(listingUrl, {
          headers: {
            Referer: scraper.portalUrl,
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        const listings = scraper.parseTenderList(listingHtml);
        if (listings.length === 0) {
          logger.info(`No tenders on page ${page}, stopping pagination`);
          break;
        }
        // This page was fetched and parsed into listings, so it counts as
        // scraped. Reached only past fetchPage() (which throws on failure) and
        // past the empty-listings break, so failed and empty pages are excluded.
        pagesScraped++;
        totalFound += listings.length;
        logger.info(`Found ${listings.length} tenders on page ${page}`);

        // New-only: one batch existence check per listing page (PostgreSQL is the
        // source of truth). Known-and-unchanged tenders never reach the detail fetch.
        const { toProcess, skipped } = await (scraper as any).partitionListings(listings);
        skippedExisting += skipped.length;

        for (const listing of toProcess) {
          try {
            if (!listing.sourceId) continue;

            const detailUrl = scraper.buildDetailUrl(listing.sourceId);
            const detailHtml = await (scraper as any).fetchPage(detailUrl, {
              headers: { Referer: listingUrl },
            });

            const detail = scraper.parseTenderDetail(detailHtml);

            const tender: ScrapedTender = {
              title: detail.title || listing.title || 'Untitled Tender',
              description: detail.description || listing.description,
              referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
              organization: detail.organization || listing.organization || 'State Government',
              department: detail.department || listing.department,
              tenderType: detail.tenderType || listing.tenderType || 'OPEN',
              category: detail.category || listing.category || 'WORKS',
              status: detail.status || listing.status || 'ACTIVE',
              state: scraper.getStateName(),
              district: detail.district || listing.district,
              city: detail.city || listing.city,
              estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
              emdAmount: detail.emdAmount ?? listing.emdAmount,
              publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
              bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
              bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
              preBidMeetingDate: detail.preBidMeetingDate,
              sourcePortal: scraper.portalName,
              sourceUrl: detailUrl,
              sourceId: listing.sourceId!,
              reservedForMSME: listing.reservedForMSME ?? detail.reservedForMSME ?? false,
              reservedForStartups: listing.reservedForStartups ?? detail.reservedForStartups ?? false,
              documents: detail.documents,
            };

            const result = await (scraper as any).saveTender(tender);
            if (result.isNew) newTenders++;
            else updatedTenders++;

            await (scraper as any).delay((scraper as any).requestDelay);
          } catch (err) {
            errors++;
            logger.error(`Failed to process tender ${listing.sourceId}: ${(err as Error).message}`);
          }
        }
        // One addBulk per page rather than one add per tender.
        await (scraper as any).flushTenderIndexQueue(`${scraper.portalName}:page-${page}`);
      } catch (err) {
        errors++;
        logger.error(`Failed to fetch page ${page}: ${(err as Error).message}`);
      }
    }
  } finally {
    // Guarantee every changed tender is queued, even on an early break or error.
    await (scraper as any).flushTenderIndexQueue();
    await (scraper as any).closeBrowser();
  }

  const duration = Date.now() - startTime;
  logger.info('Scraping complete', {
    totalFound,
    newTenders,
    updatedTenders,
    skippedExisting,
    pagesScraped,
    errors,
    durationMs: duration,
  });

  return {
    portal: scraper.portalName,
    totalFound,
    newTenders,
    updatedTenders,
    errors,
    duration,
    skippedExisting,
    pagesScraped,
  };
}

// ===========================================================================
// Gujarat Scraper — nprocure.com
// ===========================================================================

export class GujaratScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Gujarat (nProcure)', 'https://www.nprocure.com', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Gujarat'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/tender/search?page=${page}&state=Gujarat&status=active`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/tender/detail/${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.tender-table tbody tr, .tender-list-item, table#tenderList tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 4) return;

      const sourceId = this.cleanText($cols.eq(0).find('a').attr('href')?.match(/detail\/(\w+)/)?.[1] || $cols.eq(0).text());
      const refNumber = this.cleanText($cols.eq(0).text());
      const title = this.cleanText($cols.eq(1).text());
      const org = this.cleanText($cols.eq(2).text());
      const valueText = this.cleanText($cols.eq(3).text());
      const closingDate = this.cleanText($cols.eq(4).text());
      const publishDate = this.cleanText($cols.eq(5).text());

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        publishedDate: this.parseIndianDate(publishDate),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        sourcePortal: this.portalName,
        state: 'Gujarat',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table.detail-table tr, .detail-row').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, .label').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:last-child, .value').text());
        }
      });
      return val;
    };

    tender.title = getField('work name') || getField('tender title') || getField('description');
    tender.description = getField('description') || getField('work description');
    tender.referenceNumber = getField('tender no') || getField('reference') || getField('NIT');
    tender.organization = getField('organization') || getField('department') || getField('office');
    tender.department = getField('department') || getField('division');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city') || getField('taluka');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated cost') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('publish date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('closing date') || getField('last date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    tender.tenderType = this.mapTenderType(getField('tender type'));
    tender.category = this.mapCategory(getField('category') || getField('work type'));

    // Documents
    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a.doc-download').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }

  private mapTenderType(type: string): ScrapedTender['tenderType'] {
    const lower = type.toLowerCase();
    if (lower.includes('limited')) return 'LIMITED';
    if (lower.includes('two') || lower.includes('2-packet')) return 'TWO_PACKET';
    if (lower.includes('eoi')) return 'EOI';
    if (lower.includes('rfp')) return 'RFP';
    return 'OPEN';
  }

  private mapCategory(cat: string): ScrapedTender['category'] {
    const lower = cat.toLowerCase();
    if (lower.includes('good') || lower.includes('supply')) return 'GOODS';
    if (lower.includes('service')) return 'SERVICES';
    if (lower.includes('consult')) return 'CONSULTANCY';
    return 'WORKS';
  }
}

// ===========================================================================
// Maharashtra Scraper — mahatenders.gov.in
// ===========================================================================

export class MaharashtraScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Maharashtra (MahaTenders)', 'https://mahatenders.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Maharashtra'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/tender/active?page=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/tender/view/${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.tenderTable tbody tr, .tender-row, #tenderListTable tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const sourceId = this.cleanText(
        $cols.eq(0).find('a').attr('href')?.match(/view\/(\w+)/)?.[1] || $cols.eq(0).text(),
      );
      const refNumber = this.cleanText($cols.eq(1).text());
      const title = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const department = this.cleanText($cols.eq(4).text());
      const valueText = this.cleanText($cols.eq(5).text());
      const closingDate = this.cleanText($cols.eq(6).text());

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        department,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        sourcePortal: this.portalName,
        state: 'Maharashtra',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr, .field-row').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, th, .field-label').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:last-child, .field-value').text());
        }
      });
      return val;
    };

    tender.title = getField('tender title') || getField('work name') || getField('subject');
    tender.description = getField('description') || getField('scope of work');
    tender.referenceNumber = getField('tender no') || getField('NIT no') || getField('reference number');
    tender.organization = getField('organization') || getField('authority') || getField('department');
    tender.department = getField('department') || getField('division') || getField('section');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city') || getField('taluka');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated cost') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money deposit'));

    // Maharashtra uses DD/MM/YYYY format
    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('NIT date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('closing date') || getField('submission deadline'));
    tender.bidOpeningDate = this.parseIndianDate(getField('opening date') || getField('bid opening'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid') || getField('pre bid meeting'));

    const typeText = getField('tender type') || getField('bid type');
    tender.tenderType = this.mapMahaTenderType(typeText);
    tender.category = this.mapMahaCategory(getField('category') || getField('classification'));

    const mseText = getField('mse').toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable');

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a.document-link, .doc-list a').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }

  private mapMahaTenderType(type: string): ScrapedTender['tenderType'] {
    const lower = type.toLowerCase();
    if (lower.includes('limited')) return 'LIMITED';
    if (lower.includes('single')) return 'SINGLE';
    if (lower.includes('two') || lower.includes('two-envelope')) return 'TWO_PACKET';
    if (lower.includes('eoi') || lower.includes('expression')) return 'EOI';
    if (lower.includes('rfp')) return 'RFP';
    return 'OPEN';
  }

  private mapMahaCategory(cat: string): ScrapedTender['category'] {
    const lower = cat.toLowerCase();
    if (lower.includes('good') || lower.includes('supply') || lower.includes('material')) return 'GOODS';
    if (lower.includes('service') || lower.includes('maintenance')) return 'SERVICES';
    if (lower.includes('consult')) return 'CONSULTANCY';
    return 'WORKS';
  }
}

// ===========================================================================
// Rajasthan Scraper — eproc.rajasthan.gov.in
// ===========================================================================

export class RajasthanScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Rajasthan (eProc)', 'https://eproc.rajasthan.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Rajasthan'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // Rajasthan eProc uses NIC-GEP style HTML tables
    $('table.list_table tbody tr, table#activeTenders tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return; // Skip non-data rows

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || this.cleanText($cols.eq(0).text());

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDateText = this.cleanText($cols.eq(4).text()); // DD/MM/YYYY
      const openingDateText = this.cleanText($cols.eq(5).text());
      const valueText = this.cleanText($cols.eq(6).text());

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDateText),
        bidOpeningDate: this.parseIndianDate(openingDateText),
        sourcePortal: this.portalName,
        state: 'Rajasthan',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, td.fieldLabel').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2), td.fieldValue').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title') || getField('NIT title');
    tender.description = getField('detailed description') || getField('scope');
    tender.referenceNumber = getField('NIT no') || getField('tender reference') || getField('tender no');
    tender.organization = getField('organisation') || getField('department name');
    tender.department = getField('department') || getField('office');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('NIT date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening') || getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"]').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Karnataka Scraper — eproc.karnataka.gov.in
// ===========================================================================

export class KarnatakaScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Karnataka (eProc)', 'https://eproc.karnataka.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Karnataka'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/eprocurement/tenderList?page=${page}&status=active`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/eprocurement/tenderDetail?tenderId=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.tenderListTable tbody tr, #tenderResultTable tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const $link = $cols.eq(1).find('a');
      const sourceId = $link.attr('href')?.match(/tenderId=(\w+)/)?.[1] || this.cleanText($cols.eq(0).text());
      const refNumber = this.cleanText($cols.eq(1).text());
      const title = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const valueText = this.cleanText($cols.eq(4).text());
      const closingDate = this.cleanText($cols.eq(5).text());
      const publishDate = this.cleanText($cols.eq(6).text());

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        publishedDate: this.parseIndianDate(publishDate),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        sourcePortal: this.portalName,
        state: 'Karnataka',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table.detailTable tr, .tender-detail tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, th').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:last-child').text());
        }
      });
      return val;
    };

    tender.title = getField('work name') || getField('title');
    tender.description = getField('description') || getField('scope');
    tender.referenceNumber = getField('tender number') || getField('reference');
    tender.organization = getField('organization') || getField('department');
    tender.department = getField('department') || getField('division');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city') || getField('taluk');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated cost') || getField('value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    // Karnataka uses DD-MM-YYYY format
    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('start date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('closing date') || getField('end date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], .doc-links a').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Tamil Nadu Scraper — tntenders.gov.in
// ===========================================================================

export class TamilNaduScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Tamil Nadu (TNTenders)', 'https://tntenders.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Tamil Nadu'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // TN uses NIC-GEP framework similar to other state portals
    $('table.list_table tbody tr, #activeTenders tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || `TN-${slNo}`;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDate = this.cleanText($cols.eq(4).text());
      const valueText = this.cleanText($cols.eq(5).text());

      if (!title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        sourcePortal: this.portalName,
        state: 'Tamil Nadu',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2)').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title');
    tender.description = getField('detailed NIT') || getField('description');
    tender.referenceNumber = getField('NIT no') || getField('tender reference');
    tender.organization = getField('organisation') || getField('department');
    tender.department = getField('department') || getField('office');
    tender.district = getField('district');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    // TN uses DD/MM/YYYY HH:mm format
    tender.publishedDate = this.parseIndianDate(getField('published date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening'));

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="viewDocument"]').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Uttar Pradesh Scraper — etender.up.nic.in
// ===========================================================================

export class UPScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Uttar Pradesh (eTender)', 'https://etender.up.nic.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Uttar Pradesh'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // UP e-Tender follows the NIC-GEP template
    $('table.list_table tbody tr, #tendersList tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || `UP-${slNo}`;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDate = this.cleanText($cols.eq(4).text());
      const openingDate = this.cleanText($cols.eq(5).text());
      const valueText = this.cleanText($cols.eq(6).text());

      if (!title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        bidOpeningDate: this.parseIndianDate(openingDate),
        sourcePortal: this.portalName,
        state: 'Uttar Pradesh',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2)').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title') || getField('NIT title');
    tender.description = getField('description') || getField('work detail');
    tender.referenceNumber = getField('NIT no') || getField('tender reference') || getField('tender no');
    tender.organization = getField('organisation') || getField('department name');
    tender.department = getField('department') || getField('office') || getField('division');
    tender.district = getField('district');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    // UP uses DD/MM/YYYY HH:mm format
    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('e-published'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening') || getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="viewDoc"]').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Madhya Pradesh Scraper — mptenders.gov.in
// ===========================================================================

export class MPScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Madhya Pradesh (MPTenders)', 'https://mptenders.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Madhya Pradesh'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.list_table tbody tr, #tenderList tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || `MP-${slNo}`;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDate = this.cleanText($cols.eq(4).text());
      const valueText = this.cleanText($cols.eq(5).text());

      if (!title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        sourcePortal: this.portalName,
        state: 'Madhya Pradesh',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2)').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title');
    tender.description = getField('description') || getField('scope');
    tender.referenceNumber = getField('NIT no') || getField('tender no') || getField('reference');
    tender.organization = getField('organisation') || getField('department');
    tender.department = getField('department') || getField('office');
    tender.district = getField('district');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    tender.publishedDate = this.parseIndianDate(getField('published date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening'));

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"]').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Delhi Scraper — govtprocurement.delhi.gov.in
// ===========================================================================

export class DelhiScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Delhi (GovtProcurement)', 'https://govtprocurement.delhi.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Delhi'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // Delhi portal follows NIC-GEP template
    $('table.list_table tbody tr, #activeTenderList tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || `DL-${slNo}`;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDate = this.cleanText($cols.eq(4).text());
      const openingDate = this.cleanText($cols.eq(5).text());
      const valueText = this.cleanText($cols.eq(6).text());

      if (!title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDate),
        bidOpeningDate: this.parseIndianDate(openingDate),
        sourcePortal: this.portalName,
        state: 'Delhi',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2)').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title') || getField('NIT title');
    tender.description = getField('description') || getField('work detail') || getField('scope');
    tender.referenceNumber = getField('NIT no') || getField('tender reference') || getField('tender no');
    tender.organization = getField('organisation') || getField('department name') || getField('authority');
    tender.department = getField('department') || getField('office') || getField('division');
    tender.district = getField('district') || getField('zone');
    tender.city = 'Delhi';

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value') || getField('cost'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money') || getField('bid security'));

    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('e-published'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date') || getField('last date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening') || getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid') || getField('pre bid meeting'));

    const mseText = getField('mse').toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable');

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"], a[href*="viewDoc"]').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// Kerala Scraper — etenders.kerala.gov.in
// ===========================================================================

export class KeralaScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('Kerala (eTenders)', 'https://etenders.kerala.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'Kerala'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.list_table tbody tr, table#activeTenders tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || slNo;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDateText = this.cleanText($cols.eq(4).text());
      const valueText = $cols.length > 5 ? this.cleanText($cols.eq(5).text()) : '';

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDateText),
        sourcePortal: this.portalName,
        state: 'Kerala',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, td.fieldLabel').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2), td.fieldValue').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title');
    tender.description = getField('detailed description') || getField('scope');
    tender.referenceNumber = getField('NIT no') || getField('tender reference') || getField('tender no');
    tender.organization = getField('organisation') || getField('department name');
    tender.department = getField('department') || getField('office');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('NIT date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening') || getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    const mseText = getField('mse').toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable');

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"], a.doc-link').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}

// ===========================================================================
// West Bengal Scraper — wbtenders.gov.in
// ===========================================================================

export class WestBengalScraper extends BaseScraper {
  constructor(options?: StateScraperOptions) {
    super('West Bengal (WBTenders)', 'https://wbtenders.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });
  }

  getStateName(): string { return 'West Bengal'; }
  getMaxPages(): number { return 10; }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndLatestActiveTenders&service=page&pageNo=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/nicgep/app?page=FrontEndTenderPreview&service=page&tenderid=${sourceId}`;
  }

  async scrape(): Promise<ScrapeResult> {
    return runStateScrapeLoop(this);
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    $('table.list_table tbody tr, table#activeTenders tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 5) return;

      const slNo = this.cleanText($cols.eq(0).text());
      if (!slNo || isNaN(parseInt(slNo))) return;

      const $titleLink = $cols.eq(1).find('a');
      const title = this.cleanText($titleLink.text() || $cols.eq(1).text());
      const detailHref = $titleLink.attr('href') || '';
      const sourceId = detailHref.match(/tenderid=(\d+)/)?.[1] || slNo;

      const refNumber = this.cleanText($cols.eq(2).text());
      const org = this.cleanText($cols.eq(3).text());
      const closingDateText = this.cleanText($cols.eq(4).text());
      const openingDateText = $cols.length > 5 ? this.cleanText($cols.eq(5).text()) : '';
      const valueText = $cols.length > 6 ? this.cleanText($cols.eq(6).text()) : '';

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: refNumber || sourceId,
        title,
        organization: org,
        estimatedValue: this.parseIndianCurrency(valueText),
        bidSubmissionDeadline: this.parseIndianDate(closingDateText),
        bidOpeningDate: this.parseIndianDate(openingDateText) || undefined,
        sourcePortal: this.portalName,
        state: 'West Bengal',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const getField = (label: string): string => {
      let val = '';
      $('table tr').each((_, row) => {
        const lbl = this.cleanText($(row).find('td:first-child, td.fieldLabel').text());
        if (lbl.toLowerCase().includes(label.toLowerCase())) {
          val = this.cleanText($(row).find('td:nth-child(2), td.fieldValue').text());
        }
      });
      return val;
    };

    tender.title = getField('work description') || getField('title') || getField('NIT title');
    tender.description = getField('detailed description') || getField('scope');
    tender.referenceNumber = getField('NIT no') || getField('tender reference') || getField('tender no');
    tender.organization = getField('organisation') || getField('department name');
    tender.department = getField('department') || getField('office');
    tender.district = getField('district') || getField('location');
    tender.city = getField('city');

    tender.estimatedValue = this.parseIndianCurrency(getField('estimated value') || getField('tender value'));
    tender.emdAmount = this.parseIndianCurrency(getField('emd') || getField('earnest money'));

    tender.publishedDate = this.parseIndianDate(getField('published date') || getField('NIT date'));
    tender.bidSubmissionDeadline = this.parseIndianDate(getField('bid submission end') || getField('closing date'));
    tender.bidOpeningDate = this.parseIndianDate(getField('bid opening') || getField('opening date'));
    tender.preBidMeetingDate = this.parseIndianDate(getField('pre-bid'));

    const mseText = getField('mse').toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable');

    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"], a.doc-link').each((_, el) => {
      const href = $(el).attr('href');
      const name = this.cleanText($(el).text()) || 'Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `${this.portalUrl}${href}`,
        });
      }
    });
    if (documents.length > 0) tender.documents = documents;

    return tender;
  }
}
