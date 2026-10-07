/**
 * eProcure Scraper — Government e-Procurement System
 *
 * URL: https://eprocure.gov.in/eprocure/app
 *
 * eProcure is the NIC-run procurement portal used by many central
 * and state government departments. Unlike CPPP (which aggregates),
 * eProcure hosts the actual tender documents and bid submission.
 *
 * Page structure:
 * - Active tenders page with search filters
 * - Paginated table with tender summaries
 * - Detail pages with full tender specification
 * - Document download links (NIT, BOQ, specifications)
 *
 * Note: eProcure uses ASP.NET-style form state (__VIEWSTATE,
 * __EVENTVALIDATION) for pagination.
 */

import { BaseScraper, ScrapedTender, ScrapeResult } from './base-scraper';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// eProcure Scraper
// ---------------------------------------------------------------------------

export class EProcureScraper extends BaseScraper {
  private readonly activeUrl: string;
  private readonly detailBaseUrl: string;

  constructor(options?: {
    prisma?: PrismaClient;
    maxConcurrency?: number;
    requestDelay?: number;
    maxPages?: number;
    fullRescrape?: boolean;
  }) {
    super('eProcure', 'https://eprocure.gov.in/eprocure/app', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });

    this.activeUrl = 'https://eprocure.gov.in/eprocure/app?page=FrontEndLatestActiveTenders&service=page';
    this.detailBaseUrl = 'https://eprocure.gov.in/eprocure/app';
  }

  // -----------------------------------------------------------------------
  // Main scrape orchestration
  // -----------------------------------------------------------------------

  async scrape(): Promise<ScrapeResult> {
    const startTime = Date.now();
    let totalFound = 0;
    let newTenders = 0;
    let updatedTenders = 0;
    let errors = 0;
    let skippedExisting = 0;
    let pagesScraped = 0;

    this.logger.info('Starting eProcure tender scraping run');

    try {
      // Fetch the active tenders page
      const firstPageHtml = await this.fetchPage(this.activeUrl, {
        headers: {
          Referer: 'https://eprocure.gov.in/eprocure/app',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      // Parse ASP.NET view state for pagination
      const viewState = this.extractViewState(firstPageHtml);

      const listings = this.parseTenderList(firstPageHtml);
      // Fetched and parsed into listings, so page 1 counts as scraped.
      // fetchPage() throws on failure, so a failed fetch never reaches here.
      if (listings.length > 0) pagesScraped++;
      totalFound += listings.length;

      this.logger.info(`Found ${listings.length} tenders on page 1`);

      // New-only: one batch existence check per page; known-and-unchanged
      // tenders never reach the detail fetch below.
      const firstPage = await this.partitionListings(listings);
      skippedExisting += firstPage.skipped.length;

      // Process each listing from first page
      for (const listing of firstPage.toProcess) {
        try {
          if (!listing.sourceId) continue;

          const detailUrl = this.buildDetailUrl(listing.sourceId);
          const detailHtml = await this.fetchPage(detailUrl, {
            headers: {
              Referer: this.activeUrl,
            },
          });

          const detail = this.parseTenderDetail(detailHtml);
          const tender = this.mergeTender(listing, detail);

          const result = await this.saveTender(tender);
          if (result.isNew) newTenders++;
          else updatedTenders++;

          await this.delay(this.requestDelay);
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'processeProcureTender',
            sourceId: listing.sourceId,
          });
        }
      }

      // Paginate through remaining pages
      const maxPages = 15;
      for (let page = 2; page <= maxPages; page++) {
        try {
          this.logger.info(`Fetching eProcure page ${page}/${maxPages}`);

          // eProcure uses form POST with view state for pagination
          const pageHtml = await this.fetchPage(this.activeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: this.activeUrl,
            },
            data: this.buildPaginationPayload(page, viewState),
          });

          const pageListings = this.parseTenderList(pageHtml);
          if (pageListings.length > 0) pagesScraped++;
          const pagePartition = await this.partitionListings(pageListings);
          skippedExisting += pagePartition.skipped.length;
          if (pageListings.length === 0) {
            this.logger.info(`No tenders on page ${page}, stopping pagination`);
            break;
          }

          totalFound += pageListings.length;
          this.logger.info(`Found ${pageListings.length} tenders on page ${page}`);

          for (const listing of pagePartition.toProcess) {
            try {
              if (!listing.sourceId) continue;

              const detailUrl = this.buildDetailUrl(listing.sourceId);
              const detailHtml = await this.fetchPage(detailUrl, {
                headers: { Referer: this.activeUrl },
              });

              const detail = this.parseTenderDetail(detailHtml);
              const tender = this.mergeTender(listing, detail);

              const result = await this.saveTender(tender);
              if (result.isNew) newTenders++;
              else updatedTenders++;

              await this.delay(this.requestDelay);
            } catch (err) {
              errors++;
              this.handleError(err instanceof Error ? err : new Error(String(err)), {
                action: 'processeProcureTender',
                sourceId: listing.sourceId,
                page,
              });
            }
          }
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'fetcheProcurePage',
            page,
          });
        }
      }
    } catch (err) {
      errors++;
      this.handleError(err instanceof Error ? err : new Error(String(err)), {
        action: 'eProcureScrapeMain',
      });
    } finally {
      // Guarantee every changed tender is queued, even on an early break or
      // error. main.ts calls closeBrowser() rather than cleanup(), so this is
      // the end-of-run flush for a scheduled/manual run.
      await this.flushTenderIndexQueue();
      await this.closeBrowser();
    }

    const duration = Date.now() - startTime;
    this.logger.info('eProcure scraping complete', {
      totalFound,
      newTenders,
      updatedTenders,
      skippedExisting,
      pagesScraped,
      errors,
      durationMs: duration,
    });

    return {
      portal: this.portalName,
      totalFound,
      newTenders,
      updatedTenders,
      errors,
      duration,
      skippedExisting,
      pagesScraped,
    };
  }

  // -----------------------------------------------------------------------
  // HTML Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse eProcure active tenders listing table.
   *
   * Table columns (typical layout):
   *  S.No | Tender ID | Published Date | Closing Date | Opening Date |
   *  Title/Description | Organisation Chain | Tender Value
   */
  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // eProcure renders tenders in a table
    $(
      'table.list_table tbody tr, ' +
      'table#activeTenders tbody tr, ' +
      '#tabData table tbody tr, ' +
      '.page_table tbody tr'
    ).each((_, row) => {
      const $cols = $(row).find('td');
      if ($cols.length < 6) return;

      // Determine column mapping — eProcure has varying layouts
      let sourceId: string;
      let title: string;
      let organization: string;
      let publishDateText: string;
      let closingDateText: string;
      let openingDateText: string;
      let valueText: string;

      if ($cols.length >= 8) {
        // Standard 8-column layout
        sourceId = this.cleanText($cols.eq(1).text());
        publishDateText = this.cleanText($cols.eq(2).text());
        closingDateText = this.cleanText($cols.eq(3).text());
        openingDateText = this.cleanText($cols.eq(4).text());
        title = this.cleanText($cols.eq(5).text());
        organization = this.cleanText($cols.eq(6).text());
        valueText = this.cleanText($cols.eq(7).text());
      } else {
        // Compact layout
        sourceId = this.cleanText($cols.eq(0).text());
        title = this.cleanText($cols.eq(1).text());
        organization = this.cleanText($cols.eq(2).text());
        publishDateText = this.cleanText($cols.eq(3).text());
        closingDateText = this.cleanText($cols.eq(4).text());
        openingDateText = '';
        valueText = $cols.length > 5 ? this.cleanText($cols.eq(5).text()) : '';
      }

      // Try to extract tender ID from link
      const $link = $(row).find('a[href*="tenderid"], a[href*="tenderId"]');
      const linkHref = $link.attr('href') || '';
      const linkId = this.extractTenderId(linkHref);
      if (linkId) sourceId = linkId;

      // Clean serial number prefix from sourceId
      sourceId = sourceId.replace(/^\d+\.\s*/, '');

      if (!sourceId || !title) return;

      tenders.push({
        sourceId,
        referenceNumber: sourceId,
        title,
        organization,
        estimatedValue: this.parseIndianCurrency(valueText),
        publishedDate: this.parseIndianDate(publishDateText),
        bidSubmissionDeadline: this.parseIndianDate(closingDateText),
        bidOpeningDate: this.parseIndianDate(openingDateText) || undefined,
        sourcePortal: 'eProcure',
        sourceUrl: linkHref.startsWith('http')
          ? linkHref
          : `${this.detailBaseUrl}?page=FrontEndTendersByOrganisation&service=page&tenderid=${sourceId}`,
        state: 'All India',
      });
    });

    return tenders;
  }

  /**
   * Parse an eProcure tender detail page.
   *
   * Detail pages have a two-column label-value table, plus document links.
   */
  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    // Build a field map from label-value pairs
    const fieldMap = new Map<string, string>();

    $('table tr, .detail-row, .form-group').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td, th, .label, .value');

      if (cells.length >= 2) {
        const label = this.cleanText(cells.eq(0).text()).toLowerCase();
        const value = this.cleanText(cells.eq(1).text());
        if (label && value) {
          fieldMap.set(label, value);
        }
      }
    });

    // Helper to find field by partial label match
    const findField = (...labels: string[]): string => {
      for (const label of labels) {
        for (const [key, value] of fieldMap) {
          if (key.includes(label.toLowerCase())) return value;
        }
      }
      return '';
    };

    // Core fields
    tender.referenceNumber = findField('tender ref', 'tender id', 'nit no', 'bid number', 'reference');
    tender.title = findField('work description', 'title', 'tender title', 'item description', 'subject');
    tender.description = findField('work description', 'brief description', 'scope of work', 'description');
    tender.organization = findField('organisation', 'ministry', 'department name', 'organization', 'buyer org');
    tender.department = findField('sub department', 'division', 'office');

    // Location
    tender.state = findField('state', 'location') || 'All India';
    tender.district = findField('district', 'city');
    tender.city = findField('city', 'pincode');

    // Financial
    tender.estimatedValue = this.parseIndianCurrency(
      findField('tender value', 'estimated cost', 'product value', 'estimated amount', 'contract value'),
    );
    tender.emdAmount = this.parseIndianCurrency(
      findField('emd', 'earnest money', 'bid security', 'emd amount'),
    );

    // Dates
    tender.publishedDate = this.parseIndianDate(
      findField('published date', 'publish date', 'e-published', 'bid publish'),
    );
    tender.bidSubmissionDeadline = this.parseIndianDate(
      findField('bid submission end', 'closing date', 'last date', 'submission deadline', 'bid end'),
    );
    tender.bidOpeningDate = this.parseIndianDate(
      findField('bid opening', 'opening date', 'tender opening'),
    );
    tender.preBidMeetingDate = this.parseIndianDate(
      findField('pre-bid', 'pre bid meeting', 'prebid'),
    );

    // Tender type
    const tenderTypeText = findField('tender type', 'bid type', 'procurement type');
    tender.tenderType = this.mapTenderType(tenderTypeText);

    // Category
    const categoryText = findField('product category', 'category', 'item category', 'tender category');
    tender.category = this.mapCategory(categoryText);

    // MSE/Startup
    const mseText = findField('mse', 'msme', 'micro small').toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable') || mseText.includes('true');
    tender.emdExemptMSME = tender.reservedForMSME;

    const startupText = findField('startup').toLowerCase();
    tender.reservedForStartups = startupText.includes('yes') || startupText.includes('applicable');

    // Documents
    const documents: NonNullable<ScrapedTender['documents']> = [];

    $('a[href*="download"], a[href*="getDocument"], a[href*=".pdf"], a[href*=".doc"], .tender-doc a, a.doc-link').each(
      (_, el) => {
        const $link = $(el);
        const href = $link.attr('href');
        const name = this.cleanText($link.text()) || 'Tender Document';

        if (href && name && !name.toLowerCase().includes('login')) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://eprocure.gov.in${href}`;

          // Avoid duplicate document URLs
          if (!documents.some((d) => d.fileUrl === fullUrl)) {
            documents.push({
              name,
              fileUrl: fullUrl,
              fileType: this.extractFileExtension(href),
            });
          }
        }
      },
    );

    // Also check for NIT/BOQ specific download links
    $('a[href*="nitDocument"], a[href*="BOQ"], a[href*="TenderDoc"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const name = this.cleanText($link.text()) || 'NIT Document';
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://eprocure.gov.in${href}`;
        if (!documents.some((d) => d.fileUrl === fullUrl)) {
          documents.push({
            name,
            fileUrl: fullUrl,
            fileType: this.extractFileExtension(href),
          });
        }
      }
    });

    if (documents.length > 0) {
      tender.documents = documents;
    }

    return tender;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private buildDetailUrl(sourceId: string): string {
    return `${this.detailBaseUrl}?page=FrontEndTendersByOrganisation&service=page&tenderid=${sourceId}`;
  }

  private extractTenderId(url: string): string {
    if (!url) return '';
    const match = url.match(/tenderid=(\d+)/i) || url.match(/tenderId=(\d+)/i) || url.match(/id=(\d+)/i);
    return match ? match[1] : '';
  }

  /**
   * Extract ASP.NET form state values for pagination.
   */
  private extractViewState(html: string): Record<string, string> {
    const $ = this.loadHtml(html);
    const viewState: Record<string, string> = {};

    // Extract hidden form fields used for pagination
    $('input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name');
      const value = $(el).attr('value') || '';
      if (name) {
        viewState[name] = value;
      }
    });

    return viewState;
  }

  /**
   * Build the form POST payload for pagination.
   */
  private buildPaginationPayload(page: number, viewState: Record<string, string>): string {
    const params = new URLSearchParams();

    // Include view state fields
    for (const [key, value] of Object.entries(viewState)) {
      params.append(key, value);
    }

    // eProcure-specific pagination params
    params.append('page', String(page));
    params.append('actionVal', 'showRecords');

    return params.toString();
  }

  /**
   * Merge listing data with detail data, preferring detail where available.
   */
  private mergeTender(
    listing: Partial<ScrapedTender>,
    detail: Partial<ScrapedTender>,
  ): ScrapedTender {
    return {
      title: detail.title || listing.title || 'Untitled eProcure Tender',
      description: detail.description || listing.description,
      referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
      organization: detail.organization || listing.organization || 'Government of India',
      department: detail.department || listing.department,
      tenderType: detail.tenderType || listing.tenderType || 'OPEN',
      category: detail.category || listing.category || 'WORKS',
      status: detail.status || listing.status || 'ACTIVE',
      state: detail.state || listing.state || 'All India',
      district: detail.district || listing.district,
      city: detail.city || listing.city,
      estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
      emdAmount: detail.emdAmount ?? listing.emdAmount,
      publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
      bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
      bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
      preBidMeetingDate: detail.preBidMeetingDate,
      sourcePortal: 'eProcure',
      sourceUrl: listing.sourceUrl || this.buildDetailUrl(listing.sourceId!),
      sourceId: listing.sourceId!,
      reservedForMSME: detail.reservedForMSME ?? listing.reservedForMSME ?? false,
      reservedForStartups: detail.reservedForStartups ?? listing.reservedForStartups ?? false,
      emdExemptMSME: detail.emdExemptMSME ?? listing.emdExemptMSME ?? false,
      documents: detail.documents,
    };
  }

  private mapTenderType(
    typeStr: string | undefined,
  ): ScrapedTender['tenderType'] {
    if (!typeStr) return 'OPEN';
    const lower = typeStr.toLowerCase();
    if (lower.includes('limited')) return 'LIMITED';
    if (lower.includes('single')) return 'SINGLE';
    if (lower.includes('two') || lower.includes('2-packet')) return 'TWO_PACKET';
    if (lower.includes('eoi') || lower.includes('expression')) return 'EOI';
    if (lower.includes('auction') || lower.includes('reverse')) return 'AUCTION';
    if (lower.includes('rfp') || lower.includes('request for proposal')) return 'RFP';
    if (lower.includes('rfq') || lower.includes('quotation')) return 'RFQ';
    return 'OPEN';
  }

  private mapCategory(
    category: string | undefined,
  ): ScrapedTender['category'] {
    if (!category) return 'WORKS';
    const lower = category.toLowerCase();
    if (lower.includes('good') || lower.includes('supply') || lower.includes('material') || lower.includes('equipment')) return 'GOODS';
    if (lower.includes('service') || lower.includes('maintenance') || lower.includes('hiring') || lower.includes('outsourc')) return 'SERVICES';
    if (lower.includes('consult') || lower.includes('advisory') || lower.includes('study')) return 'CONSULTANCY';
    return 'WORKS';
  }

  private extractFileExtension(url: string): string | undefined {
    const match = url.match(/\.(\w{2,5})(?:\?|$)/);
    return match ? match[1].toLowerCase() : undefined;
  }
}
