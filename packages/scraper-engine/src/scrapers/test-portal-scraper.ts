/**
 * TestPortalScraper — scrapes a *local* mock tender portal.
 *
 * This exists so that scheduler behaviour (recurring cron firings, run
 * records, BullMQ retry/backoff, per-portal locking, portal disable, restart
 * recovery) can be verified end to end without ever touching a real
 * government portal.
 *
 * It is registered in PORTAL_CONFIGS only when PORTAL_TEST_ENABLED=true, and
 * the registry additionally refuses a TEST_PORTAL_URL that is not a
 * loopback/private/Compose-internal host — see assertTestPortalUrl() in
 * ../config. An accidentally-set flag therefore cannot be pointed at the
 * public internet.
 *
 * Mock portal contract (docker/mock-portal/server.js):
 *   GET {base}/tenders?page=N   → listing, <table class="tenderListTable">
 *   GET {base}/tenders/{id}     → detail,  <table class="detailTable">
 *   GET {base}/__control/...    → test-only switches (fail mode)
 */

import { PrismaClient } from '@prisma/client';

import { BaseScraper, type ScrapedTender, type ScrapeResult } from './base-scraper';

export const TEST_PORTAL_NAME = 'LocalTestPortal';
export const TEST_PORTAL_KEY = 'testportal';

export interface TestPortalScraperOptions {
  prisma?: PrismaClient;
  maxConcurrency?: number;
  requestDelay?: number;
  maxPages?: number;
  fullRescrape?: boolean;
  /** Overrides TEST_PORTAL_URL; used by unit tests. */
  baseUrl?: string;
}

export class TestPortalScraper extends BaseScraper {
  constructor(options?: TestPortalScraperOptions) {
    super(
      TEST_PORTAL_NAME,
      options?.baseUrl ?? process.env.TEST_PORTAL_URL ?? 'http://127.0.0.1:18080',
      {
        // A mock on the Compose network needs no politeness delay, and the
        // staging verification relies on a run finishing well inside one
        // two-minute cron interval.
        maxConcurrency: options?.maxConcurrency ?? 2,
        requestDelay: options?.requestDelay ?? 50,
        retryCount: 1,
        retryDelay: 200,
        prisma: options?.prisma,
        maxPages: options?.maxPages ?? 1,
        fullRescrape: options?.fullRescrape,
      },
    );
  }

  getStateName(): string {
    return 'Test';
  }

  getMaxPages(): number {
    return 1;
  }

  buildListingUrl(page: number): string {
    return `${this.portalUrl}/tenders?page=${page}`;
  }

  buildDetailUrl(sourceId: string): string {
    return `${this.portalUrl}/tenders/${encodeURIComponent(sourceId)}`;
  }

  async scrape(): Promise<ScrapeResult> {
    const startTime = Date.now();
    let totalFound = 0;
    let newTenders = 0;
    let updatedTenders = 0;
    let errors = 0;
    let skippedExisting = 0;
    let pagesScraped = 0;

    this.logger.info('Starting mock-portal scraping run', { url: this.portalUrl });

    const pageBudget = (this as any).maxPages ?? this.getMaxPages();

    for (let page = 1; page <= pageBudget; page++) {
      // fetchPage throws once retries are exhausted, and the throw must
      // propagate: the worker turns it into a BullMQ failure and a FAILED run
      // record rather than a success-shaped result. That is precisely the
      // controlled-failure path the staging verification exercises.
      const listingHtml = await this.fetchPage(this.buildListingUrl(page), {
        headers: { Accept: 'text/html' },
      });

      const listings = this.parseTenderList(listingHtml);
      if (listings.length === 0) {
        this.logger.info(`No tenders on page ${page}, stopping pagination`);
        break;
      }

      pagesScraped++;
      totalFound += listings.length;

      const { toProcess, skipped } = await (this as any).partitionListings(listings);
      skippedExisting += skipped.length;

      for (const listing of toProcess) {
        if (!listing.sourceId) continue;
        try {
          const detailUrl = this.buildDetailUrl(listing.sourceId);
          const detail = this.parseTenderDetail(await this.fetchPage(detailUrl));

          const tender: ScrapedTender = {
            title: detail.title || listing.title || 'Untitled Test Tender',
            description: detail.description ?? listing.description,
            referenceNumber: listing.referenceNumber || listing.sourceId,
            organization: detail.organization || listing.organization || 'Test Organization',
            department: detail.department,
            tenderType: 'OPEN',
            category: 'WORKS',
            status: 'ACTIVE',
            state: 'Test',
            district: detail.district,
            estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
            emdAmount: detail.emdAmount,
            publishedDate: listing.publishedDate ?? new Date(),
            bidSubmissionDeadline:
              listing.bidSubmissionDeadline ?? new Date(Date.now() + 30 * 24 * 3600 * 1000),
            sourcePortal: this.portalName,
            sourceUrl: detailUrl,
            sourceId: listing.sourceId,
            reservedForMSME: false,
            reservedForStartups: false,
          } as ScrapedTender;

          const result = await (this as any).saveTender(tender);
          if (result?.isNew) newTenders++;
          else if (result?.changed) updatedTenders++;
          else skippedExisting++;
        } catch (err) {
          errors++;
          this.logger.error('Detail fetch/save failed', {
            sourceId: listing.sourceId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await (this as any).flushTenderIndexQueue('test-portal run finished');

    return {
      portal: this.portalName,
      totalFound,
      newTenders,
      updatedTenders,
      errors,
      duration: Date.now() - startTime,
      skippedExisting,
      pagesScraped,
    };
  }

  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const $ = this.loadHtml(html);
    const tenders: Partial<ScrapedTender>[] = [];

    $('table.tenderListTable tbody tr').each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 4) return;

      const sourceId = this.cleanText($cols.eq(0).text());
      const title = this.cleanText($cols.eq(1).text());
      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: sourceId,
        title,
        organization: this.cleanText($cols.eq(2).text()),
        estimatedValue: this.parseIndianCurrency($cols.eq(3).text()),
        publishedDate: this.parseIndianDate($cols.eq(4).text()),
        bidSubmissionDeadline: this.parseIndianDate($cols.eq(5).text()),
        sourcePortal: this.portalName,
        state: 'Test',
      });
    });

    return tenders;
  }

  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    const field = (label: string): string => {
      let value = '';
      $('table.detailTable tr').each((_, row) => {
        const key = this.cleanText($(row).find('td').eq(0).text());
        if (key.toLowerCase() === label.toLowerCase()) {
          value = this.cleanText($(row).find('td').eq(1).text());
        }
      });
      return value;
    };

    tender.title = field('title') || undefined;
    tender.description = field('description') || undefined;
    tender.organization = field('organization') || undefined;
    tender.department = field('department') || undefined;
    tender.district = field('district') || undefined;
    tender.estimatedValue = this.parseIndianCurrency(field('estimated value'));
    tender.emdAmount = this.parseIndianCurrency(field('emd'));

    return tender;
  }
}
