import { BaseScraper, ScrapedTender, ScrapeResult } from './base-scraper';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types for GeM API responses
// ---------------------------------------------------------------------------

interface GemBidSearchResponse {
  data?: GemBidItem[];
  totalRecords?: number;
  pageNo?: number;
  pageSize?: number;
}

interface GemBidItem {
  bidId?: string;
  bidNumber?: string;
  itemDescription?: string;
  bidTitle?: string;
  organizationName?: string;
  departmentName?: string;
  bidCategory?: string;
  estimatedValue?: number;
  emdAmount?: number;
  publishDate?: string;
  bidEndDate?: string;
  bidOpenDate?: string;
  mseExemption?: boolean;
  startupExemption?: boolean;
  bidUrl?: string;
  state?: string;
  district?: string;
  quantity?: number;
  uom?: string;
  deliveryDays?: number;
}

interface GemBidDetailResponse {
  data?: GemBidDetail;
}

interface GemBidDetail extends GemBidItem {
  specifications?: string;
  consigneeName?: string;
  consigneeAddress?: string;
  paymentTerms?: string;
  warrantyPeriod?: string;
  documents?: Array<{
    fileName?: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
  }>;
}

// ---------------------------------------------------------------------------
// GeM Scraper
// ---------------------------------------------------------------------------

/**
 * Scraper for Government e-Marketplace (GeM) - https://gem.gov.in
 *
 * GeM provides a search API for bid listings. This scraper uses the API
 * endpoints to fetch bid data and then scrapes individual bid detail pages
 * for complete information.
 */
export class GemScraper extends BaseScraper {
  private readonly searchApiUrl: string;
  private readonly bidDetailApiUrl: string;
  private readonly pageSize: number = 50;

  constructor(options?: {
    prisma?: PrismaClient;
    maxConcurrency?: number;
    requestDelay?: number;
  }) {
    super('GeM', 'https://gem.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
    });

    // GeM API endpoints (representative — actual endpoints require auth/API keys)
    this.searchApiUrl = 'https://bidplus.gem.gov.in/all-bids-search';
    this.bidDetailApiUrl = 'https://bidplus.gem.gov.in/bid-detail';
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

    this.logger.info('Starting GeM bid scraping run');

    try {
      // Fetch the first page to determine total records
      const firstPageHtml = await this.fetchPage(this.searchApiUrl, {
        headers: {
          Accept: 'text/html,application/json',
          Referer: 'https://gem.gov.in/',
        },
      });

      const listings = this.parseTenderList(firstPageHtml);
      totalFound += listings.length;

      // Process each listing
      for (const listing of listings) {
        try {
          if (!listing.sourceId) continue;

          // Fetch detail page for each bid
          const detailUrl = `${this.bidDetailApiUrl}/${listing.sourceId}`;
          const detailHtml = await this.fetchPage(detailUrl, {
            headers: {
              Accept: 'text/html,application/json',
              Referer: this.searchApiUrl,
            },
          });

          const detail = this.parseTenderDetail(detailHtml);

          // Merge listing and detail data
          const tender: ScrapedTender = {
            title: detail.title || listing.title || 'Untitled GeM Bid',
            description: detail.description || listing.description,
            referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
            organization: detail.organization || listing.organization || 'Unknown',
            department: detail.department || listing.department,
            tenderType: 'RFQ',
            category: this.mapGemCategory(listing.category),
            status: 'ACTIVE',
            state: detail.state || listing.state || 'All India',
            district: detail.district || listing.district,
            estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
            emdAmount: detail.emdAmount ?? listing.emdAmount,
            publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
            bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
            bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
            sourcePortal: 'GeM',
            sourceUrl: `https://bidplus.gem.gov.in/showbidDocument/${listing.sourceId}`,
            sourceId: listing.sourceId!,
            reservedForMSME: listing.reservedForMSME ?? detail.reservedForMSME ?? false,
            reservedForStartups: listing.reservedForStartups ?? detail.reservedForStartups ?? false,
            emdExemptMSME: listing.emdExemptMSME ?? detail.emdExemptMSME ?? false,
            documents: detail.documents,
          };

          const result = await this.saveTender(tender);
          if (result.isNew) newTenders++;
          else updatedTenders++;

          // Respect rate limits between detail fetches
          await this.delay(this.requestDelay);
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'processGemBid',
            sourceId: listing.sourceId,
          });
        }
      }

      // Fetch additional pages
      const totalPages = Math.ceil(totalFound / this.pageSize);
      for (let page = 2; page <= Math.min(totalPages, 10); page++) {
        try {
          const pageUrl = `${this.searchApiUrl}?page=${page}&pageSize=${this.pageSize}`;
          const pageHtml = await this.fetchPage(pageUrl, {
            headers: {
              Accept: 'text/html,application/json',
              Referer: this.searchApiUrl,
            },
          });

          const pageListings = this.parseTenderList(pageHtml);
          totalFound += pageListings.length;

          for (const listing of pageListings) {
            try {
              if (!listing.sourceId) continue;

              const detailUrl = `${this.bidDetailApiUrl}/${listing.sourceId}`;
              const detailHtml = await this.fetchPage(detailUrl);

              const detail = this.parseTenderDetail(detailHtml);

              const tender: ScrapedTender = {
                title: detail.title || listing.title || 'Untitled GeM Bid',
                description: detail.description || listing.description,
                referenceNumber: listing.referenceNumber || detail.referenceNumber || listing.sourceId!,
                organization: detail.organization || listing.organization || 'Unknown',
                department: detail.department || listing.department,
                tenderType: 'RFQ',
                category: this.mapGemCategory(listing.category),
                status: 'ACTIVE',
                state: detail.state || listing.state || 'All India',
                district: detail.district || listing.district,
                estimatedValue: detail.estimatedValue ?? listing.estimatedValue,
                emdAmount: detail.emdAmount ?? listing.emdAmount,
                publishedDate: listing.publishedDate || detail.publishedDate || new Date(),
                bidSubmissionDeadline: listing.bidSubmissionDeadline || detail.bidSubmissionDeadline || new Date(),
                bidOpeningDate: detail.bidOpeningDate || listing.bidOpeningDate,
                sourcePortal: 'GeM',
                sourceUrl: `https://bidplus.gem.gov.in/showbidDocument/${listing.sourceId}`,
                sourceId: listing.sourceId!,
                reservedForMSME: listing.reservedForMSME ?? false,
                reservedForStartups: listing.reservedForStartups ?? false,
                emdExemptMSME: listing.emdExemptMSME ?? false,
                documents: detail.documents,
              };

              const result = await this.saveTender(tender);
              if (result.isNew) newTenders++;
              else updatedTenders++;

              await this.delay(this.requestDelay);
            } catch (err) {
              errors++;
              this.handleError(err instanceof Error ? err : new Error(String(err)), {
                action: 'processGemBid',
                sourceId: listing.sourceId,
                page,
              });
            }
          }
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'fetchGemPage',
            page,
          });
        }
      }
    } catch (err) {
      errors++;
      this.handleError(err instanceof Error ? err : new Error(String(err)), {
        action: 'gemScrapeMain',
      });
    } finally {
      await this.closeBrowser();
    }

    const duration = Date.now() - startTime;
    this.logger.info(`GeM scraping complete`, {
      totalFound,
      newTenders,
      updatedTenders,
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
    };
  }

  // -----------------------------------------------------------------------
  // HTML / JSON Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse the GeM bid listing page.
   * GeM renders bids in a table/card layout with bid details.
   */
  parseTenderList(html: string): Partial<ScrapedTender>[] {
    const tenders: Partial<ScrapedTender>[] = [];

    // Try parsing as JSON first (API response)
    try {
      const jsonData = JSON.parse(html) as GemBidSearchResponse;
      if (jsonData.data && Array.isArray(jsonData.data)) {
        for (const bid of jsonData.data) {
          tenders.push(this.mapGemBidToTender(bid));
        }
        return tenders;
      }
    } catch {
      // Not JSON — parse as HTML
    }

    // Parse HTML listing page
    const $ = this.loadHtml(html);

    // GeM bid listing cards
    $('#pagi_content .bid_no, .bid-result-item, tr[data-bidid]').each((_, el) => {
      const $row = $(el);

      const bidId = $row.attr('data-bidid') || this.cleanText($row.find('.bid_no_value, .bid-id').text());
      const title = this.cleanText($row.find('.bid_title, .item-description, td:nth-child(2)').text());
      const org = this.cleanText($row.find('.org_name, .department-name, td:nth-child(3)').text());
      const valueText = this.cleanText($row.find('.bid_value, .estimated-value, td:nth-child(4)').text());
      const emdText = this.cleanText($row.find('.emd_value, .emd-amount, td:nth-child(5)').text());
      const startDate = this.cleanText($row.find('.start_date, .publish-date, td:nth-child(6)').text());
      const endDate = this.cleanText($row.find('.end_date, .end-date, td:nth-child(7)').text());
      const category = this.cleanText($row.find('.bid_category, .category, td:nth-child(8)').text());

      const mseExempt = $row.find('.mse-exempt, .mse_exemption').length > 0
        || $row.text().toLowerCase().includes('mse exemption');
      const startupExempt = $row.text().toLowerCase().includes('startup');

      if (bidId) {
        tenders.push({
          sourceId: bidId,
          title: title || `GeM Bid ${bidId}`,
          organization: org,
          category: this.mapGemCategory(category),
          estimatedValue: this.parseIndianCurrency(valueText),
          emdAmount: this.parseIndianCurrency(emdText),
          publishedDate: this.parseIndianDate(startDate),
          bidSubmissionDeadline: this.parseIndianDate(endDate),
          sourcePortal: 'GeM',
          sourceUrl: `https://bidplus.gem.gov.in/showbidDocument/${bidId}`,
          reservedForMSME: mseExempt,
          reservedForStartups: startupExempt,
          emdExemptMSME: mseExempt,
          referenceNumber: bidId,
          state: 'All India',
        });
      }
    });

    return tenders;
  }

  /**
   * Parse a GeM bid detail page for complete tender information.
   */
  parseTenderDetail(html: string): Partial<ScrapedTender> {
    // Try parsing as JSON first
    try {
      const jsonData = JSON.parse(html) as GemBidDetailResponse;
      if (jsonData.data) {
        return this.mapGemBidDetailToTender(jsonData.data);
      }
    } catch {
      // Not JSON — parse as HTML
    }

    const $ = this.loadHtml(html);
    const tender: Partial<ScrapedTender> = {};

    // Bid number / reference
    tender.referenceNumber = this.cleanText(
      $('#bidNumber, .bid-number-value, [data-field="bidNumber"]').text(),
    );

    // Title / description
    tender.title = this.cleanText($('#itemDescription, .bid-title, h2.bid-heading').text());
    tender.description = this.cleanText(
      $('#specifications, .bid-description, .item-specifications').text(),
    );

    // Organization and department
    tender.organization = this.cleanText(
      $('#organizationName, .org-name, [data-field="orgName"]').text(),
    );
    tender.department = this.cleanText(
      $('#departmentName, .dept-name, [data-field="deptName"]').text(),
    );

    // Values
    const estValueText = this.cleanText(
      $('#estimatedValue, .estimated-value, [data-field="estimatedValue"]').text(),
    );
    tender.estimatedValue = this.parseIndianCurrency(estValueText);

    const emdText = this.cleanText(
      $('#emdAmount, .emd-amount, [data-field="emdAmount"]').text(),
    );
    tender.emdAmount = this.parseIndianCurrency(emdText);

    // Dates
    const publishDate = this.cleanText(
      $('#publishDate, .publish-date, [data-field="publishDate"]').text(),
    );
    tender.publishedDate = this.parseIndianDate(publishDate);

    const endDate = this.cleanText(
      $('#bidEndDate, .bid-end-date, [data-field="bidEndDate"]').text(),
    );
    tender.bidSubmissionDeadline = this.parseIndianDate(endDate);

    const openDate = this.cleanText(
      $('#bidOpenDate, .bid-open-date, [data-field="bidOpenDate"]').text(),
    );
    tender.bidOpeningDate = this.parseIndianDate(openDate);

    // Location
    tender.state = this.cleanText($('#state, .delivery-state, [data-field="state"]').text()) || 'All India';
    tender.district = this.cleanText($('#district, .delivery-district, [data-field="district"]').text());

    // MSE / Startup exemptions
    const mseText = this.cleanText($('#mseExemption, .mse-exempt').text()).toLowerCase();
    tender.reservedForMSME = mseText.includes('yes') || mseText.includes('true');
    tender.emdExemptMSME = tender.reservedForMSME;

    const startupText = this.cleanText($('#startupExemption, .startup-exempt').text()).toLowerCase();
    tender.reservedForStartups = startupText.includes('yes') || startupText.includes('true');

    // Documents
    const documents: ScrapedTender['documents'] = [];
    $('.document-list a, .bid-documents a, #documentList a').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const name = this.cleanText($link.text());
      if (href && name) {
        documents.push({
          name,
          fileUrl: href.startsWith('http') ? href : `https://bidplus.gem.gov.in${href}`,
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

  private mapGemBidToTender(bid: GemBidItem): Partial<ScrapedTender> {
    return {
      sourceId: bid.bidId || bid.bidNumber || '',
      referenceNumber: bid.bidNumber || bid.bidId || '',
      title: bid.bidTitle || bid.itemDescription || '',
      organization: bid.organizationName || '',
      department: bid.departmentName,
      category: this.mapGemCategory(bid.bidCategory),
      estimatedValue: bid.estimatedValue,
      emdAmount: bid.emdAmount,
      publishedDate: bid.publishDate ? this.parseIndianDate(bid.publishDate) : undefined,
      bidSubmissionDeadline: bid.bidEndDate ? this.parseIndianDate(bid.bidEndDate) : undefined,
      bidOpeningDate: bid.bidOpenDate ? this.parseIndianDate(bid.bidOpenDate) : undefined,
      state: bid.state || 'All India',
      district: bid.district,
      sourcePortal: 'GeM',
      sourceUrl: bid.bidUrl || `https://bidplus.gem.gov.in/showbidDocument/${bid.bidId}`,
      reservedForMSME: bid.mseExemption ?? false,
      reservedForStartups: bid.startupExemption ?? false,
      emdExemptMSME: bid.mseExemption ?? false,
    };
  }

  private mapGemBidDetailToTender(detail: GemBidDetail): Partial<ScrapedTender> {
    const base = this.mapGemBidToTender(detail);

    // Compose a description from specifications and delivery info
    const descParts: string[] = [];
    if (detail.specifications) descParts.push(detail.specifications);
    if (detail.consigneeName) descParts.push(`Consignee: ${detail.consigneeName}`);
    if (detail.consigneeAddress) descParts.push(`Delivery Address: ${detail.consigneeAddress}`);
    if (detail.deliveryDays) descParts.push(`Delivery Period: ${detail.deliveryDays} days`);
    if (detail.paymentTerms) descParts.push(`Payment Terms: ${detail.paymentTerms}`);

    base.description = descParts.join(' | ') || undefined;

    // Map documents
    if (detail.documents && detail.documents.length > 0) {
      base.documents = detail.documents
        .filter((d) => d.fileName && d.fileUrl)
        .map((d) => ({
          name: d.fileName!,
          fileUrl: d.fileUrl!,
          fileType: d.fileType,
          fileSize: d.fileSize,
        }));
    }

    return base;
  }

  private mapGemCategory(
    category: string | undefined,
  ): 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY' {
    if (!category) return 'GOODS'; // GeM is primarily a goods marketplace

    const lower = category.toLowerCase();
    if (lower.includes('service') || lower.includes('hiring')) return 'SERVICES';
    if (lower.includes('work') || lower.includes('construction') || lower.includes('civil')) return 'WORKS';
    if (lower.includes('consult') || lower.includes('advisory')) return 'CONSULTANCY';
    return 'GOODS';
  }

  private extractFileExtension(url: string): string | undefined {
    const match = url.match(/\.(\w{2,5})(?:\?|$)/);
    return match ? match[1].toLowerCase() : undefined;
  }
}
