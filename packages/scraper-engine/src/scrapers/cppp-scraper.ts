import { BaseScraper, ScrapedTender, ScrapeResult } from './base-scraper';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// CPPP Scraper — Central Public Procurement Portal
// ---------------------------------------------------------------------------

/**
 * Scraper for Central Public Procurement Portal (CPPP)
 * URL: https://eprocure.gov.in/cppp
 *
 * CPPP lists tenders from central government departments in HTML tables.
 * The portal uses server-side rendering with pagination via form POST requests.
 * Date format: DD/MM/YYYY HH:mm
 */
export class CpppScraper extends BaseScraper {
  private readonly searchUrl: string;
  private readonly detailBaseUrl: string;

  constructor(options?: {
    prisma?: PrismaClient;
    maxConcurrency?: number;
    requestDelay?: number;
    maxPages?: number;
    fullRescrape?: boolean;
  }) {
    super('CPPP', 'https://eprocure.gov.in/cppp', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages,
      fullRescrape: options?.fullRescrape,
    });

    this.searchUrl = 'https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata';
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

    this.logger.info('Starting CPPP tender scraping run');

    try {
      // CPPP uses a paginated table. First page load to get session and total count.
      const firstPageHtml = await this.fetchPage(this.searchUrl, {
        headers: {
          Referer: 'https://eprocure.gov.in/cppp/',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      const listings = this.parseTenderList(firstPageHtml);
      totalFound += listings.length;

      this.logger.info(`Found ${listings.length} tenders on page 1`);

      // New-only: one batch existence check per page; known-and-unchanged
      // tenders never reach the detail fetch below.
      const firstPage = await this.partitionListings(listings);
      skippedExisting += firstPage.skipped.length;

      // Process each listing
      for (const listing of firstPage.toProcess) {
        try {
          if (!listing.sourceId) continue;

          // Fetch individual tender detail page
          const detailUrl = `${this.detailBaseUrl}?page=FrontEndTendersByOrganisation&service=page&tenderid=${listing.sourceId}`;
          const detailHtml = await this.fetchPage(detailUrl, {
            headers: {
              Referer: this.searchUrl,
            },
          });

          const detail = this.parseTenderDetail(detailHtml);

          const tender: ScrapedTender = {
            title: detail.title || listing.title || 'Untitled CPPP Tender',
            description: detail.description || listing.description,
            referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
            organization: detail.organization || listing.organization || 'Central Government',
            department: detail.department || listing.department,
            tenderType: this.mapCpppTenderType(listing.tenderType),
            category: detail.category || listing.category || 'WORKS',
            status: 'ACTIVE',
            state: detail.state || listing.state || 'All India',
            district: detail.district,
            city: detail.city,
            estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
            emdAmount: detail.emdAmount ?? listing.emdAmount,
            publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
            bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
            bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
            preBidMeetingDate: detail.preBidMeetingDate,
            sourcePortal: 'CPPP',
            sourceUrl: `https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByOrganisation&service=page&tenderid=${listing.sourceId}`,
            sourceId: listing.sourceId!,
            reservedForMSME: listing.reservedForMSME ?? detail.reservedForMSME ?? false,
            reservedForStartups: listing.reservedForStartups ?? detail.reservedForStartups ?? false,
            documents: detail.documents,
          };

          const result = await this.saveTender(tender);
          if (result.isNew) newTenders++;
          else updatedTenders++;

          await this.delay(this.requestDelay);
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'processCpppTender',
            sourceId: listing.sourceId,
          });
        }
      }

      // Pagination — CPPP typically uses page numbers via POST
      const totalPages = this.extractTotalPages(firstPageHtml);
      for (let page = 2; page <= Math.min(totalPages, 20); page++) {
        try {
          this.logger.info(`Fetching CPPP page ${page}/${totalPages}`);

          const pageHtml = await this.fetchPage(this.searchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: this.searchUrl,
            },
            data: `page=${page}&actionVal=showRecords`,
          });

          const pageListings = this.parseTenderList(pageHtml);
          totalFound += pageListings.length;

          const pagePartition = await this.partitionListings(pageListings);
          skippedExisting += pagePartition.skipped.length;

          for (const listing of pagePartition.toProcess) {
            try {
              if (!listing.sourceId) continue;

              const detailUrl = `${this.detailBaseUrl}?page=FrontEndTendersByOrganisation&service=page&tenderid=${listing.sourceId}`;
              const detailHtml = await this.fetchPage(detailUrl);
              const detail = this.parseTenderDetail(detailHtml);

              const tender: ScrapedTender = {
                title: detail.title || listing.title || 'Untitled CPPP Tender',
                description: detail.description || listing.description,
                referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
                organization: detail.organization || listing.organization || 'Central Government',
                department: detail.department || listing.department,
                tenderType: this.mapCpppTenderType(listing.tenderType),
                category: detail.category || listing.category || 'WORKS',
                status: 'ACTIVE',
                state: detail.state || listing.state || 'All India',
                district: detail.district,
                city: detail.city,
                estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
                emdAmount: detail.emdAmount ?? listing.emdAmount,
                publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
                bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
                bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
                preBidMeetingDate: detail.preBidMeetingDate,
                sourcePortal: 'CPPP',
                sourceUrl: `https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByOrganisation&service=page&tenderid=${listing.sourceId}`,
                sourceId: listing.sourceId!,
                reservedForMSME: listing.reservedForMSME ?? false,
                reservedForStartups: listing.reservedForStartups ?? false,
                documents: detail.documents,
              };

              const result = await this.saveTender(tender);
              if (result.isNew) newTenders++;
              else updatedTenders++;

              await this.delay(this.requestDelay);
            } catch (err) {
              errors++;
              this.handleError(err instanceof Error ? err : new Error(String(err)), {
                action: 'processCpppTender',
                sourceId: listing.sourceId,
                page,
              });
            }
          }
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'fetchCpppPage',
            page,
          });
        }
      }
    } catch (err) {
      errors++;
      this.handleError(err instanceof Error ? err : new Error(String(err)), {
        action: 'cpppScrapeMain',
      });
    } finally {
      await this.closeBrowser();
    }

    const duration = Date.now() - startTime;
    this.logger.info('CPPP scraping complete', {
      totalFound,
      newTenders,
      updatedTenders,
      skippedExisting,
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
    };
  }

  // -----------------------------------------------------------------------
  // HTML Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse CPPP tender listing table.
   *
   * CPPP renders tenders in a table with columns:
   *  S.No | e-Published Date | Closing Date | Opening Date | Title | Org/Division | Tender Value | Tender ID
   */
  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];
    const $ = this.loadHtml(html);

    // CPPP uses a main table for tender listings
    $('table.list_table tbody tr, table#table1 tbody tr, .tender-list-table tbody tr').each(
      (_, row) => {
        const $cols = $(row).find('td');
        if ($cols.length < 5) return; // Skip header or malformed rows

        // Extract data from columns
        const publishDateText = this.cleanText($cols.eq(1).text());
        const closingDateText = this.cleanText($cols.eq(2).text());
        const openingDateText = this.cleanText($cols.eq(3).text());

        // Title column often contains a link with tender ID
        const $titleCol = $cols.eq(4);
        const title = this.cleanText($titleCol.text());
        const tenderLink = $titleCol.find('a').attr('href') || '';
        const sourceId = this.extractTenderId(tenderLink) || this.cleanText($cols.eq(7).text());

        const organization = this.cleanText($cols.eq(5).text());
        const valueText = this.cleanText($cols.eq(6).text());
        const refNumber = this.cleanText($cols.eq(7).text()) || sourceId;

        if (!sourceId || !title) return;

        tenders.push({
          sourceId,
          referenceNumber: refNumber,
          title,
          organization,
          estimatedValue: this.parseIndianCurrency(valueText),
          publishedDate: this.parseIndianDate(publishDateText),
          bidSubmissionDeadline: this.parseIndianDate(closingDateText),
          bidOpeningDate: this.parseIndianDate(openingDateText),
          sourcePortal: 'CPPP',
          sourceUrl: tenderLink.startsWith('http')
            ? tenderLink
            : `https://eprocure.gov.in${tenderLink}`,
          state: 'All India',
        });
      },
    );

    return tenders;
  }

  /**
   * Parse a CPPP tender detail page.
   *
   * Detail pages use a two-column table with label-value pairs.
   */
  parseTenderDetail(html: string): Partial<ScrapedTender> {
    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    // Helper to find a value by its label text
    const findFieldValue = (label: string): string => {
      let value = '';
      $('table tr, .detail-row').each((_, row) => {
        const $row = $(row);
        const labelText = this.cleanText($row.find('td:first-child, .label, th').text());
        if (labelText.toLowerCase().includes(label.toLowerCase())) {
          value = this.cleanText($row.find('td:last-child, .value, td:nth-child(2)').text());
        }
      });
      return value;
    };

    // Core fields
    tender.referenceNumber = findFieldValue('tender reference') || findFieldValue('tender id') || findFieldValue('NIT No');
    tender.title = findFieldValue('work description') || findFieldValue('title') || findFieldValue('tender title');
    tender.description = findFieldValue('work description') || findFieldValue('brief description');
    tender.organization = findFieldValue('organisation') || findFieldValue('ministry') || findFieldValue('department name');
    tender.department = findFieldValue('department') || findFieldValue('division');

    // Location
    tender.state = findFieldValue('state') || findFieldValue('location') || 'All India';
    tender.district = findFieldValue('district') || findFieldValue('city');
    tender.city = findFieldValue('city') || findFieldValue('pincode');

    // Values
    tender.estimatedValue = this.parseIndianCurrency(
      findFieldValue('tender value') || findFieldValue('estimated cost') || findFieldValue('product value'),
    );
    tender.emdAmount = this.parseIndianCurrency(
      findFieldValue('emd') || findFieldValue('earnest money') || findFieldValue('bid security'),
    );

    // Dates (DD/MM/YYYY HH:mm format)
    tender.publishedDate = this.parseIndianDate(
      findFieldValue('published date') || findFieldValue('publish date') || findFieldValue('e-published'),
    );
    tender.bidSubmissionDeadline = this.parseIndianDate(
      findFieldValue('bid submission end') || findFieldValue('closing date') || findFieldValue('last date'),
    );
    tender.bidOpeningDate = this.parseIndianDate(
      findFieldValue('bid opening') || findFieldValue('opening date') || findFieldValue('tender opening'),
    );
    tender.preBidMeetingDate = this.parseIndianDate(
      findFieldValue('pre-bid') || findFieldValue('pre bid meeting'),
    );

    // Tender type
    const tenderTypeText = findFieldValue('tender type') || findFieldValue('bid type');
    tender.tenderType = this.mapCpppTenderType(tenderTypeText);

    // Category
    const categoryText = findFieldValue('product category') || findFieldValue('category');
    tender.category = this.mapCpppCategory(categoryText);

    // MSE / Startup preferences
    const mseText = (findFieldValue('mse') || findFieldValue('msme')).toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('applicable');

    const startupText = findFieldValue('startup').toLowerCase();
    tender.reservedForStartups = startupText.includes('yes') || startupText.includes('applicable');

    // Documents
    const documents: ScrapedTender['documents'] = [];
    $('a[href*="download"], a[href*="document"], .tender-doc a, a.doc-link').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const name = this.cleanText($link.text()) || 'Tender Document';
      if (href) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `https://eprocure.gov.in${href}`,
          fileType: this.extractFileExtension(href),
        });
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

  /**
   * Extract total page count from pagination HTML.
   */
  private extractTotalPages(html: string): number {
    const $ = this.loadHtml(html);

    // Try to find pagination info like "Page 1 of 25" or total records
    const paginationText = this.cleanText($('.pagination-info, .page-info, .paging-text').text());
    const matchPages = paginationText.match(/of\s+(\d+)/i);
    if (matchPages) {
      return parseInt(matchPages[1], 10);
    }

    // Count pagination links
    const lastPageLink = $('a.page-link:last, .pagination li:last-child a').attr('href');
    if (lastPageLink) {
      const pageMatch = lastPageLink.match(/page=(\d+)/);
      if (pageMatch) return parseInt(pageMatch[1], 10);
    }

    // Default: assume 5 pages if we can't determine
    return 5;
  }

  /**
   * Extract tender ID from a URL or link.
   */
  private extractTenderId(url: string): string {
    if (!url) return '';
    const match = url.match(/tenderid=(\d+)/i) || url.match(/id=(\d+)/i);
    return match ? match[1] : '';
  }

  private mapCpppTenderType(
    typeStr: string | undefined,
  ): 'OPEN' | 'LIMITED' | 'SINGLE' | 'TWO_PACKET' | 'EOI' | 'AUCTION' | 'RFP' | 'RFQ' {
    if (!typeStr) return 'OPEN';
    const lower = typeStr.toLowerCase();
    if (lower.includes('limited')) return 'LIMITED';
    if (lower.includes('single')) return 'SINGLE';
    if (lower.includes('two') || lower.includes('2-packet') || lower.includes('two packet')) return 'TWO_PACKET';
    if (lower.includes('eoi') || lower.includes('expression')) return 'EOI';
    if (lower.includes('auction') || lower.includes('reverse')) return 'AUCTION';
    if (lower.includes('rfp') || lower.includes('request for proposal')) return 'RFP';
    if (lower.includes('rfq') || lower.includes('request for quote') || lower.includes('quotation')) return 'RFQ';
    return 'OPEN';
  }

  private mapCpppCategory(
    category: string | undefined,
  ): 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY' {
    if (!category) return 'WORKS';
    const lower = category.toLowerCase();
    if (lower.includes('good') || lower.includes('supply') || lower.includes('material')) return 'GOODS';
    if (lower.includes('service') || lower.includes('maintenance') || lower.includes('hiring')) return 'SERVICES';
    if (lower.includes('consult') || lower.includes('advisory')) return 'CONSULTANCY';
    return 'WORKS';
  }

  private extractFileExtension(url: string): string | undefined {
    const match = url.match(/\.(\w{2,5})(?:\?|$)/);
    return match ? match[1].toLowerCase() : undefined;
  }
}
