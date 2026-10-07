import axios, { type AxiosResponse } from 'axios';
import { BaseScraper, ScrapedTender, ScrapeResult } from './base-scraper';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// GeM public bid-search mechanism
// ---------------------------------------------------------------------------
//
// The previous implementation targeted https://bidplus.gem.gov.in/all-bids-search
// and .../bid-detail. Both return HTTP 404 — they never existed; the file itself
// described them as "representative".
//
// The mechanism actually used by GeM's public bid listing (read from the page's
// own JavaScript at https://bidplus.gem.gov.in/all-bids and confirmed with live
// requests) is:
//
//   1. GET  /all-bids        → sets session cookies and embeds a CSRF token in the
//                              page source as:  'csrf_bd_gem_nk': '<32 hex chars>'
//   2. POST /all-bids-data   → form-encoded, with:
//                                payload          = JSON string
//                                csrf_bd_gem_nk   = the token from step 1
//                              payload shape:
//                                { "page": <number>, "param": {}, "filter": { "sort": ... } }
//
// Notes established by inspection, which this implementation depends on:
//   • `page` must be a JSON *number*. The string "2" returns HTTP 500.
//   • Sorting by 'Bid-Start-Date-Latest' returns newest bids first. This is what
//     makes new-only scraping cheap: once a whole page is already known we can
//     stop paginating.
//   • The response is a Solr envelope:
//       { status, code: 200, response: { response: { numFound, start, docs: [...] } } }
//   • Every field inside a doc is an ARRAY, e.g. "b_id":[9995866]. Hence unwrap().
//   • Page size is 10, fixed by the server.
//
// Access & ethics:
//   • robots.txt on bidplus.gem.gov.in disallows only /resources/ and three
//     bg_emd/epbgservice paths. /all-bids and /all-bids-data are not disallowed.
//   • No credentials are involved. The CSRF token is served openly in the public
//     page; reading it and echoing it back is simply using the site as intended.
//     Nothing here bypasses authentication or anti-bot protection.
//
// Deliberate data limits (do not "fix" by guessing):
//   • The listing carries NO estimated value, NO EMD amount and NO state/district.
//     Those are left undefined rather than fabricated. They live only inside the
//     bid document PDF, which this scraper does not parse.
//   • state is set to 'All India' because GeM is a national portal.

const GEM_BIDPLUS_BASE = 'https://bidplus.gem.gov.in';
const GEM_ALL_BIDS_URL = `${GEM_BIDPLUS_BASE}/all-bids`;
const GEM_ALL_BIDS_DATA_URL = `${GEM_BIDPLUS_BASE}/all-bids-data`;
const GEM_CSRF_FIELD = 'csrf_bd_gem_nk';

/** Server-side page size for /all-bids-data. */
const GEM_PAGE_SIZE = 10;

/** Solr sentinel for "no date" seen in final_end_date_sort. */
const GEM_NULL_DATE_PREFIX = '-0001';

// ---------------------------------------------------------------------------
// Response types (mirroring the real payload)
// ---------------------------------------------------------------------------

/** Every Solr field arrives wrapped in an array. */
type SolrField<T> = T[] | T | undefined;

interface GemBidDoc {
  id?: SolrField<string>;
  b_id?: SolrField<number>;
  b_bid_number?: SolrField<string>;
  b_bid_type?: SolrField<number>;
  b_eval_type?: SolrField<number>;
  b_status?: SolrField<number>;
  b_category_name?: SolrField<string>;
  bd_category_name?: SolrField<string>;
  b_total_quantity?: SolrField<number>;
  ba_official_details_minName?: SolrField<string>;
  ba_official_details_deptName?: SolrField<string>;
  final_start_date_sort?: SolrField<string>;
  final_end_date_sort?: SolrField<string>;
  ba_is_global_tendering?: SolrField<number>;
  is_rc_bid?: SolrField<number>;
}

interface GemAllBidsDataResponse {
  status?: number;
  code?: number;
  message?: string;
  response?: {
    response?: {
      numFound?: number;
      start?: number;
      docs?: GemBidDoc[];
    };
  };
}

interface GemSession {
  cookie: string;
  csrfToken: string;
}

/** Raised when GeM's public mechanism cannot be used. Never silently swallowed. */
export class GemAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GemAccessError';
  }
}

// ---------------------------------------------------------------------------
// GeM Scraper
// ---------------------------------------------------------------------------

/**
 * Scraper for Government e-Marketplace (GeM) — https://gem.gov.in
 *
 * Reads the public bid listing via the /all-bids-data endpoint. The listing is
 * structured enough to build a complete Tender row, so no per-bid detail request
 * is made at all: that is both faster and the correct new-only behaviour.
 */
export class GemScraper extends BaseScraper {
  private session: GemSession | null = null;

  constructor(options?: {
    prisma?: PrismaClient;
    maxConcurrency?: number;
    requestDelay?: number;
    maxPages?: number;
    fullRescrape?: boolean;
  }) {
    super('GeM', 'https://gem.gov.in', {
      maxConcurrency: options?.maxConcurrency ?? 2,
      requestDelay: options?.requestDelay ?? 3000,
      retryCount: 3,
      retryDelay: 2000,
      prisma: options?.prisma,
      maxPages: options?.maxPages ?? 10,
      fullRescrape: options?.fullRescrape ?? false,
    });
  }

  // -----------------------------------------------------------------------
  // Session handling
  // -----------------------------------------------------------------------

  /**
   * Establish a session: fetch /all-bids, keep its cookies, extract the CSRF token.
   *
   * Throws GemAccessError when the token cannot be found — that means GeM changed
   * its page and the scraper must fail loudly rather than report zero/fake bids.
   */
  private async establishSession(): Promise<GemSession> {
    // /all-bids is intermittently 500 (observed roughly 1 request in 3 during
    // testing, recovering immediately). Without a retry here a single transient
    // 500 aborts the entire run, so back off and retry before giving up.
    let response: AxiosResponse<string> | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        response = await axios.get<string>(GEM_ALL_BIDS_URL, {
          timeout: 30_000,
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
          },
          // Treat only 2xx as usable; anything else is an access problem we report.
          validateStatus: (s) => s >= 200 && s < 300,
        });
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `GeM session attempt ${attempt}/${this.retryCount} failed: ${lastError.message}`,
        );
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    if (!response) {
      throw new GemAccessError(
        `Could not load ${GEM_ALL_BIDS_URL} after ${this.retryCount} attempts ` +
        `(last error: ${lastError?.message ?? 'unknown'}). GeM's public bid page is ` +
        `unreachable right now; no tenders are reported for this run.`,
      );
    }

    const html = String(response.data ?? '');

    const tokenMatch = html.match(
      new RegExp(`['"]${GEM_CSRF_FIELD}['"]\\s*:\\s*['"]([a-f0-9]{32})['"]`, 'i'),
    );
    if (!tokenMatch) {
      throw new GemAccessError(
        `Could not find the ${GEM_CSRF_FIELD} CSRF token in ${GEM_ALL_BIDS_URL}. ` +
        `GeM's public bid page has likely changed. The scraper is failing rather than ` +
        `returning results, so no fabricated tenders are recorded.`,
      );
    }

    const setCookie = response.headers['set-cookie'];
    const cookie = Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(';')[0]).join('; ')
      : '';

    return { cookie, csrfToken: tokenMatch[1] };
  }

  // -----------------------------------------------------------------------
  // Listing retrieval
  // -----------------------------------------------------------------------

  /**
   * POST /all-bids-data for one page. `page` is 1-based; it is omitted for page 1
   * to mirror the site's own behaviour (its JS only sets `page` when truthy).
   */
  private async fetchBidPage(page: number): Promise<GemAllBidsDataResponse> {
    if (!this.session) {
      this.session = await this.establishSession();
    }

    const payload: Record<string, unknown> = {
      param: {},
      filter: { sort: 'Bid-Start-Date-Latest' },
    };
    if (page > 1) {
      // Must be a number — the string form returns HTTP 500.
      payload.page = page;
    }

    const body = new URLSearchParams();
    body.set('payload', JSON.stringify(payload));
    body.set(GEM_CSRF_FIELD, this.session.csrfToken);

    const run = async (): Promise<GemAllBidsDataResponse> => {
      const response = await axios.post(GEM_ALL_BIDS_DATA_URL, body.toString(), {
        timeout: 30_000,
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: GEM_ALL_BIDS_URL,
          ...(this.session?.cookie ? { Cookie: this.session.cookie } : {}),
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return response.data as GemAllBidsDataResponse;
    };

    try {
      return await run();
    } catch (err) {
      // A stale CSRF token / expired session shows up as 4xx or 500. Re-establish
      // once and retry; if that still fails, let the error surface.
      this.logger.warn(`Bid page ${page} failed, refreshing GeM session and retrying once`, {
        error: err instanceof Error ? err.message : String(err),
      });
      this.session = await this.establishSession();
      body.set(GEM_CSRF_FIELD, this.session.csrfToken);
      return run();
    }
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

    this.logger.info('Starting GeM bid scraping run', {
      maxPages: this.maxPages,
      mode: this.fullRescrape ? 'full-rescrape' : 'new-only',
      endpoint: GEM_ALL_BIDS_DATA_URL,
    });

    try {
      // Fail fast and loudly if the public mechanism is unavailable.
      this.session = await this.establishSession();
      this.logger.info('GeM session established');

      for (let page = 1; page <= this.maxPages; page++) {
        try {
          const data = await this.fetchBidPage(page);

          if (data.code !== 200) {
            throw new GemAccessError(
              `GeM /all-bids-data returned code=${data.code ?? 'unknown'} ` +
              `message=${data.message ?? 'none'} on page ${page}`,
            );
          }

          const solr = data.response?.response;
          const docs = solr?.docs ?? [];

          if (docs.length === 0) {
            this.logger.info(`No bids on page ${page}, stopping pagination`);
            break;
          }

          const listings = this.mapDocsToListings(docs);
          totalFound += listings.length;
          this.logger.info(`Page ${page}: ${listings.length} bids (numFound=${solr?.numFound ?? '?'})`);

          // New-only: single batch existence check for the page.
          const { toProcess, skipped } = await this.partitionListings(listings);
          skippedExisting += skipped.length;

          for (const listing of toProcess) {
            try {
              const tender = this.buildTender(listing);
              if (!tender) continue;

              const result = await this.saveTender(tender);
              if (result.isNew) newTenders++;
              else updatedTenders++;
            } catch (err) {
              errors++;
              this.handleError(err instanceof Error ? err : new Error(String(err)), {
                action: 'saveGemBid',
                sourceId: listing.sourceId,
                page,
              });
            }
          }

          // Results are sorted newest-first, so a page in which every bid is
          // already known means everything beyond it is older and also known.
          // Stop here instead of walking the remaining pages.
          if (!this.fullRescrape && toProcess.length === 0 && skipped.length > 0) {
            this.logger.info(
              `Page ${page} contained only already-known bids — stopping early (new-only)`,
            );
            break;
          }

          // Stop if we have consumed everything the server has.
          const start = solr?.start ?? (page - 1) * GEM_PAGE_SIZE;
          if (typeof solr?.numFound === 'number' && start + docs.length >= solr.numFound) {
            this.logger.info('Reached the end of the GeM result set');
            break;
          }

          await this.delay(this.requestDelay);
        } catch (err) {
          errors++;
          this.handleError(err instanceof Error ? err : new Error(String(err)), {
            action: 'fetchGemBidPage',
            page,
          });
          // An access-level failure will not fix itself on the next page.
          if (err instanceof GemAccessError) break;
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
    this.logger.info('GeM scraping complete', {
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
  // Mapping
  // -----------------------------------------------------------------------

  /** Unwrap a Solr array-valued field. */
  private unwrap<T>(field: SolrField<T>): T | undefined {
    if (field === undefined || field === null) return undefined;
    if (Array.isArray(field)) return field.length > 0 ? field[0] : undefined;
    return field;
  }

  /**
   * Parse a GeM Solr date. Returns undefined for the '-0001-11-30T00:00:00Z'
   * sentinel that GeM uses for "no date".
   */
  private parseGemDate(value: string | undefined): Date | undefined {
    if (!value || value.startsWith(GEM_NULL_DATE_PREFIX)) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  /**
   * Build the public document URL for a bid.
   *
   * GeM routes by bid type — this mirrors the site's own logic. Using the wrong
   * one 404s/500s (verified: showbidDocument returns 500 for a b_bid_type=2 bid).
   *   b_bid_type 5            → showdirectradocumentPdf
   *   b_bid_type 2, eval > 0  → list-ra-schedules
   *   b_bid_type 2            → showradocumentPdf
   *   otherwise               → showbidDocument
   */
  private buildBidDocumentUrl(bidId: number, bidType?: number, evalType?: number): string {
    let segment = 'showbidDocument';
    if (bidType === 5) {
      segment = 'showdirectradocumentPdf';
    } else if (bidType === 2) {
      segment = (evalType ?? 0) > 0 ? 'list-ra-schedules' : 'showradocumentPdf';
    }
    return `${GEM_BIDPLUS_BASE}/${segment}/${bidId}`;
  }

  private mapDocsToListings(docs: GemBidDoc[]): Partial<ScrapedTender>[] {
    const listings: Partial<ScrapedTender>[] = [];

    for (const doc of docs) {
      const bidId = this.unwrap(doc.b_id) ?? Number(this.unwrap(doc.id));
      if (!bidId || Number.isNaN(bidId)) continue;

      const bidNumber = this.unwrap(doc.b_bid_number);
      const bidType = this.unwrap(doc.b_bid_type);
      const evalType = this.unwrap(doc.b_eval_type);
      const category = this.unwrap(doc.b_category_name) ?? this.unwrap(doc.bd_category_name);
      const ministry = this.unwrap(doc.ba_official_details_minName);
      const department = this.unwrap(doc.ba_official_details_deptName);

      const publishedDate = this.parseGemDate(this.unwrap(doc.final_start_date_sort));
      const deadline = this.parseGemDate(this.unwrap(doc.final_end_date_sort));

      listings.push({
        // b_id is GeM's stable internal bid id — the right new-only identity key.
        sourceId: String(bidId),
        referenceNumber: bidNumber ?? String(bidId),
        title: category ? this.cleanText(category).slice(0, 500) : `GeM Bid ${bidNumber ?? bidId}`,
        description: this.unwrap(doc.bd_category_name)
          ? this.cleanText(this.unwrap(doc.bd_category_name) as string)
          : undefined,
        organization: ministry ? this.cleanText(ministry) : 'Government e-Marketplace',
        department: department ? this.cleanText(department) : undefined,
        category: this.mapGemCategory(category),
        tenderType: bidType === 2 || bidType === 5 ? 'AUCTION' : 'RFQ',
        status: 'ACTIVE',
        state: 'All India',
        publishedDate,
        bidSubmissionDeadline: deadline,
        sourceUrl: this.buildBidDocumentUrl(bidId, bidType, evalType),
        // estimatedValue / emdAmount are intentionally absent — see the file header.
      });
    }

    return listings;
  }

  /**
   * Promote a listing to a full ScrapedTender.
   *
   * Returns null when a required field is genuinely missing, so an incomplete
   * record is skipped rather than saved with invented values.
   */
  private buildTender(listing: Partial<ScrapedTender>): ScrapedTender | null {
    if (!listing.sourceId) return null;

    // publishedDate and bidSubmissionDeadline are non-nullable in the Tender model.
    // GeM always supplies a start date; the end date can be the null sentinel, in
    // which case we cannot honestly claim a deadline.
    if (!listing.publishedDate || !listing.bidSubmissionDeadline) {
      this.logger.warn(`Skipping GeM bid ${listing.referenceNumber ?? listing.sourceId} — missing dates`, {
        hasPublished: Boolean(listing.publishedDate),
        hasDeadline: Boolean(listing.bidSubmissionDeadline),
      });
      return null;
    }

    return {
      title: listing.title ?? `GeM Bid ${listing.sourceId}`,
      description: listing.description,
      referenceNumber: listing.referenceNumber ?? listing.sourceId,
      organization: listing.organization ?? 'Government e-Marketplace',
      department: listing.department,
      tenderType: listing.tenderType ?? 'RFQ',
      category: listing.category ?? 'GOODS',
      status: listing.status ?? 'ACTIVE',
      state: 'All India',
      publishedDate: listing.publishedDate,
      bidSubmissionDeadline: listing.bidSubmissionDeadline,
      sourcePortal: this.portalName,
      sourceUrl: listing.sourceUrl ?? `${GEM_BIDPLUS_BASE}/all-bids`,
      sourceId: listing.sourceId,
      // Not available from the public listing — left undefined, never guessed:
      estimatedValue: undefined,
      emdAmount: undefined,
      district: undefined,
      city: undefined,
      reservedForMSME: false,
      reservedForStartups: false,
      emdExemptMSME: false,
    };
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

  // -----------------------------------------------------------------------
  // BaseScraper contract
  // -----------------------------------------------------------------------

  /**
   * GeM returns JSON from /all-bids-data rather than an HTML listing, so this
   * accepts the raw JSON body. Kept to satisfy the BaseScraper contract and to
   * make the mapping unit-testable without network access.
   */
  parseTenderList(html: string): Partial<ScrapedTender>[] {
    try {
      const parsed = JSON.parse(html) as GemAllBidsDataResponse;
      const docs = parsed.response?.response?.docs ?? [];
      return this.mapDocsToListings(docs);
    } catch {
      this.logger.warn('parseTenderList received a non-JSON body; GeM returns JSON from /all-bids-data');
      return [];
    }
  }

  /**
   * Not used for GeM.
   *
   * The /all-bids-data listing already contains every field the Tender model needs
   * from this portal, so there is no detail request to parse. The remaining
   * fields (estimated value, EMD) exist only inside the bid document PDF, which is
   * out of scope. Returning {} keeps the BaseScraper contract honest instead of
   * pretending to extract data.
   */
  parseTenderDetail(_html: string): Partial<ScrapedTender> {
    return {};
  }
}
