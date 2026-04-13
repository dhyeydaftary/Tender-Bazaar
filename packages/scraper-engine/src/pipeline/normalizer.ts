/**
 * Tender Data Normalizer
 *
 * Normalizes parsed tender data for consistency:
 * - Organization names (abbreviations, government prefixes)
 * - State/UT names (map variations to canonical)
 * - Category mapping (portal-specific to TenderBazaar categories)
 * - District/city names
 * - All dates to UTC
 * - Default values for missing optional fields
 */

import type { ParsedTenderData } from './parser';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface NormalizedTenderData {
  title: string;
  description: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  tenderType: string;
  category: string;
  status: string;
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
  documents?: Array<{ name: string; url: string; fileType?: string }>;
  rawData?: Record<string, unknown>;
}

export interface NormalizationResult {
  data: NormalizedTenderData;
  warnings: string[];
  isValid: boolean;
}

// ─── State Normalization Map ────────────────────────────────────────────────────

const STATE_ALIASES: Record<string, string> = {
  // Abbreviations
  'ap': 'Andhra Pradesh',
  'ar': 'Arunachal Pradesh',
  'as': 'Assam',
  'br': 'Bihar',
  'cg': 'Chhattisgarh',
  'ct': 'Chhattisgarh',
  'ga': 'Goa',
  'gj': 'Gujarat',
  'hr': 'Haryana',
  'hp': 'Himachal Pradesh',
  'jh': 'Jharkhand',
  'jk': 'Jammu and Kashmir',
  'j&k': 'Jammu and Kashmir',
  'ka': 'Karnataka',
  'kl': 'Kerala',
  'mp': 'Madhya Pradesh',
  'mh': 'Maharashtra',
  'mn': 'Manipur',
  'ml': 'Meghalaya',
  'mz': 'Mizoram',
  'nl': 'Nagaland',
  'or': 'Odisha',
  'od': 'Odisha',
  'pb': 'Punjab',
  'pj': 'Punjab',
  'rj': 'Rajasthan',
  'sk': 'Sikkim',
  'tn': 'Tamil Nadu',
  'tg': 'Telangana',
  'ts': 'Telangana',
  'tr': 'Tripura',
  'up': 'Uttar Pradesh',
  'uk': 'Uttarakhand',
  'ua': 'Uttarakhand',
  'wb': 'West Bengal',
  'dl': 'Delhi',
  'ch': 'Chandigarh',
  'ld': 'Lakshadweep',
  'py': 'Puducherry',
  'la': 'Ladakh',
  'an': 'Andaman and Nicobar Islands',
  'dn': 'Dadra and Nagar Haveli and Daman and Diu',
  'dd': 'Dadra and Nagar Haveli and Daman and Diu',

  // Common variations
  'andhra': 'Andhra Pradesh',
  'arunachal': 'Arunachal Pradesh',
  'chattisgarh': 'Chhattisgarh',
  'chhatisgarh': 'Chhattisgarh',
  'himachal': 'Himachal Pradesh',
  'j & k': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir',
  'jammu kashmir': 'Jammu and Kashmir',
  'madhya pradesh': 'Madhya Pradesh',
  'odisha': 'Odisha',
  'orissa': 'Odisha',
  'pondicherry': 'Puducherry',
  'tamilnadu': 'Tamil Nadu',
  'tamil_nadu': 'Tamil Nadu',
  'west bengal': 'West Bengal',
  'bengal': 'West Bengal',
  'uttaranchal': 'Uttarakhand',
  'uttarpradesh': 'Uttar Pradesh',
  'uttar_pradesh': 'Uttar Pradesh',
  'nct of delhi': 'Delhi',
  'new delhi': 'Delhi',
  'ncr': 'Delhi',
  'a&n islands': 'Andaman and Nicobar Islands',
  'andaman': 'Andaman and Nicobar Islands',
  'andaman & nicobar': 'Andaman and Nicobar Islands',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',

  // Hindi names
  'उत्तर प्रदेश': 'Uttar Pradesh',
  'मध्य प्रदेश': 'Madhya Pradesh',
  'महाराष्ट्र': 'Maharashtra',
  'राजस्थान': 'Rajasthan',
  'गुजरात': 'Gujarat',
  'बिहार': 'Bihar',
  'कर्नाटक': 'Karnataka',
  'तमिलनाडु': 'Tamil Nadu',
  'तेलंगाना': 'Telangana',
  'आंध्र प्रदेश': 'Andhra Pradesh',
  'पश्चिम बंगाल': 'West Bengal',
  'छत्तीसगढ़': 'Chhattisgarh',
  'झारखंड': 'Jharkhand',
  'ओडिशा': 'Odisha',
  'पंजाब': 'Punjab',
  'हरियाणा': 'Haryana',
  'हिमाचल प्रदेश': 'Himachal Pradesh',
  'उत्तराखंड': 'Uttarakhand',
  'गोवा': 'Goa',
  'केरल': 'Kerala',
  'दिल्ली': 'Delhi',
};

/** Canonical state names */
const CANONICAL_STATES = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]);

// ─── Organization Normalization ─────────────────────────────────────────────────

const ORG_PREFIXES_TO_REMOVE = [
  /^(?:the\s+)/i,
  /^(?:office\s+of\s+(?:the\s+)?)/i,
];

const ORG_ABBREVIATIONS: Record<string, string> = {
  'govt': 'Government',
  'govt.': 'Government',
  'gov': 'Government',
  'gov.': 'Government',
  'dept': 'Department',
  'dept.': 'Department',
  'min': 'Ministry',
  'min.': 'Ministry',
  'div': 'Division',
  'div.': 'Division',
  'dist': 'District',
  'dist.': 'District',
  'corp': 'Corporation',
  'corp.': 'Corporation',
  'ltd': 'Limited',
  'ltd.': 'Limited',
  'pvt': 'Private',
  'pvt.': 'Private',
  'engg': 'Engineering',
  'engg.': 'Engineering',
  'engr': 'Engineering',
  'mech': 'Mechanical',
  'mech.': 'Mechanical',
  'elec': 'Electrical',
  'elec.': 'Electrical',
  'rly': 'Railway',
  'rly.': 'Railway',
  'rlys': 'Railways',
  'rlys.': 'Railways',
  'univ': 'University',
  'univ.': 'University',
  'hosp': 'Hospital',
  'hosp.': 'Hospital',
  'mun': 'Municipal',
  'mun.': 'Municipal',
  'mgmt': 'Management',
  'mgmt.': 'Management',
  'devp': 'Development',
  'devt': 'Development',
  'devp.': 'Development',
  'auth': 'Authority',
  'auth.': 'Authority',
  'commr': 'Commissioner',
  'admn': 'Administration',
  'pwd': 'PWD',
  'cpwd': 'CPWD',
  'nhai': 'NHAI',
  'drdo': 'DRDO',
  'isro': 'ISRO',
  'iit': 'IIT',
  'aiims': 'AIIMS',
  'ntpc': 'NTPC',
  'bhel': 'BHEL',
  'ongc': 'ONGC',
  'bsnl': 'BSNL',
  'mtnl': 'MTNL',
};

/**
 * Normalize organization name:
 * - Remove "Govt. of" prefix style
 * - Expand common abbreviations
 * - Clean up whitespace and punctuation
 */
export function normalizeOrganization(input: string | undefined | null): string {
  if (!input) return 'Unknown';

  let name = input.trim();

  // Remove leading "The " / "Office of the"
  for (const pattern of ORG_PREFIXES_TO_REMOVE) {
    name = name.replace(pattern, '');
  }

  // Remove "Govt. of <State>" prefix patterns (keep the rest)
  name = name.replace(
    /^(?:Govt\.?\s+of\s+\w+(?:\s+\w+)?\s*[-,]\s*)/i,
    '',
  );

  // Expand abbreviations (word-boundary safe)
  const words = name.split(/\s+/);
  const expandedWords = words.map((word) => {
    const lower = word.toLowerCase();
    // Keep well-known acronyms uppercase
    if (ORG_ABBREVIATIONS[lower]) return ORG_ABBREVIATIONS[lower];
    return word;
  });
  name = expandedWords.join(' ');

  // Clean up extra spaces and trailing punctuation
  name = name.replace(/\s+/g, ' ').replace(/[,;]+$/, '').trim();

  return name || 'Unknown';
}

// ─── State Normalization ────────────────────────────────────────────────────────

/**
 * Normalize a state/UT name to its canonical form.
 * Returns 'Unknown' if no match found.
 */
export function normalizeState(input: string | undefined | null): string {
  if (!input) return 'Unknown';

  const cleaned = input.trim();

  // Already canonical?
  if (CANONICAL_STATES.has(cleaned)) return cleaned;

  // Try lowercase lookup
  const lower = cleaned.toLowerCase().replace(/\s+/g, ' ');
  const aliased = STATE_ALIASES[lower];
  if (aliased) return aliased;

  // Case-insensitive match against canonical states
  for (const state of CANONICAL_STATES) {
    if (state.toLowerCase() === lower) return state;
  }

  // Partial match: check if the input starts with or contains a canonical state
  for (const state of CANONICAL_STATES) {
    if (lower.includes(state.toLowerCase())) return state;
  }

  // Try alias partial match
  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }

  return cleaned; // Return as-is if no normalization possible
}

// ─── Category Normalization ─────────────────────────────────────────────────────

/**
 * Map portal-specific category names to TenderBazaar's categories.
 * The Prisma schema uses: WORKS, GOODS, SERVICES, CONSULTANCY
 */
const CATEGORY_MAP: Record<string, string> = {
  // WORKS
  'works': 'WORKS',
  'civil works': 'WORKS',
  'construction': 'WORKS',
  'building': 'WORKS',
  'road': 'WORKS',
  'bridge': 'WORKS',
  'infrastructure': 'WORKS',
  'civil': 'WORKS',
  'electrical works': 'WORKS',
  'mechanical works': 'WORKS',
  'plumbing': 'WORKS',
  'painting': 'WORKS',
  'renovation': 'WORKS',
  'repair': 'WORKS',
  'maintenance works': 'WORKS',
  'water supply': 'WORKS',
  'drainage': 'WORKS',
  'irrigation': 'WORKS',
  'railway works': 'WORKS',
  'highway': 'WORKS',

  // GOODS
  'goods': 'GOODS',
  'supply': 'GOODS',
  'supplies': 'GOODS',
  'procurement': 'GOODS',
  'equipment': 'GOODS',
  'machinery': 'GOODS',
  'furniture': 'GOODS',
  'stationery': 'GOODS',
  'computers': 'GOODS',
  'medical equipment': 'GOODS',
  'laboratory equipment': 'GOODS',
  'vehicles': 'GOODS',
  'drugs': 'GOODS',
  'medicines': 'GOODS',
  'pharmaceuticals': 'GOODS',
  'uniforms': 'GOODS',
  'textiles': 'GOODS',
  'food': 'GOODS',
  'ration': 'GOODS',
  'chemicals': 'GOODS',

  // SERVICES
  'services': 'SERVICES',
  'it services': 'SERVICES',
  'software': 'SERVICES',
  'software development': 'SERVICES',
  'outsourcing': 'SERVICES',
  'manpower': 'SERVICES',
  'housekeeping': 'SERVICES',
  'security': 'SERVICES',
  'security services': 'SERVICES',
  'transportation': 'SERVICES',
  'transport': 'SERVICES',
  'catering': 'SERVICES',
  'printing': 'SERVICES',
  'training': 'SERVICES',
  'cleaning': 'SERVICES',
  'waste management': 'SERVICES',
  'telecom': 'SERVICES',
  'telecommunication': 'SERVICES',
  'networking': 'SERVICES',
  'cloud': 'SERVICES',
  'hosting': 'SERVICES',
  'maintenance': 'SERVICES',
  'amc': 'SERVICES',
  'annual maintenance contract': 'SERVICES',
  'insurance': 'SERVICES',

  // CONSULTANCY
  'consultancy': 'CONSULTANCY',
  'consulting': 'CONSULTANCY',
  'advisory': 'CONSULTANCY',
  'design': 'CONSULTANCY',
  'architectural': 'CONSULTANCY',
  'dpr': 'CONSULTANCY',
  'detailed project report': 'CONSULTANCY',
  'feasibility': 'CONSULTANCY',
  'feasibility study': 'CONSULTANCY',
  'survey': 'CONSULTANCY',
  'study': 'CONSULTANCY',
  'research': 'CONSULTANCY',
  'audit': 'CONSULTANCY',
  'valuation': 'CONSULTANCY',
  'legal': 'CONSULTANCY',
  'project management': 'CONSULTANCY',
  'pmc': 'CONSULTANCY',
  'third party inspection': 'CONSULTANCY',
};

/**
 * Map a portal-specific category string to a TenderBazaar category.
 */
export function normalizeCategory(input: string | undefined | null): string {
  if (!input) return 'WORKS';

  const lower = input.trim().toLowerCase();
  const mapped = CATEGORY_MAP[lower];
  if (mapped) return mapped;

  // Partial match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }

  return 'WORKS'; // Default
}

// ─── District/City Normalization ────────────────────────────────────────────────

/**
 * Normalize district/city name:
 * - Title case
 * - Remove trailing "district" / "city" / "nagar" suffixes when redundant
 * - Standardize common variations
 */
export function normalizeDistrict(input: string | undefined | null): string | undefined {
  if (!input) return undefined;

  let cleaned = input.trim();
  if (!cleaned) return undefined;

  // Remove trailing identifiers
  cleaned = cleaned.replace(/\s+(?:district|dist\.?|city|town|tehsil|taluk|block)$/i, '');

  // Title case
  cleaned = toTitleCase(cleaned);

  return cleaned || undefined;
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => {
    // Keep known prepositions lowercase
    const lower = word.toLowerCase();
    if (['of', 'and', 'the', 'in', 'at', 'for'].includes(lower) && word !== str.split(' ')[0]) {
      return lower;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ─── Date Normalization ─────────────────────────────────────────────────────────

/**
 * Ensure a Date is in UTC. If it appears to be in IST (UTC+5:30),
 * convert it. This handles naive dates that were created without timezone.
 */
export function ensureUTC(date: Date | undefined | null): Date | undefined {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return undefined;
  // Dates from the parser are already UTC; just return them
  return date;
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate that required fields are present and set defaults for optional ones.
 */
export function validateAndSetDefaults(
  data: ParsedTenderData,
): NormalizationResult {
  const warnings: string[] = [];

  // Required fields
  if (!data.title) {
    warnings.push('Missing title');
  }
  if (!data.referenceNumber) {
    warnings.push('Missing reference number');
  }
  if (!data.sourcePortal) {
    warnings.push('Missing source portal');
  }
  if (!data.sourceUrl) {
    warnings.push('Missing source URL');
  }
  if (!data.sourceId) {
    warnings.push('Missing source ID');
  }

  // Default dates: publishedDate = now, deadline = 30 days from now
  const now = new Date();
  const defaultDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const publishedDate = ensureUTC(data.publishedDate) || now;
  const bidSubmissionDeadline = ensureUTC(data.bidSubmissionDeadline) || defaultDeadline;

  // Sanity check: deadline should be after published date
  if (bidSubmissionDeadline <= publishedDate) {
    warnings.push('Bid submission deadline is before or equal to published date');
  }

  // Estimated value sanity check
  if (data.estimatedValue !== undefined && data.estimatedValue < 0) {
    warnings.push('Negative estimated value');
  }

  // EMD sanity check — should be less than estimated value
  if (
    data.emdAmount !== undefined &&
    data.estimatedValue !== undefined &&
    data.emdAmount > data.estimatedValue
  ) {
    warnings.push('EMD amount exceeds estimated value');
  }

  const isValid = !!data.title && !!data.sourcePortal && !!data.sourceUrl && !!data.sourceId;

  const normalized: NormalizedTenderData = {
    title: data.title || 'Untitled Tender',
    description: data.description || '',
    referenceNumber: data.referenceNumber || data.sourceId,
    organization: normalizeOrganization(data.organization),
    department: data.department || undefined,
    tenderType: data.tenderType,
    category: normalizeCategory(undefined), // Will be set by categorizer
    status: data.status,
    state: normalizeState(data.state),
    district: normalizeDistrict(data.district),
    city: normalizeDistrict(data.city),
    estimatedValue:
      data.estimatedValue !== undefined && data.estimatedValue >= 0
        ? data.estimatedValue
        : undefined,
    emdAmount:
      data.emdAmount !== undefined && data.emdAmount >= 0
        ? data.emdAmount
        : undefined,
    publishedDate,
    bidSubmissionDeadline,
    bidOpeningDate: ensureUTC(data.bidOpeningDate),
    preBidMeetingDate: ensureUTC(data.preBidMeetingDate),
    sourcePortal: data.sourcePortal,
    sourceUrl: data.sourceUrl,
    sourceId: data.sourceId,
    documents: data.documents,
    rawData: data.rawData,
  };

  return { data: normalized, warnings, isValid };
}

// ─── Full Normalizer ────────────────────────────────────────────────────────────

/**
 * Normalize a parsed tender through the full pipeline.
 */
export function normalizeTenderData(parsed: ParsedTenderData): NormalizationResult {
  return validateAndSetDefaults(parsed);
}
