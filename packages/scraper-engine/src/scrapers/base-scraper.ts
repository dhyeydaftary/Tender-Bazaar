import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import PQueue from 'p-queue';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedTender {
  title: string;
  description?: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  tenderType?: 'OPEN' | 'LIMITED' | 'SINGLE' | 'TWO_PACKET' | 'EOI' | 'AUCTION' | 'RFP' | 'RFQ';
  category?: 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY';
  status?: 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'CORRIGENDUM';
  state: string;
  district?: string;
  city?: string;
  estimatedValue?: number;
  emdAmount?: number;
  publishedDate: Date;
  bidSubmissionDeadline: Date;
  bidOpeningDate?: Date;
  preBidMeetingDate?: Date;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  aiKeywords?: string[];
  reservedForMSME?: boolean;
  reservedForStartups?: boolean;
  emdExemptMSME?: boolean;
  documents?: Array<{
    name: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }>;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  proxy?: string;
  cookies?: string;
  method?: 'GET' | 'POST';
  data?: unknown;
  responseType?: 'json' | 'text' | 'arraybuffer';
}

export interface PlaywrightOptions {
  waitForSelector?: string;
  waitTimeout?: number;
  headless?: boolean;
  proxy?: string;
  actions?: Array<{
    type: 'click' | 'fill' | 'select' | 'wait';
    selector: string;
    value?: string;
    delay?: number;
  }>;
}

export interface ScrapeResult {
  portal: string;
  totalFound: number;
  newTenders: number;
  updatedTenders: number;
  errors: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// User-Agent rotation pool
// ---------------------------------------------------------------------------

const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

// ---------------------------------------------------------------------------
// Abstract Base Scraper
// ---------------------------------------------------------------------------

export abstract class BaseScraper {
  /** Human-readable portal name */
  readonly portalName: string;

  /** Root URL of the portal */
  readonly portalUrl: string;

  /** Max concurrent HTTP requests */
  protected maxConcurrency: number;

  /** Delay between requests in milliseconds */
  protected requestDelay: number;

  /** Number of retry attempts for failed requests */
  protected retryCount: number;

  /** Base delay between retries (exponential backoff) */
  protected retryDelay: number;

  /** Logger prefix */
  protected logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };

  /** Prisma database client */
  protected prisma: PrismaClient;

  /** p-queue based rate limiter */
  protected queue: PQueue;

  /** Shared browser instance for Playwright */
  private browser: Browser | null = null;

  constructor(
    portalName: string,
    portalUrl: string,
    options?: {
      maxConcurrency?: number;
      requestDelay?: number;
      retryCount?: number;
      retryDelay?: number;
      prisma?: PrismaClient;
    },
  ) {
    this.portalName = portalName;
    this.portalUrl = portalUrl;
    this.maxConcurrency = options?.maxConcurrency ?? 2;
    this.requestDelay = options?.requestDelay ?? 2000;
    this.retryCount = options?.retryCount ?? 3;
    this.retryDelay = options?.retryDelay ?? 1000;
    this.prisma = options?.prisma ?? new PrismaClient();

    this.queue = new PQueue({
      concurrency: this.maxConcurrency,
      interval: this.requestDelay,
      intervalCap: this.maxConcurrency,
    });

    // Simple console logger with portal prefix
    const prefix = `[${this.portalName}]`;
    this.logger = {
      info: (msg: string, meta?: Record<string, unknown>) =>
        console.log(`${prefix} INFO: ${msg}`, meta ? JSON.stringify(meta) : ''),
      warn: (msg: string, meta?: Record<string, unknown>) =>
        console.warn(`${prefix} WARN: ${msg}`, meta ? JSON.stringify(meta) : ''),
      error: (msg: string, meta?: Record<string, unknown>) =>
        console.error(`${prefix} ERROR: ${msg}`, meta ? JSON.stringify(meta) : ''),
    };
  }

  // -----------------------------------------------------------------------
  // Abstract methods — every portal scraper must implement these
  // -----------------------------------------------------------------------

  /** Main scrape entry point — orchestrates the full scraping run */
  abstract scrape(): Promise<ScrapeResult>;

  /** Parse a tender listing page and return an array of partial tender data */
  abstract parseTenderList(html: string): Partial<ScrapedTender>[];

  /** Parse a tender detail page and return a fully populated tender object */
  abstract parseTenderDetail(html: string): Partial<ScrapedTender>;

  // -----------------------------------------------------------------------
  // HTTP fetching with retry & user-agent rotation
  // -----------------------------------------------------------------------

  /**
   * Fetch a page using axios with retry logic, UA rotation, and proxy support.
   */
  protected async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    return this.queue.add(async () => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.retryCount; attempt++) {
        try {
          const config: AxiosRequestConfig = {
            url,
            method: options?.method ?? 'GET',
            timeout: options?.timeout ?? 30_000,
            headers: {
              'User-Agent': this.getRandomUserAgent(),
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
              ...(options?.headers ?? {}),
              ...(options?.cookies ? { Cookie: options.cookies } : {}),
            },
            responseType: options?.responseType ?? 'text',
            data: options?.data,
            ...(options?.proxy
              ? {
                  proxy: {
                    host: new URL(options.proxy).hostname,
                    port: parseInt(new URL(options.proxy).port, 10),
                    protocol: new URL(options.proxy).protocol.replace(':', ''),
                  },
                }
              : {}),
          };

          const response = await axios(config);
          return response.data as string;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          this.logger.warn(`Attempt ${attempt}/${this.retryCount} failed for ${url}: ${lastError.message}`);

          if (attempt < this.retryCount) {
            const backoff = this.retryDelay * Math.pow(2, attempt - 1);
            await this.delay(backoff);
          }
        }
      }

      this.handleError(lastError!, { url, action: 'fetchPage' });
      throw lastError;
    }) as Promise<string>;
  }

  /**
   * Fetch a page using Playwright (for JS-rendered content).
   */
  protected async fetchWithPlaywright(url: string, options?: PlaywrightOptions): Promise<string> {
    return this.queue.add(async () => {
      let page: Page | null = null;
      try {
        if (!this.browser) {
          this.browser = await chromium.launch({
            headless: options?.headless ?? true,
            ...(options?.proxy
              ? {
                  proxy: {
                    server: options.proxy,
                  },
                }
              : {}),
          });
        }

        const context = await this.browser.newContext({
          userAgent: this.getRandomUserAgent(),
          locale: 'en-IN',
          timezoneId: 'Asia/Kolkata',
        });

        page = await context.newPage();
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: options?.waitTimeout ?? 60_000,
        });

        // Wait for a specific selector if requested
        if (options?.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, {
            timeout: options.waitTimeout ?? 30_000,
          });
        }

        // Execute page actions (clicks, fills, etc.)
        if (options?.actions) {
          for (const action of options.actions) {
            switch (action.type) {
              case 'click':
                await page.click(action.selector);
                break;
              case 'fill':
                await page.fill(action.selector, action.value ?? '');
                break;
              case 'select':
                await page.selectOption(action.selector, action.value ?? '');
                break;
              case 'wait':
                await page.waitForSelector(action.selector, {
                  timeout: action.delay ?? 5000,
                });
                break;
            }
            if (action.delay) {
              await this.delay(action.delay);
            }
          }
        }

        const html = await page.content();
        await context.close();
        return html;
      } catch (err) {
        this.handleError(err instanceof Error ? err : new Error(String(err)), {
          url,
          action: 'fetchWithPlaywright',
        });
        throw err;
      } finally {
        // Page is closed when context is closed
      }
    }) as Promise<string>;
  }

  /**
   * Close the shared Playwright browser instance.
   */
  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // -----------------------------------------------------------------------
  // Utility helpers
  // -----------------------------------------------------------------------

  /**
   * Wait for a random jittered duration.
   */
  protected async delay(baseMs: number): Promise<void> {
    const jitter = Math.random() * 0.5 * baseMs; // up to 50% extra
    const total = baseMs + jitter;
    return new Promise((resolve) => setTimeout(resolve, total));
  }

  /**
   * Get a random user-agent string from the pool.
   */
  protected getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Structured error logging.
   */
  protected handleError(error: Error, context: Record<string, unknown>): void {
    this.logger.error(error.message, {
      ...context,
      stack: error.stack,
      portal: this.portalName,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Upsert a scraped tender into PostgreSQL via Prisma.
   * Uses the compound unique key (sourceId, sourcePortal) for deduplication.
   */
  protected async saveTender(data: ScrapedTender): Promise<{ isNew: boolean; id: string }> {
    try {
      const existing = await this.prisma.tender.findUnique({
        where: {
          sourceId_sourcePortal: {
            sourceId: data.sourceId,
            sourcePortal: data.sourcePortal,
          },
        },
        select: { id: true, updatedAt: true },
      });

      const tenderData = {
        title: data.title,
        description: data.description ?? null,
        referenceNumber: data.referenceNumber,
        organization: data.organization,
        department: data.department ?? null,
        tenderType: data.tenderType ?? 'OPEN',
        category: data.category ?? 'WORKS',
        status: data.status ?? 'ACTIVE',
        state: data.state,
        district: data.district ?? null,
        city: data.city ?? null,
        estimatedValue: data.estimatedValue ?? null,
        emdAmount: data.emdAmount ?? null,
        publishedDate: data.publishedDate,
        bidSubmissionDeadline: data.bidSubmissionDeadline,
        bidOpeningDate: data.bidOpeningDate ?? null,
        preBidMeetingDate: data.preBidMeetingDate ?? null,
        sourcePortal: data.sourcePortal,
        sourceUrl: data.sourceUrl,
        sourceId: data.sourceId,
        aiKeywords: data.aiKeywords ?? [],
        reservedForMSME: data.reservedForMSME ?? false,
        reservedForStartups: data.reservedForStartups ?? false,
        emdExemptMSME: data.emdExemptMSME ?? false,
      };

      const result = await this.prisma.tender.upsert({
        where: {
          sourceId_sourcePortal: {
            sourceId: data.sourceId,
            sourcePortal: data.sourcePortal,
          },
        },
        create: tenderData,
        update: tenderData,
      });

      // Save documents if provided
      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          await this.prisma.tenderDocument.upsert({
            where: {
              // We use a pseudo-unique key: tenderId + fileUrl
              id: `${result.id}_${doc.name}`.substring(0, 25),
            },
            create: {
              tenderId: result.id,
              name: doc.name,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType ?? null,
              fileSize: doc.fileSize ?? null,
            },
            update: {
              name: doc.name,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType ?? null,
              fileSize: doc.fileSize ?? null,
            },
          });
        }
      }

      const isNew = !existing;
      this.logger.info(
        `${isNew ? 'Created' : 'Updated'} tender: ${data.referenceNumber}`,
        { id: result.id, sourcePortal: data.sourcePortal },
      );

      return { isNew, id: result.id };
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)), {
        action: 'saveTender',
        referenceNumber: data.referenceNumber,
        sourcePortal: data.sourcePortal,
      });
      throw err;
    }
  }

  /**
   * Load HTML into a Cheerio instance for parsing.
   */
  protected loadHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Clean whitespace from text content.
   */
  protected cleanText(text: string | undefined | null): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse an Indian-format currency string to a number.
   * e.g. "12,34,567.89" => 1234567.89, "Rs. 5 Lakh" => 500000
   */
  protected parseIndianCurrency(value: string | undefined | null): number | undefined {
    if (!value) return undefined;

    let cleaned = value.replace(/[₹Rs.\s]/gi, '').trim();

    // Handle Lakh / Crore suffixes
    const lakhMatch = cleaned.match(/([\d,.]+)\s*(?:lakh|lac)/i);
    if (lakhMatch) {
      const num = parseFloat(lakhMatch[1].replace(/,/g, ''));
      return isNaN(num) ? undefined : num * 100_000;
    }

    const croreMatch = cleaned.match(/([\d,.]+)\s*(?:crore|cr)/i);
    if (croreMatch) {
      const num = parseFloat(croreMatch[1].replace(/,/g, ''));
      return isNaN(num) ? undefined : num * 10_000_000;
    }

    // Remove Indian comma notation
    cleaned = cleaned.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Parse common Indian date formats.
   * Handles: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MMM YYYY, YYYY-MM-DD
   */
  protected parseIndianDate(dateStr: string | undefined | null): Date | undefined {
    if (!dateStr) return undefined;
    const cleaned = dateStr.trim();

    // ISO format: YYYY-MM-DD
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00+05:30`);
      return isNaN(d.getTime()) ? undefined : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with optional time)
    const dmyMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (dmyMatch) {
      const [, day, month, year, hour, minute, second] = dmyMatch;
      const d = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour ?? '0'),
        parseInt(minute ?? '0'),
        parseInt(second ?? '0'),
      );
      return isNaN(d.getTime()) ? undefined : d;
    }

    // DD MMM YYYY (e.g. "15 Jan 2024")
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const namedMatch = cleaned.match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})/i);
    if (namedMatch) {
      const monthNum = monthNames[namedMatch[2].substring(0, 3).toLowerCase()];
      if (monthNum !== undefined) {
        const d = new Date(parseInt(namedMatch[3]), monthNum, parseInt(namedMatch[1]));
        return isNaN(d.getTime()) ? undefined : d;
      }
    }

    return undefined;
  }

  /**
   * Disconnect Prisma and clean up resources.
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
    await this.prisma.$disconnect();
  }
}
