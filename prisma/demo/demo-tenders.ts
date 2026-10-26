/**
 * Synthetic tender dataset for the isolated demo.
 *
 * Pure and deterministic: the same `now` always yields the same records, and
 * the content (titles, organisations, values) never varies between runs — only
 * dates move, relative to `now`, so ACTIVE tenders keep future deadlines when
 * the seed is re-run before a presentation.
 *
 * Every record is unmistakably synthetic in the data itself:
 *   sourcePortal   one of the demo scraper's `*-Demo` portals
 *   sourceId       DEMO-<PORTAL>-<NNN>
 *   referenceNumber DEMO/<PORTAL>/<FY>/<NNNN>
 *   sourceUrl      demo://tenderbazaar/... — not http(s), so the detail page
 *                  shows its built-in "Source unavailable" state instead of a
 *                  link (no fabricated government URL, no dead link)
 *   description    ends with an explicit "synthetic demonstration record" note
 *   organisations  generic body types + city, not named real departments
 *   award winners  suffixed "(Demo)"
 */

export const DEMO_SOURCE_PORTALS = [
  'GeM-Demo',
  'CPPP-Demo',
  'eProcure-Demo',
  'Maharashtra-Demo',
  'Gujarat-Demo',
  'Rajasthan-Demo',
] as const;

export const DEMO_NOTE =
  'Synthetic demonstration record generated for the TenderBazaar product demo. ' +
  'It is not a real tender and was not obtained from any procurement portal.';

type Category = 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY';
type TenderType = 'OPEN' | 'LIMITED' | 'SINGLE' | 'TWO_PACKET' | 'EOI' | 'AUCTION' | 'RFP' | 'RFQ';
type Status = 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'CORRIGENDUM';

export interface DemoTender {
  title: string;
  description: string;
  referenceNumber: string;
  organization: string;
  department: string;
  tenderType: TenderType;
  category: Category;
  status: Status;
  state: string;
  district: string;
  city: string;
  estimatedValue: number;
  emdAmount: number;
  publishedDate: Date;
  bidSubmissionDeadline: Date;
  bidOpeningDate: Date;
  preBidMeetingDate: Date | null;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  aiSummary: string;
  aiKeywords: string[];
  minTurnover: number | null;
  minNetWorth: number | null;
  minExperience: number | null;
  requiredCertifications: string[];
  reservedForMSME: boolean;
  reservedForStartups: boolean;
  emdExemptMSME: boolean;
  viewCount: number;
  createdAt: Date;
}

export interface DemoDocument {
  id: string;
  sourceId: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

export interface DemoResult {
  id: string;
  sourceId: string;
  winnerName: string;
  winnerCompany: string;
  awardedValue: number;
  awardedDate: Date;
}

export interface DemoDataset {
  tenders: DemoTender[];
  documents: DemoDocument[];
  results: DemoResult[];
}

// ---------------------------------------------------------------------------
// Deterministic randomness (mulberry32) — fixed seed, no Math.random.
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;

const LOCATIONS: Array<{ state: string; district: string; city: string }> = [
  { state: 'Maharashtra', district: 'Pune', city: 'Pune' },
  { state: 'Maharashtra', district: 'Nagpur', city: 'Nagpur' },
  { state: 'Maharashtra', district: 'Mumbai Suburban', city: 'Mumbai' },
  { state: 'Gujarat', district: 'Ahmedabad', city: 'Ahmedabad' },
  { state: 'Gujarat', district: 'Surat', city: 'Surat' },
  { state: 'Gujarat', district: 'Vadodara', city: 'Vadodara' },
  { state: 'Rajasthan', district: 'Jaipur', city: 'Jaipur' },
  { state: 'Rajasthan', district: 'Udaipur', city: 'Udaipur' },
  { state: 'Karnataka', district: 'Bengaluru Urban', city: 'Bengaluru' },
  { state: 'Tamil Nadu', district: 'Chennai', city: 'Chennai' },
  { state: 'Uttar Pradesh', district: 'Lucknow', city: 'Lucknow' },
  { state: 'Delhi', district: 'New Delhi', city: 'New Delhi' },
  { state: 'Madhya Pradesh', district: 'Bhopal', city: 'Bhopal' },
  { state: 'Kerala', district: 'Ernakulam', city: 'Kochi' },
  { state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' },
  { state: 'West Bengal', district: 'Kolkata', city: 'Kolkata' },
];

const PORTAL_STATES: Record<string, string[] | null> = {
  'GeM-Demo': null,
  'CPPP-Demo': null,
  'eProcure-Demo': null,
  'Maharashtra-Demo': ['Maharashtra'],
  'Gujarat-Demo': ['Gujarat'],
  'Rajasthan-Demo': ['Rajasthan'],
};

const PORTAL_CODE: Record<string, string> = {
  'GeM-Demo': 'GEM',
  'CPPP-Demo': 'CPPP',
  'eProcure-Demo': 'EPROC',
  'Maharashtra-Demo': 'MH',
  'Gujarat-Demo': 'GJ',
  'Rajasthan-Demo': 'RJ',
};

/** Generic body types; rendered as "<body>, <city>". */
const ORGANISATIONS: Array<{ name: string; departments: string[] }> = [
  { name: 'Municipal Infrastructure Cell', departments: ['Roads & Bridges', 'Storm Water Drainage', 'Street Lighting'] },
  { name: 'Urban Water Supply & Sewerage Board', departments: ['Water Treatment', 'Distribution Network', 'Sewerage Projects'] },
  { name: 'State Highways Development Authority', departments: ['Project Implementation Unit', 'Maintenance Division'] },
  { name: 'Metro Rail Projects Directorate', departments: ['Civil Works', 'Systems & Signalling', 'Rolling Stock'] },
  { name: 'District Health Services Society', departments: ['Medical Stores', 'Biomedical Engineering', 'Hospital Services'] },
  { name: 'Power Distribution Utility', departments: ['Smart Metering', 'Network Strengthening', 'Renewables Cell'] },
  { name: 'Institute of Technical Education', departments: ['Estate Office', 'Central Purchase', 'IT Services'] },
  { name: 'Smart City Mission Office', departments: ['ICT & Command Centre', 'Urban Mobility', 'Public Spaces'] },
  { name: 'Rural Roads Development Agency', departments: ['Construction Wing', 'Quality Monitoring'] },
  { name: 'Central Stores & Procurement Unit', departments: ['General Stores', 'Vehicles & Equipment'] },
];

const TEMPLATES: Record<Category, Array<{ title: string; keywords: string[]; certs: string[]; scale: [number, number] }>> = {
  WORKS: [
    { title: 'Construction of 4-lane flyover with service roads', keywords: ['flyover', 'bridge', 'civil works'], certs: ['ISO 9001'], scale: [8e7, 2.5e9] },
    { title: 'Resurfacing and strengthening of arterial roads (Package {n})', keywords: ['road resurfacing', 'bituminous', 'civil works'], certs: [], scale: [2e7, 4e8] },
    { title: 'Construction of 200-bed hospital block including MEP works', keywords: ['hospital', 'building construction', 'MEP'], certs: ['ISO 9001', 'ISO 45001'], scale: [3e8, 1.5e9] },
    { title: 'Laying of DI water distribution pipeline (Zone {n})', keywords: ['pipeline', 'water supply', 'DI pipes'], certs: [], scale: [5e7, 6e8] },
    { title: 'Rooftop solar installation on public buildings (1.5 MWp)', keywords: ['solar', 'renewable energy', 'EPC'], certs: ['MNRE empanelment'], scale: [4e7, 1.8e8] },
    { title: 'Construction of storm water drains and culverts (Ward {n})', keywords: ['drainage', 'culverts', 'civil works'], certs: [], scale: [1e7, 1.2e8] },
  ],
  GOODS: [
    { title: 'Supply of LED street light fittings with smart controllers', keywords: ['LED', 'street lighting', 'smart controls'], certs: ['BIS'], scale: [5e6, 9e7] },
    { title: 'Supply and installation of ICU ventilators and patient monitors', keywords: ['medical equipment', 'ventilators', 'ICU'], certs: ['CDSCO', 'ISO 13485'], scale: [1.5e7, 2e8] },
    { title: 'Procurement of desktop computers and peripherals ({n} units)', keywords: ['IT hardware', 'desktops', 'peripherals'], certs: ['OEM authorisation'], scale: [5e6, 6e7] },
    { title: 'Supply of single-phase smart energy meters', keywords: ['smart meters', 'AMI', 'electrical'], certs: ['BIS', 'IS 16444'], scale: [2e7, 3.5e8] },
    { title: 'Supply of electric buses with charging infrastructure', keywords: ['electric buses', 'EV charging', 'mobility'], certs: ['FAME compliance'], scale: [2e8, 1.2e9] },
    { title: 'Supply of laboratory furniture and lab equipment', keywords: ['laboratory', 'furniture', 'education'], certs: [], scale: [3e6, 4e7] },
  ],
  SERVICES: [
    { title: 'Comprehensive annual maintenance of HVAC systems', keywords: ['AMC', 'HVAC', 'facility management'], certs: [], scale: [3e6, 4e7] },
    { title: 'Integrated facility management and housekeeping services', keywords: ['housekeeping', 'facility management', 'manpower'], certs: ['ISO 9001'], scale: [8e6, 1.2e8] },
    { title: 'Operation and maintenance of sewage treatment plant (5 years)', keywords: ['O&M', 'STP', 'wastewater'], certs: [], scale: [3e7, 2.5e8] },
    { title: 'Door-to-door solid waste collection and transportation', keywords: ['solid waste', 'collection', 'sanitation'], certs: [], scale: [2e7, 2e8] },
    { title: 'Managed security services for campus premises', keywords: ['security services', 'manpower', 'CCTV'], certs: ['PSARA licence'], scale: [5e6, 6e7] },
    { title: 'Cloud hosting and managed IT services for citizen portal', keywords: ['cloud', 'managed services', 'IT'], certs: ['MeitY empanelment', 'ISO 27001'], scale: [1e7, 1.5e8] },
  ],
  CONSULTANCY: [
    { title: 'Project management consultancy for urban infrastructure works', keywords: ['PMC', 'consultancy', 'infrastructure'], certs: [], scale: [1e7, 1.5e8] },
    { title: 'Detailed project report preparation for ring road', keywords: ['DPR', 'feasibility', 'highways'], certs: [], scale: [5e6, 6e7] },
    { title: 'Third-party quality audit of construction works', keywords: ['quality audit', 'third party inspection'], certs: ['NABL accreditation'], scale: [2e6, 2.5e7] },
    { title: 'Transaction advisory for PPP bus depot redevelopment', keywords: ['transaction advisory', 'PPP', 'mobility'], certs: [], scale: [5e6, 4e7] },
  ],
};

const TYPES_BY_CATEGORY: Record<Category, TenderType[]> = {
  WORKS: ['OPEN', 'OPEN', 'TWO_PACKET', 'LIMITED'],
  GOODS: ['OPEN', 'RFQ', 'TWO_PACKET', 'AUCTION'],
  SERVICES: ['OPEN', 'RFP', 'TWO_PACKET', 'LIMITED'],
  CONSULTANCY: ['RFP', 'EOI', 'OPEN'],
};

const WINNERS = [
  'Sahyadri Buildcon',
  'Narmada Infra Projects',
  'Aravalli Engineering Works',
  'Coastal MedTech Systems',
  'Deccan Smart Utilities',
  'Ganga Facility Services',
];

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

function between(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

/** Log-uniform value rounded to a "quoted" figure (nearest ₹1,000 / ₹10,000). */
function amount(r: () => number, [lo, hi]: [number, number]): number {
  const v = Math.exp(Math.log(lo) + r() * (Math.log(hi) - Math.log(lo)));
  const step = v > 1e8 ? 1e5 : v > 1e7 ? 1e4 : 1e3;
  return Math.round(v / step) * step;
}

function formatInr(value: number): string {
  return value >= 1e7 ? `₹${(value / 1e7).toFixed(2)} crore` : `₹${(value / 1e5).toFixed(2)} lakh`;
}

const STATUS_PLAN: Status[] = [
  ...Array<Status>(74).fill('ACTIVE'),
  ...Array<Status>(5).fill('CORRIGENDUM'),
  ...Array<Status>(10).fill('CLOSED'),
  ...Array<Status>(8).fill('AWARDED'),
  ...Array<Status>(3).fill('CANCELLED'),
];

export const DEMO_TENDER_COUNT = STATUS_PLAN.length;

/** Build the full dataset relative to `now`. Deterministic for a given `now`. */
export function buildDemoDataset(now: Date): DemoDataset {
  const r = rng(20261022);
  const tenders: DemoTender[] = [];
  const documents: DemoDocument[] = [];
  const results: DemoResult[] = [];
  const t0 = now.getTime();
  const fy = `${now.getUTCFullYear()}-${String((now.getUTCFullYear() + 1) % 100).padStart(2, '0')}`;
  const counters: Record<string, number> = {};

  // Deterministic shuffle so every portal gets a mix of statuses.
  const statuses = [...STATUS_PLAN];
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
  }

  statuses.forEach((status, index) => {
    const portal = DEMO_SOURCE_PORTALS[index % DEMO_SOURCE_PORTALS.length];
    const seq = (counters[portal] = (counters[portal] ?? 0) + 1);
    const code = PORTAL_CODE[portal];
    const allowed = PORTAL_STATES[portal];
    const location = pick(r, allowed ? LOCATIONS.filter((l) => allowed.includes(l.state)) : LOCATIONS);
    const category = pick(r, ['WORKS', 'WORKS', 'GOODS', 'GOODS', 'SERVICES', 'SERVICES', 'CONSULTANCY'] as Category[]);
    const template = pick(r, TEMPLATES[category]);
    const org = pick(r, ORGANISATIONS);
    const department = pick(r, org.departments);
    const value = amount(r, template.scale);
    const emd = Math.round((value * (value > 1e8 ? 0.01 : 0.02)) / 1000) * 1000;

    // Dates relative to now. ACTIVE/CORRIGENDUM always have future deadlines,
    // so GET /tenders/stats will not rewrite them to CLOSED.
    let publishedAgo: number;
    let deadlineIn: number;
    if (status === 'ACTIVE' || status === 'CORRIGENDUM') {
      publishedAgo = between(r, 0, 24);
      deadlineIn = between(r, 4, 45);
    } else if (status === 'CLOSED' || status === 'CANCELLED') {
      publishedAgo = between(r, 30, 70);
      deadlineIn = -between(r, 2, 25);
    } else {
      publishedAgo = between(r, 60, 120);
      deadlineIn = -between(r, 25, 55);
    }
    const publishedDate = new Date(t0 - publishedAgo * DAY - between(r, 0, 8) * 3600 * 1000);
    const bidSubmissionDeadline = new Date(t0 + deadlineIn * DAY + 15 * 3600 * 1000 - (t0 % DAY));
    const bidOpeningDate = new Date(bidSubmissionDeadline.getTime() + 1 * DAY + 2 * 3600 * 1000);
    const preBidMeetingDate =
      category === 'GOODS' && r() < 0.5 ? null : new Date(publishedDate.getTime() + between(r, 5, 10) * DAY);

    const title = template.title.replace('{n}', String(between(r, 2, 12)));
    const sourceId = `DEMO-${code}-${String(seq).padStart(3, '0')}`;
    const msme = r() < 0.35;
    const minExperience = category === 'GOODS' ? between(r, 1, 3) : between(r, 3, 10);

    const statusLine =
      status === 'CORRIGENDUM'
        ? ' A corrigendum has revised the bid submission schedule.'
        : status === 'CANCELLED'
        ? ' This tender was cancelled by the issuing authority.'
        : '';

    tenders.push({
      title: `${title} — ${location.city}`,
      description:
        `${title} for the ${department} department of the ${org.name}, ${location.city}. ` +
        `Estimated cost ${formatInr(value)}; EMD ${formatInr(emd)}. ` +
        `Bidders must demonstrate at least ${minExperience} years of relevant experience.${statusLine}\n\n${DEMO_NOTE}`,
      referenceNumber: `DEMO/${code}/${fy}/${String(1000 + seq).padStart(4, '0')}`,
      organization: `${org.name}, ${location.city}`,
      department,
      tenderType: pick(r, TYPES_BY_CATEGORY[category]),
      category,
      status,
      state: location.state,
      district: location.district,
      city: location.city,
      estimatedValue: value,
      emdAmount: emd,
      publishedDate,
      bidSubmissionDeadline,
      bidOpeningDate,
      preBidMeetingDate,
      sourcePortal: portal,
      sourceUrl: `demo://tenderbazaar/${portal.toLowerCase()}/${sourceId}`,
      sourceId,
      aiSummary:
        `${category.charAt(0)}${category.slice(1).toLowerCase()} tender: ${title.toLowerCase()} in ${location.city}, ` +
        `${location.state}, valued at ${formatInr(value)}. Demo record.`,
      aiKeywords: [...template.keywords, location.city.toLowerCase()],
      minTurnover: Math.round((value * (0.3 + r() * 0.5)) / 1e5) * 1e5,
      minNetWorth: r() < 0.6 ? Math.round((value * 0.1) / 1e5) * 1e5 : null,
      minExperience,
      requiredCertifications: template.certs,
      reservedForMSME: msme,
      reservedForStartups: msme && r() < 0.3,
      emdExemptMSME: msme && r() < 0.7,
      viewCount: status === 'ACTIVE' ? between(r, 12, 940) : between(r, 40, 400),
      // Spread over the last month so admin charts grouped by createdAt show a
      // trend rather than a single spike on the seed date.
      createdAt: new Date(Math.min(publishedDate.getTime() + 2 * 3600 * 1000, t0)),
    });

    const docs: Array<[string, string]> = [['Notice Inviting Tender (NIT)', 'pdf']];
    if (category === 'WORKS' || category === 'GOODS') docs.push(['Bill of Quantities', 'xlsx']);
    docs.push([category === 'CONSULTANCY' ? 'Terms of Reference' : 'Technical Specifications', 'pdf']);
    if (status === 'CORRIGENDUM') docs.push(['Corrigendum No. 1', 'pdf']);
    docs.forEach(([name, type], n) => {
      documents.push({
        id: `demo-doc-${sourceId}-${n + 1}`,
        sourceId,
        name: `${name}.${type}`,
        fileUrl: `demo://tenderbazaar/${portal.toLowerCase()}/${sourceId}/${n + 1}.${type}`,
        fileType: type,
        fileSize: between(r, 180, 4200) * 1024,
      });
    });

    if (status === 'AWARDED') {
      const winner = pick(r, WINNERS);
      results.push({
        id: `demo-result-${sourceId}`,
        sourceId,
        winnerName: `${winner} (Demo)`,
        winnerCompany: `${winner} Pvt Ltd (Demo)`,
        awardedValue: Math.round((value * (0.86 + r() * 0.1)) / 1000) * 1000,
        awardedDate: new Date(bidSubmissionDeadline.getTime() + between(r, 10, 20) * DAY),
      });
    }
  });

  return { tenders, documents, results };
}
