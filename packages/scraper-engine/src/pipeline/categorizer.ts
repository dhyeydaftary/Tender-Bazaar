/**
 * Auto-Categorizer
 *
 * Keyword-based classification into TenderBazaar categories:
 * WORKS, GOODS, SERVICES, CONSULTANCY (matching the Prisma TenderCategory enum).
 *
 * Features:
 * - Score-based matching with weighted keyword hits
 * - Keyword extraction (top 10 significant terms from title + description)
 * - Hindi/regional language keyword support
 * - Fallback to WORKS if no strong match
 */

import type { NormalizedTenderData } from './normalizer';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type TenderBazaarCategory = 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY';

export interface CategorizationResult {
  category: TenderBazaarCategory;
  confidence: number; // 0-1
  scores: Record<TenderBazaarCategory, number>;
  keywords: string[];
}

// ─── Category Keywords ──────────────────────────────────────────────────────────

/**
 * English keyword lists per category.
 * Higher specificity keywords have higher weight (appear first in each list).
 */
const CATEGORY_KEYWORDS: Record<TenderBazaarCategory, string[]> = {
  WORKS: [
    // High specificity
    'construction', 'civil work', 'civil works', 'building construction',
    'road construction', 'bridge construction', 'road work', 'bridge work',
    'renovation', 'repair and maintenance', 'restoration',
    'infrastructure development', 'infrastructure',

    // Medium specificity
    'building', 'road', 'bridge', 'highway', 'flyover', 'overpass',
    'dam', 'canal', 'embankment', 'drainage', 'sewerage', 'sewer',
    'pipeline', 'laying of pipe', 'water supply scheme',
    'electrical installation', 'wiring work',
    'plumbing', 'sanitation work', 'toilet',
    'painting', 'flooring', 'roofing', 'waterproofing',
    'excavation', 'earthwork', 'foundation', 'pile',
    'retaining wall', 'compound wall', 'fencing',

    // Lower specificity
    'pwd', 'cpwd', 'nhai', 'pmgsy', 'pmay',
    'epc', 'turnkey', 'design and build',
    'sor', 'schedule of rates', 'boq', 'bill of quantities',
    'rcc', 'steel structure', 'pre-engineered',
    'widening', 'strengthening', 'resurfacing',
    'borewell', 'tubewell', 'handpump',
    'solar installation', 'rooftop solar',
    'irrigation', 'lift irrigation',
  ],

  GOODS: [
    // High specificity
    'supply of', 'procurement of', 'purchase of', 'supply and delivery',
    'rate contract for supply', 'annual rate contract',

    // Medium specificity — equipment
    'equipment', 'machinery', 'machine', 'instrument', 'apparatus',
    'medical equipment', 'laboratory equipment', 'lab equipment',
    'surgical instrument', 'hospital equipment',
    'computer', 'laptop', 'desktop', 'server', 'printer', 'scanner',
    'ups', 'inverter', 'generator', 'dg set',
    'air conditioner', 'ac', 'hvac',
    'cctv', 'camera', 'surveillance',
    'vehicle', 'ambulance', 'bus', 'truck',

    // Medium specificity — materials
    'cement', 'steel', 'timber', 'sand', 'aggregate', 'bitumen',
    'furniture', 'chair', 'table', 'desk', 'almirah', 'cabinet',
    'stationery', 'paper', 'toner', 'cartridge',
    'uniform', 'textile', 'fabric', 'clothing',
    'medicine', 'drug', 'pharmaceutical', 'vaccine', 'syringe',
    'chemical', 'reagent', 'consumable',
    'food', 'ration', 'grocery', 'rice', 'wheat', 'dal',
    'fuel', 'diesel', 'petrol', 'lubricant',
    'pipe', 'fitting', 'valve', 'pump', 'motor',
    'cable', 'wire', 'transformer', 'switch', 'panel',
    'tool', 'spare part', 'hardware',
  ],

  SERVICES: [
    // High specificity
    'service contract', 'outsourcing', 'manpower supply',
    'annual maintenance contract', 'amc', 'comprehensive maintenance',
    'facility management', 'housekeeping service',

    // Medium specificity — IT
    'software development', 'application development', 'web development',
    'mobile app', 'it services', 'system integration',
    'cloud services', 'saas', 'hosting', 'data center',
    'networking', 'wan', 'lan', 'firewall',
    'erp', 'digitization', 'digital', 'e-governance',
    'cyber security', 'information security',

    // Medium specificity — General
    'security service', 'security guard', 'watchman',
    'cleaning', 'sanitation', 'waste management', 'garbage',
    'transport service', 'transportation service', 'logistics',
    'catering', 'canteen', 'mess',
    'laundry', 'washing',
    'printing', 'photocopying', 'scanning',
    'training', 'skill development', 'capacity building',
    'event management', 'conference',
    'advertising', 'publicity', 'media', 'branding',
    'courier', 'postal', 'delivery',
    'insurance', 'tpa',
    'hiring of vehicle', 'vehicle hiring', 'cab service', 'taxi',
    'manpower', 'contractual staff', 'outsource staff',
    'helpdesk', 'call center', 'bpo',
    'testing', 'calibration', 'certification',
    'telecom', 'telecommunication', 'broadband', 'internet',
  ],

  CONSULTANCY: [
    // High specificity
    'consultancy service', 'consulting service', 'advisory service',
    'detailed project report', 'dpr preparation', 'feasibility study',
    'third party inspection', 'third party audit',
    'project management consultancy', 'pmc',
    'design consultancy', 'architectural consultancy',

    // Medium specificity
    'consultant', 'advisor', 'expert',
    'survey', 'topographical survey', 'land survey',
    'investigation', 'soil investigation', 'geotechnical',
    'environmental impact assessment', 'eia', 'esia',
    'traffic study', 'traffic survey',
    'master plan', 'town planning', 'urban planning',
    'structural design', 'architectural design',
    'valuation', 'assessment', 'appraisal',
    'audit', 'financial audit', 'statutory audit',
    'legal service', 'legal advisor', 'advocate', 'lawyer',
    'chartered accountant', 'ca', 'cs', 'company secretary',
    'quality assurance', 'quality control', 'qa qc',
    'monitoring and evaluation', 'impact assessment',
    'research', 'study', 'analysis', 'review',
    'supervision', 'construction supervision',
  ],
};

/**
 * Hindi/regional language keywords mapped to categories.
 */
const HINDI_CATEGORY_KEYWORDS: Record<TenderBazaarCategory, string[]> = {
  WORKS: [
    'निर्माण', 'सड़क', 'पुल', 'भवन', 'मरम्मत', 'जीर्णोद्धार',
    'नहर', 'बांध', 'सिंचाई', 'जलापूर्ति', 'नाला', 'नाली',
    'विद्युतीकरण', 'पाइपलाइन', 'शौचालय',
  ],
  GOODS: [
    'आपूर्ति', 'सामग्री', 'उपकरण', 'सीमेंट', 'लोहा', 'फर्नीचर',
    'कंप्यूटर', 'दवाई', 'औषधि', 'वाहन', 'स्टेशनरी', 'राशन',
    'वर्दी', 'जनरेटर', 'पंप',
  ],
  SERVICES: [
    'सेवा', 'ठेका', 'सफाई', 'सुरक्षा', 'परिवहन', 'प्रशिक्षण',
    'रखरखाव', 'मैनपावर', 'आउटसोर्सिंग', 'कैटरिंग', 'मुद्रण',
    'डिजिटल', 'सॉफ्टवेयर',
  ],
  CONSULTANCY: [
    'परामर्श', 'सलाहकार', 'सर्वेक्षण', 'अध्ययन', 'डिजाइन',
    'ऑडिट', 'लेखापरीक्षा', 'मूल्यांकन', 'योजना', 'पर्यवेक्षण',
  ],
};

// ─── Stopwords ──────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'shall', 'should', 'may', 'might', 'can', 'could', 'not', 'no', 'nor',
  'if', 'then', 'else', 'when', 'up', 'out', 'as', 'so', 'it', 'its',
  'this', 'that', 'these', 'those', 'all', 'each', 'every', 'both',
  'any', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
  'than', 'too', 'very', 'just', 'also', 'etc', 'viz', 'ie', 'eg',
  // Indian government common terms (not categorization-relevant)
  'tender', 'bid', 'notice', 'nit', 'corrigendum', 'amendment',
  'government', 'dept', 'department', 'ministry', 'office', 'division',
  'section', 'circle', 'zone', 'region', 'district', 'state',
  'national', 'central', 'public', 'india', 'indian',
  'no', 'number', 'ref', 'reference', 'dated', 'date', 'year',
  'regarding', 'subject', 'inviting', 'invited', 'submission',
  'last', 'opening', 'closing', 'extended', 'revised',
  'sri', 'shri', 'smt', 'mr', 'mrs', 'dr',
  // Common Hindi stopwords
  'का', 'के', 'की', 'में', 'से', 'है', 'हैं', 'को', 'पर', 'एवं',
  'तथा', 'और', 'व', 'हेतु', 'द्वारा', 'कार्य', 'संबंधित', 'अंतर्गत',
]);

// ─── Categorizer Functions ──────────────────────────────────────────────────────

/**
 * Calculate category scores for a text input.
 * Returns a score map (higher = better match).
 */
function calculateCategoryScores(text: string): Record<TenderBazaarCategory, number> {
  const lower = text.toLowerCase();

  const scores: Record<TenderBazaarCategory, number> = {
    WORKS: 0,
    GOODS: 0,
    SERVICES: 0,
    CONSULTANCY: 0,
  };

  const categories: TenderBazaarCategory[] = ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'];

  for (const category of categories) {
    const englishKeywords = CATEGORY_KEYWORDS[category];
    const hindiKeywords = HINDI_CATEGORY_KEYWORDS[category];

    // Score English keywords with position-based weighting
    // Keywords earlier in the list are more specific, so they get higher weight
    for (let i = 0; i < englishKeywords.length; i++) {
      const keyword = englishKeywords[i];
      if (lower.includes(keyword)) {
        // Weight: specific keywords (first third) get 3x, medium get 2x, general get 1x
        const position = i / englishKeywords.length;
        let weight: number;
        if (position < 0.33) weight = 3;
        else if (position < 0.66) weight = 2;
        else weight = 1;

        // Bonus for exact phrase match vs partial containment
        const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        if (wordBoundaryRegex.test(text)) {
          weight *= 1.5;
        }

        scores[category] += weight;
      }
    }

    // Score Hindi keywords (uniform weight = 2)
    for (const keyword of hindiKeywords) {
      if (lower.includes(keyword)) {
        scores[category] += 2;
      }
    }
  }

  return scores;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the top N significant keywords from text.
 * Removes stopwords, sorts by frequency, returns unique terms.
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
  if (!text) return [];

  // Tokenize: split on non-word characters, keep Devanagari
  const tokens = text
    .toLowerCase()
    .split(/[^a-zA-Z0-9\u0900-\u097F]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  // Count frequency
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  // Sort by frequency descending, then alphabetically
  const sorted = [...freq.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([word]) => word);

  return sorted.slice(0, topN);
}

/**
 * Auto-categorize a tender based on its title and description.
 *
 * @returns CategorizationResult with category, confidence, scores, and extracted keywords
 */
export function categorizeTender(tender: NormalizedTenderData): CategorizationResult {
  const combinedText = `${tender.title} ${tender.description}`.trim();

  if (!combinedText) {
    return {
      category: 'WORKS',
      confidence: 0,
      scores: { WORKS: 0, GOODS: 0, SERVICES: 0, CONSULTANCY: 0 },
      keywords: [],
    };
  }

  const scores = calculateCategoryScores(combinedText);
  const keywords = extractKeywords(combinedText, 10);

  // Find the category with the highest score
  const categories: TenderBazaarCategory[] = ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'];
  let bestCategory: TenderBazaarCategory = 'WORKS';
  let bestScore = 0;
  let totalScore = 0;

  for (const cat of categories) {
    totalScore += scores[cat];
    if (scores[cat] > bestScore) {
      bestScore = scores[cat];
      bestCategory = cat;
    }
  }

  // Calculate confidence (0-1)
  // If total score is 0, confidence is 0 (will default to WORKS)
  const confidence = totalScore > 0 ? bestScore / totalScore : 0;

  // If confidence is too low (< 0.3 or totalScore < 2), default to WORKS
  if (confidence < 0.3 || totalScore < 2) {
    return {
      category: 'WORKS',
      confidence: 0,
      scores,
      keywords,
    };
  }

  return {
    category: bestCategory,
    confidence: Math.round(confidence * 100) / 100,
    scores,
    keywords,
  };
}

/**
 * Convenience: categorize and return just the category string.
 */
export function getCategoryForTender(tender: NormalizedTenderData): TenderBazaarCategory {
  return categorizeTender(tender).category;
}
