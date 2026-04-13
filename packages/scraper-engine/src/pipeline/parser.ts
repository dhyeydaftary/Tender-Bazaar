/**
 * Tender Data Parser
 *
 * Parses raw scraped data into structured formats:
 * - Indian date formats (DD/MM/YYYY, textual dates, IST timestamps)
 * - Indian currency (₹ notation, Lakh/Crore, Indian number system)
 * - HTML cleaning, reference number extraction, status/type normalization
 * - Unicode/Devanagari text handling
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ParsedTenderData {
  title: string;
  description: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  tenderType: NormalizedTenderType;
  status: NormalizedTenderStatus;
  state?: string;
  district?: string;
  city?: string;
  estimatedValue?: number;
  emdAmount?: number;
  publishedDate?: Date;
  bidSubmissionDeadline?: Date;
  bidOpeningDate?: Date;
  preBidMeetingDate?: Date;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  documents?: Array<{ name: string; url: string; fileType?: string }>;
  rawData?: Record<string, unknown>;
}

export type NormalizedTenderStatus =
  | 'ACTIVE'
  | 'CLOSED'
  | 'AWARDED'
  | 'CANCELLED'
  | 'CORRIGENDUM';

export type NormalizedTenderType =
  | 'OPEN'
  | 'LIMITED'
  | 'SINGLE'
  | 'TWO_PACKET'
  | 'EOI'
  | 'AUCTION'
  | 'RFP'
  | 'RFQ';

// ─── Month Maps ─────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/** Hindi month names */
const HINDI_MONTH_MAP: Record<string, number> = {
  'जनवरी': 0, 'फरवरी': 1, 'मार्च': 2, 'अप्रैल': 3,
  'मई': 4, 'जून': 5, 'जुलाई': 6, 'अगस्त': 7,
  'सितंबर': 8, 'सितम्बर': 8, 'अक्टूबर': 9, 'अक्तूबर': 9,
  'नवंबर': 10, 'नवम्बर': 10, 'दिसंबर': 11, 'दिसम्बर': 11,
};

// ─── Date Parsing ───────────────────────────────────────────────────────────────

/**
 * Parse Indian date formats into UTC Date objects.
 *
 * Supports:
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - "1st January 2024", "15th Feb 2023"
 * - "January 1, 2024"
 * - ISO 8601 strings
 * - Timestamps with time: "DD/MM/YYYY HH:mm", "DD/MM/YYYY HH:mm:ss"
 * - IST marker: "15/01/2024 14:30 IST"
 *
 * All returned dates are UTC.
 */
export function parseIndianDate(input: string | undefined | null): Date | undefined {
  if (!input || typeof input !== 'string') return undefined;

  const cleaned = input.trim().replace(/\s+/g, ' ');

  if (!cleaned) return undefined;

  // Try ISO 8601 first
  const isoDate = tryParseISO(cleaned);
  if (isoDate) return isoDate;

  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with optional time
  const numericResult = tryParseNumericDate(cleaned);
  if (numericResult) return numericResult;

  // Try textual: "1st January 2024", "15th Feb 2023"
  const textualResult = tryParseTextualDate(cleaned);
  if (textualResult) return textualResult;

  // Try "Month DD, YYYY"
  const monthFirstResult = tryParseMonthFirst(cleaned);
  if (monthFirstResult) return monthFirstResult;

  // Try Hindi date format
  const hindiResult = tryParseHindiDate(cleaned);
  if (hindiResult) return hindiResult;

  return undefined;
}

function tryParseISO(input: string): Date | undefined {
  // ISO 8601: 2024-01-15T14:30:00Z or 2024-01-15T14:30:00+05:30
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (isoRegex.test(input)) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function tryParseNumericDate(input: string): Date | undefined {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with optional HH:mm(:ss) and optional IST
  const regex = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(IST)?$/i;
  const match = input.match(regex);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const year = parseInt(match[3], 10);
  const hours = match[4] ? parseInt(match[4], 10) : 0;
  const minutes = match[5] ? parseInt(match[5], 10) : 0;
  const seconds = match[6] ? parseInt(match[6], 10) : 0;
  const isIST = !!match[7];

  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;

  // Create date in UTC
  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

  // If IST, subtract 5:30 to convert to UTC
  if (isIST) {
    date.setUTCHours(date.getUTCHours() - 5);
    date.setUTCMinutes(date.getUTCMinutes() - 30);
  }

  if (isNaN(date.getTime())) return undefined;
  return date;
}

function tryParseTextualDate(input: string): Date | undefined {
  // "1st January 2024", "15th Feb 2023", "2 March 2024"
  const regex = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(IST)?$/i;
  const match = input.match(regex);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  const hours = match[4] ? parseInt(match[4], 10) : 0;
  const minutes = match[5] ? parseInt(match[5], 10) : 0;
  const seconds = match[6] ? parseInt(match[6], 10) : 0;
  const isIST = !!match[7];

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  if (isIST) {
    date.setUTCHours(date.getUTCHours() - 5);
    date.setUTCMinutes(date.getUTCMinutes() - 30);
  }

  if (isNaN(date.getTime())) return undefined;
  return date;
}

function tryParseMonthFirst(input: string): Date | undefined {
  // "January 1, 2024", "Feb 15, 2023"
  const regex = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i;
  const match = input.match(regex);
  if (!match) return undefined;

  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return undefined;
  return date;
}

function tryParseHindiDate(input: string): Date | undefined {
  // "15 जनवरी 2024"
  const regex = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/;
  const match = input.match(regex);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const monthStr = match[2];
  const year = parseInt(match[3], 10);

  const month = HINDI_MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return undefined;
  return date;
}

// ─── Currency Parsing ───────────────────────────────────────────────────────────

/**
 * Parse Indian currency strings into numeric values (INR).
 *
 * Supports:
 * - "₹1,23,456.78"   → 123456.78
 * - "Rs. 1,23,456"    → 123456
 * - "Rs 50,000"       → 50000
 * - "INR 1,234"       → 1234
 * - "1.5 Cr"          → 15000000
 * - "1.5 Crore"       → 15000000
 * - "50 Lakh"         → 5000000
 * - "2.5 Lakhs"       → 250000
 * - "₹1.5 Cr"         → 15000000
 * - "Rs. 50 Lakh"     → 5000000
 * - Plain numbers: "123456.78"
 *
 * Indian number system: 1 Lakh = 100,000; 1 Crore = 10,000,000
 */
export function parseIndianCurrency(input: string | undefined | null): number | undefined {
  if (!input || typeof input !== 'string') return undefined;

  let cleaned = input.trim();
  if (!cleaned) return undefined;

  // Remove currency prefixes: ₹, Rs., Rs, INR
  cleaned = cleaned.replace(/^(₹|Rs\.?\s*|INR\s*)/i, '').trim();

  // Check for Crore/Cr suffix
  const croreMatch = cleaned.match(/^([0-9,]+(?:\.\d+)?)\s*(?:Crores?|Cr\.?)$/i);
  if (croreMatch) {
    const num = parseIndianNumber(croreMatch[1]);
    return num !== undefined ? num * 10000000 : undefined;
  }

  // Check for Lakh/Lac suffix
  const lakhMatch = cleaned.match(/^([0-9,]+(?:\.\d+)?)\s*(?:Lakhs?|Lacs?|L)$/i);
  if (lakhMatch) {
    const num = parseIndianNumber(lakhMatch[1]);
    return num !== undefined ? num * 100000 : undefined;
  }

  // Check for Thousand/K suffix
  const thousandMatch = cleaned.match(/^([0-9,]+(?:\.\d+)?)\s*(?:Thousand|K)$/i);
  if (thousandMatch) {
    const num = parseIndianNumber(thousandMatch[1]);
    return num !== undefined ? num * 1000 : undefined;
  }

  // Plain number with Indian comma formatting (1,23,456.78)
  return parseIndianNumber(cleaned);
}

/**
 * Parse a number string that may use Indian comma grouping.
 * Removes commas, handles decimals.
 */
function parseIndianNumber(input: string): number | undefined {
  // Remove all commas (Indian grouping: 1,23,456 or Western: 123,456)
  const cleaned = input.replace(/,/g, '').trim();

  if (!/^[0-9]+(\.[0-9]+)?$/.test(cleaned)) return undefined;

  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

// ─── HTML / Text Cleaning ───────────────────────────────────────────────────────

/** HTML entity map for common entities */
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&ndash;': '-',
  '&mdash;': '--', '&laquo;': '"', '&raquo;': '"',
  '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"', '&ldquo;': '"',
  '&bull;': '-', '&hellip;': '...',
};

/**
 * Clean HTML content: strip tags, decode entities, normalize whitespace.
 */
export function cleanHtml(input: string | undefined | null): string {
  if (!input) return '';

  let text = input;

  // Replace <br>, <br/>, <br />, </p>, </div>, </li> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(?:p|div|li|tr)>/gi, '\n');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode numeric HTML entities (&#123; or &#x1F;)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Decode named HTML entities
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    text = text.split(entity).join(replacement);
  }

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.trim();

  return text;
}

/**
 * Clean and normalize general text — collapse whitespace, trim, etc.
 */
export function cleanText(input: string | undefined | null): string {
  if (!input) return '';
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Clean Devanagari/Unicode text — normalize forms, strip zero-width chars.
 */
export function cleanUnicodeText(input: string | undefined | null): string {
  if (!input) return '';

  let text = input;

  // Normalize to NFC (composed form)
  text = text.normalize('NFC');

  // Remove zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '');

  // Normalize Devanagari danda/double danda
  text = text.replace(/\u0964/g, '|');
  text = text.replace(/\u0965/g, '||');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ─── Reference Number Extraction ────────────────────────────────────────────────

/**
 * Common Indian tender reference number patterns.
 */
const REFERENCE_PATTERNS: RegExp[] = [
  // GeM pattern: GEM/2024/B/1234567
  /GEM\/\d{4}\/[A-Z]\/\d+/i,
  // CPPP pattern: 2024_DOD_123456_1
  /\d{4}_[A-Z]+_\d+(?:_\d+)?/,
  // NIT pattern: NIT-2024-25/123, NIT No. 123/2024-25
  /NIT[\s\-\.]*(?:No\.?\s*)?[\w\-\/]+\d{4}/i,
  // Generic tender number: T/123/2024-25, TENDER-2024-123
  /(?:T|TENDER)[\s\-\/]*\d+[\s\-\/]*\d{4}/i,
  // e-Procurement ID: eProc-123456
  /eProc[\-\/]?\d+/i,
  // State portal patterns: MPTENDERS/2024/12345
  /[A-Z]{2,}TENDERS?\/\d{4}\/\d+/i,
  // General format: letters/numbers with slashes and year
  /[A-Z]{2,}[\-\/]\d+[\-\/]\d{4}(?:[\-\/]\d+)?/,
  // Alphanumeric with year: ABC-2024-001
  /[A-Z]{2,}\-\d{4}\-\d{3,}/,
  // Numeric ID with prefix: ID: 12345678
  /(?:ID|Tender\s*(?:ID|No))[:\s]*\d{4,}/i,
];

/**
 * Extract tender reference number from text.
 * Tries multiple Indian government tender ID patterns.
 */
export function extractReferenceNumber(
  text: string | undefined | null,
  fallbackId?: string,
): string {
  if (!text) return fallbackId || '';

  const cleaned = cleanText(text);

  for (const pattern of REFERENCE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) return match[0].trim();
  }

  // Fallback: look for any alphanumeric sequence with slashes/dashes that looks like an ID
  const genericMatch = cleaned.match(/[A-Z0-9]{2,}[\/\-][A-Z0-9\/\-]{3,}/i);
  if (genericMatch) return genericMatch[0].trim();

  return fallbackId || cleaned.slice(0, 100);
}

// ─── Status Normalization ───────────────────────────────────────────────────────

const STATUS_MAP: Record<string, NormalizedTenderStatus> = {
  // ACTIVE
  'active': 'ACTIVE',
  'published': 'ACTIVE',
  'live': 'ACTIVE',
  'open': 'ACTIVE',
  'bid invited': 'ACTIVE',
  'bid submission': 'ACTIVE',
  'bid submission open': 'ACTIVE',
  'online': 'ACTIVE',
  'available': 'ACTIVE',
  'invited': 'ACTIVE',
  'new': 'ACTIVE',
  'current': 'ACTIVE',
  'running': 'ACTIVE',
  // CLOSED
  'closed': 'CLOSED',
  'expired': 'CLOSED',
  'deadline over': 'CLOSED',
  'bid closed': 'CLOSED',
  'bid submission closed': 'CLOSED',
  'submission closed': 'CLOSED',
  'past deadline': 'CLOSED',
  'ended': 'CLOSED',
  'completed': 'CLOSED',
  'evaluated': 'CLOSED',
  'under evaluation': 'CLOSED',
  'evaluation complete': 'CLOSED',
  // AWARDED
  'awarded': 'AWARDED',
  'result declared': 'AWARDED',
  'contract awarded': 'AWARDED',
  'work order issued': 'AWARDED',
  'loa issued': 'AWARDED',
  'finalized': 'AWARDED',
  // CANCELLED
  'cancelled': 'CANCELLED',
  'canceled': 'CANCELLED',
  'withdrawn': 'CANCELLED',
  'retracted': 'CANCELLED',
  'annulled': 'CANCELLED',
  'recalled': 'CANCELLED',
  'scrapped': 'CANCELLED',
  'nit cancelled': 'CANCELLED',
  // CORRIGENDUM
  'corrigendum': 'CORRIGENDUM',
  'amendment': 'CORRIGENDUM',
  'addendum': 'CORRIGENDUM',
  'modified': 'CORRIGENDUM',
  'revised': 'CORRIGENDUM',
  'updated': 'CORRIGENDUM',
  'extension': 'CORRIGENDUM',
  'date extended': 'CORRIGENDUM',
  'date extension': 'CORRIGENDUM',
};

/**
 * Normalize tender status string to enum value.
 * Falls back to ACTIVE if unrecognized.
 */
export function normalizeTenderStatus(input: string | undefined | null): NormalizedTenderStatus {
  if (!input) return 'ACTIVE';

  const cleaned = input.trim().toLowerCase().replace(/[_\-]+/g, ' ');
  const mapped = STATUS_MAP[cleaned];
  if (mapped) return mapped;

  // Partial match — check if any known key is contained in the input
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (cleaned.includes(key)) return value;
  }

  return 'ACTIVE';
}

// ─── Tender Type Normalization ──────────────────────────────────────────────────

const TYPE_MAP: Record<string, NormalizedTenderType> = {
  // OPEN
  'open': 'OPEN',
  'open tender': 'OPEN',
  'open bidding': 'OPEN',
  'ict': 'OPEN',
  'international competitive bidding': 'OPEN',
  'national competitive bidding': 'OPEN',
  'ncb': 'OPEN',
  'icb': 'OPEN',
  'global tender': 'OPEN',
  'e-tender': 'OPEN',
  'e-procurement': 'OPEN',
  'nit': 'OPEN',
  'notice inviting tender': 'OPEN',
  // LIMITED
  'limited': 'LIMITED',
  'limited tender': 'LIMITED',
  'limited bidding': 'LIMITED',
  'ltq': 'LIMITED',
  'limited tender enquiry': 'LIMITED',
  'lte': 'LIMITED',
  'select tender': 'LIMITED',
  // SINGLE
  'single': 'SINGLE',
  'single source': 'SINGLE',
  'single tender': 'SINGLE',
  'single vendor': 'SINGLE',
  'proprietary': 'SINGLE',
  'nomination': 'SINGLE',
  'sole source': 'SINGLE',
  'pac': 'SINGLE',
  // TWO_PACKET
  'two packet': 'TWO_PACKET',
  'two envelope': 'TWO_PACKET',
  'two bid': 'TWO_PACKET',
  'two part': 'TWO_PACKET',
  '2 packet': 'TWO_PACKET',
  '2 envelope': 'TWO_PACKET',
  '2 bid': 'TWO_PACKET',
  'technical and financial': 'TWO_PACKET',
  // EOI
  'eoi': 'EOI',
  'expression of interest': 'EOI',
  'empanelment': 'EOI',
  'pre-qualification': 'EOI',
  'prequalification': 'EOI',
  'pq': 'EOI',
  'rfi': 'EOI',
  'request for information': 'EOI',
  // AUCTION
  'auction': 'AUCTION',
  'e-auction': 'AUCTION',
  'reverse auction': 'AUCTION',
  'forward auction': 'AUCTION',
  'ra': 'AUCTION',
  // RFP
  'rfp': 'RFP',
  'request for proposal': 'RFP',
  // RFQ
  'rfq': 'RFQ',
  'request for quotation': 'RFQ',
  'quotation': 'RFQ',
  'rate contract': 'RFQ',
  'spot quotation': 'RFQ',
  'boq': 'RFQ',
};

/**
 * Normalize tender type string to enum value.
 * Falls back to OPEN if unrecognized.
 */
export function normalizeTenderType(input: string | undefined | null): NormalizedTenderType {
  if (!input) return 'OPEN';

  const cleaned = input.trim().toLowerCase().replace(/[_\-]+/g, ' ');
  const mapped = TYPE_MAP[cleaned];
  if (mapped) return mapped;

  // Partial match
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (cleaned.includes(key)) return value;
  }

  return 'OPEN';
}

// ─── Full Parser ────────────────────────────────────────────────────────────────

export interface RawTenderInput {
  title?: string;
  description?: string;
  referenceNumber?: string;
  organization?: string;
  department?: string;
  tenderType?: string;
  status?: string;
  state?: string;
  district?: string;
  city?: string;
  estimatedValue?: string | number;
  emdAmount?: string | number;
  publishedDate?: string;
  bidSubmissionDeadline?: string;
  bidOpeningDate?: string;
  preBidMeetingDate?: string;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  documents?: Array<{ name: string; url: string; fileType?: string }>;
  rawData?: Record<string, unknown>;
}

/**
 * Parse a raw scraped tender object into a clean, typed structure.
 */
export function parseTenderData(raw: RawTenderInput): ParsedTenderData {
  const title = cleanUnicodeText(cleanHtml(raw.title));
  const description = cleanUnicodeText(cleanHtml(raw.description));

  return {
    title,
    description,
    referenceNumber: extractReferenceNumber(raw.referenceNumber, raw.sourceId),
    organization: cleanText(raw.organization) || 'Unknown',
    department: cleanText(raw.department) || undefined,
    tenderType: normalizeTenderType(raw.tenderType),
    status: normalizeTenderStatus(raw.status),
    state: cleanText(raw.state) || undefined,
    district: cleanText(raw.district) || undefined,
    city: cleanText(raw.city) || undefined,
    estimatedValue:
      typeof raw.estimatedValue === 'number'
        ? raw.estimatedValue
        : parseIndianCurrency(raw.estimatedValue as string),
    emdAmount:
      typeof raw.emdAmount === 'number'
        ? raw.emdAmount
        : parseIndianCurrency(raw.emdAmount as string),
    publishedDate: parseIndianDate(raw.publishedDate),
    bidSubmissionDeadline: parseIndianDate(raw.bidSubmissionDeadline),
    bidOpeningDate: parseIndianDate(raw.bidOpeningDate),
    preBidMeetingDate: parseIndianDate(raw.preBidMeetingDate),
    sourcePortal: raw.sourcePortal,
    sourceUrl: raw.sourceUrl,
    sourceId: raw.sourceId,
    documents: raw.documents,
    rawData: raw.rawData,
  };
}
