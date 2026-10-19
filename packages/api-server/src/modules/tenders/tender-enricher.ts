/**
 * Tender Document & Details Dynamic Enrichment Engine
 *
 * Automatically extracts, infers, and calculates missing key requirements and full details
 * from tender description, titles, source portals, documents, and standard Indian government
 * procurement norms (GeM GTC, CPWD Manual, CPPP standards).
 */

interface RawTender {
  id: string;
  title: string;
  description?: string | null;
  referenceNumber: string;
  organization: string;
  department?: string | null;
  tenderType: string;
  category: string;
  status: string;
  state: string;
  district?: string | null;
  city?: string | null;
  estimatedValue?: number | null;
  emdAmount?: number | null;
  publishedDate: Date | string;
  bidSubmissionDeadline: Date | string;
  bidOpeningDate?: Date | string | null;
  preBidMeetingDate?: Date | string | null;
  sourcePortal: string;
  sourceUrl: string;
  aiSummary?: string | null;
  aiKeywords?: string[];
  aiEligibilityText?: string | null;
  minTurnover?: number | null;
  minNetWorth?: number | null;
  minExperience?: number | null;
  requiredCertifications?: string[];
  reservedForMSME?: boolean;
  reservedForStartups?: boolean;
  emdExemptMSME?: boolean;
  organizationType?: string | null;
  tenderFee?: number | null;
  completionPeriod?: string | null;
  documents?: any[];
  [key: string]: any;
}

// Indian City / Town to District Mapping
const CITY_TO_DISTRICT: Record<string, { district: string; state?: string }> = {
  limbdi: { district: 'Surendranagar', state: 'Gujarat' },
  surendranagar: { district: 'Surendranagar', state: 'Gujarat' },
  ahmedabad: { district: 'Ahmedabad', state: 'Gujarat' },
  gandhinagar: { district: 'Gandhinagar', state: 'Gujarat' },
  vadodara: { district: 'Vadodara', state: 'Gujarat' },
  baroda: { district: 'Vadodara', state: 'Gujarat' },
  surat: { district: 'Surat', state: 'Gujarat' },
  rajkot: { district: 'Rajkot', state: 'Gujarat' },
  bhavnagar: { district: 'Bhavnagar', state: 'Gujarat' },
  jamnagar: { district: 'Jamnagar', state: 'Gujarat' },
  junagadh: { district: 'Junagadh', state: 'Gujarat' },
  anand: { district: 'Anand', state: 'Gujarat' },
  kheda: { district: 'Kheda', state: 'Gujarat' },
  mehsana: { district: 'Mehsana', state: 'Gujarat' },
  bhuj: { district: 'Kutch', state: 'Gujarat' },
  kutch: { district: 'Kutch', state: 'Gujarat' },
  mumbai: { district: 'Mumbai Suburban', state: 'Maharashtra' },
  pune: { district: 'Pune', state: 'Maharashtra' },
  nagpur: { district: 'Nagpur', state: 'Maharashtra' },
  nashik: { district: 'Nashik', state: 'Maharashtra' },
  thane: { district: 'Thane', state: 'Maharashtra' },
  aurangabad: { district: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
  bengaluru: { district: 'Bengaluru Urban', state: 'Karnataka' },
  bangalore: { district: 'Bengaluru Urban', state: 'Karnataka' },
  mysuru: { district: 'Mysuru', state: 'Karnataka' },
  hubballi: { district: 'Dharwad', state: 'Karnataka' },
  hyderabad: { district: 'Hyderabad', state: 'Telangana' },
  chennai: { district: 'Chennai', state: 'Tamil Nadu' },
  coimbatore: { district: 'Coimbatore', state: 'Tamil Nadu' },
  madurai: { district: 'Madurai', state: 'Tamil Nadu' },
  kolkata: { district: 'Kolkata', state: 'West Bengal' },
  howrah: { district: 'Howrah', state: 'West Bengal' },
  delhi: { district: 'New Delhi', state: 'Delhi' },
  'new delhi': { district: 'New Delhi', state: 'Delhi' },
  noida: { district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  lucknow: { district: 'Lucknow', state: 'Uttar Pradesh' },
  kanpur: { district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
  varanasi: { district: 'Varanasi', state: 'Uttar Pradesh' },
  agra: { district: 'Agra', state: 'Uttar Pradesh' },
  prayagraj: { district: 'Prayagraj', state: 'Uttar Pradesh' },
  allahabad: { district: 'Prayagraj', state: 'Uttar Pradesh' },
  jaipur: { district: 'Jaipur', state: 'Rajasthan' },
  jodhpur: { district: 'Jodhpur', state: 'Rajasthan' },
  udaipur: { district: 'Udaipur', state: 'Rajasthan' },
  bhopal: { district: 'Bhopal', state: 'Madhya Pradesh' },
  indore: { district: 'Indore', state: 'Madhya Pradesh' },
  gwalior: { district: 'Gwalior', state: 'Madhya Pradesh' },
  patna: { district: 'Patna', state: 'Bihar' },
  ranchi: { district: 'Ranchi', state: 'Jharkhand' },
  bhubaneswar: { district: 'Khordha', state: 'Odisha' },
  cuttack: { district: 'Cuttack', state: 'Odisha' },
  chandigarh: { district: 'Chandigarh', state: 'Chandigarh' },
  shimla: { district: 'Shimla', state: 'Himachal Pradesh' },
  dehradun: { district: 'Dehradun', state: 'Uttarakhand' },
  guwahati: { district: 'Kamrup Metropolitan', state: 'Assam' },
  thiruvananthapuram: { district: 'Thiruvananthapuram', state: 'Kerala' },
  kochi: { district: 'Ernakulam', state: 'Kerala' },
  kozhikode: { district: 'Kozhikode', state: 'Kerala' },
};

/**
 * Infer Organization Type from Organization and Department strings
 */
export function inferOrganizationType(org: string = '', dept: string = ''): string {
  const text = `${org} ${dept}`.toLowerCase();

  if (text.includes('health & family welfare') || text.includes('gujarat') || text.includes('maharashtra') ||
      text.includes('rajasthan') || text.includes('uttar pradesh') || text.includes('karnataka') ||
      text.includes('tamil nadu') || text.includes('state') || text.includes('pwd') || text.includes('panchayat')) {
    return 'State Government Department';
  }
  if (text.includes('ministry of') || text.includes('central') || text.includes('department of defence') ||
      text.includes('railway') || text.includes('income tax') || text.includes('cbic') || text.includes('cpwd')) {
    return 'Central Government Ministry';
  }
  if (text.includes('bhel') || text.includes('ntpc') || text.includes('ongc') || text.includes('iocl') ||
      text.includes('sail') || text.includes('bel') || text.includes('coal india') || text.includes('power grid') ||
      text.includes('limited') || text.includes('corporation') || text.includes('psu')) {
    return 'Public Sector Undertaking (PSU)';
  }
  if (text.includes('municipal') || text.includes('nagar nigam') || text.includes('development authority') ||
      text.includes('smart city') || text.includes('metro rail')) {
    return 'Urban Local Body (Municipal)';
  }
  if (text.includes('aiims') || text.includes('iit') || text.includes('nit') || text.includes('iim') ||
      text.includes('csir') || text.includes('drdo') || text.includes('university') || text.includes('isro') ||
      text.includes('hospital') || text.includes('sdh')) {
    return 'Autonomous Body / Statutory Institution';
  }
  if (text.includes('gem') || text.includes('government e-marketplace')) {
    return 'Central Autonomous / SPV (Ministry of Commerce)';
  }

  return 'State Government Department';
}

/**
 * Infer District and City from text
 */
export function inferDistrict(title: string = '', dept: string = '', state: string = '', org: string = ''): { district: string; city: string } {
  const combined = `${title} ${dept} ${org}`.toLowerCase();

  for (const [key, val] of Object.entries(CITY_TO_DISTRICT)) {
    if (combined.includes(key)) {
      return {
        district: val.district,
        city: key.charAt(0).toUpperCase() + key.slice(1),
      };
    }
  }

  // State-level headquarters and major capital mappings
  const stateLower = (state || '').toLowerCase();
  const orgDeptLower = `${org} ${dept} ${title}`.toLowerCase();

  if (stateLower.includes('gujarat') || orgDeptLower.includes('gujarat')) {
    return { district: 'Gandhinagar', city: 'Gandhinagar' };
  }
  if (stateLower.includes('maharashtra') || orgDeptLower.includes('maharashtra') || orgDeptLower.includes('mumbai')) {
    return { district: 'Mumbai', city: 'Mumbai' };
  }
  if (stateLower.includes('karnataka') || orgDeptLower.includes('karnataka') || orgDeptLower.includes('bengaluru')) {
    return { district: 'Bengaluru Urban', city: 'Bengaluru' };
  }
  if (stateLower.includes('delhi') || orgDeptLower.includes('delhi')) {
    return { district: 'New Delhi', city: 'New Delhi' };
  }
  if (stateLower.includes('tamil nadu') || orgDeptLower.includes('tamil nadu') || orgDeptLower.includes('chennai')) {
    return { district: 'Chennai', city: 'Chennai' };
  }
  if (stateLower.includes('west bengal') || orgDeptLower.includes('west bengal') || orgDeptLower.includes('kolkata')) {
    return { district: 'Kolkata', city: 'Kolkata' };
  }
  if (stateLower.includes('telangana') || orgDeptLower.includes('telangana') || orgDeptLower.includes('hyderabad')) {
    return { district: 'Hyderabad', city: 'Hyderabad' };
  }
  if (stateLower.includes('rajasthan') || orgDeptLower.includes('rajasthan') || orgDeptLower.includes('jaipur')) {
    return { district: 'Jaipur', city: 'Jaipur' };
  }
  if (stateLower.includes('uttar pradesh') || orgDeptLower.includes('uttar pradesh') || orgDeptLower.includes('lucknow')) {
    return { district: 'Lucknow', city: 'Lucknow' };
  }
  if (stateLower.includes('madhya pradesh') || orgDeptLower.includes('madhya pradesh') || orgDeptLower.includes('bhopal')) {
    return { district: 'Bhopal', city: 'Bhopal' };
  }
  if (stateLower.includes('kerala') || orgDeptLower.includes('kerala')) {
    return { district: 'Thiruvananthapuram', city: 'Thiruvananthapuram' };
  }
  if (stateLower.includes('andhra pradesh') || orgDeptLower.includes('andhra pradesh')) {
    return { district: 'Visakhapatnam', city: 'Visakhapatnam' };
  }
  if (stateLower.includes('punjab') || stateLower.includes('haryana') || stateLower.includes('chandigarh')) {
    return { district: 'Chandigarh', city: 'Chandigarh' };
  }
  if (stateLower.includes('bihar') || orgDeptLower.includes('bihar')) {
    return { district: 'Patna', city: 'Patna' };
  }
  if (stateLower.includes('odisha') || orgDeptLower.includes('odisha')) {
    return { district: 'Khordha', city: 'Bhubaneswar' };
  }
  if (stateLower.includes('assam') || orgDeptLower.includes('assam')) {
    return { district: 'Kamrup Metropolitan', city: 'Guwahati' };
  }
  if (stateLower.includes('jharkhand')) {
    return { district: 'Ranchi', city: 'Ranchi' };
  }
  if (stateLower.includes('uttarakhand')) {
    return { district: 'Dehradun', city: 'Dehradun' };
  }
  if (stateLower.includes('himachal')) {
    return { district: 'Shimla', city: 'Shimla' };
  }

  return { district: state && state !== 'All India' ? `${state} District` : 'New Delhi (HQ)', city: state && state !== 'All India' ? state : 'New Delhi' };
}

/**
 * Infer Contract / Work Completion Period
 */
export function inferCompletionPeriod(title: string = '', category: string = ''): string {
  const text = title.toLowerCase();

  const matchDays = text.match(/(\d+)\s*(?:days|day)/);
  if (matchDays) return `${matchDays[1]} Days`;

  const matchMonths = text.match(/(\d+)\s*(?:months|month)/);
  if (matchMonths) return `${matchMonths[1]} Months`;

  const matchYears = text.match(/(\d+)\s*(?:years|year|yr)/);
  if (matchYears) return `${matchYears[1]} Year(s)`;

  if (text.includes('amc') || text.includes('cmc') || text.includes('maintenance') ||
      text.includes('repair') || text.includes('service provider') || text.includes('security') ||
      text.includes('manpower') || text.includes('housekeeping')) {
    return '12 Months (Annual Contract)';
  }

  if (category === 'WORKS' || text.includes('construction') || text.includes('building') || text.includes('road')) {
    return '180 Days (6 Months)';
  }

  if (category === 'SERVICES' || text.includes('consultancy')) {
    return '90 Days (3 Months)';
  }

  return '30 - 60 Days (Delivery Period)';
}

/**
 * Infer Category Specific Certifications
 */
export function inferCertifications(title: string = '', category: string = '', dept: string = ''): string[] {
  const text = `${title} ${dept}`.toLowerCase();

  if (text.includes('medical') || text.includes('hospital') || text.includes('health') ||
      text.includes('sdh') || text.includes('diaper') || text.includes('equipment') || text.includes('scan')) {
    return [
      'ISO 9001:2015 (QMS)',
      'ISO 13485 (Medical Devices Quality)',
      'OEM Authorization Certificate',
      'GST Registration Certificate',
      'PAN Card',
    ];
  }

  if (text.includes('software') || text.includes('it') || text.includes('computer') ||
      text.includes('server') || text.includes('data') || text.includes('cctv')) {
    return [
      'ISO 9001:2015',
      'ISO 27001 (Information Security)',
      'OEM Authorization Certificate',
      'CMMI Level 3 or higher',
      'GST Registration Certificate',
    ];
  }

  if (category === 'WORKS' || text.includes('civil') || text.includes('construction') || text.includes('electrical')) {
    return [
      'Class-A / B Government Contractor License',
      'ISO 9001:2015',
      'EPFO & ESIC Registration',
      'GST Registration Certificate',
      'Electrical Contractor License',
    ];
  }

  if (category === 'SERVICES' || text.includes('manpower') || text.includes('security')) {
    return [
      'ISO 9001:2015',
      'PSARA License (for security)',
      'EPFO & ESIC Registration',
      'Labour Department License',
      'GST Registration Certificate',
    ];
  }

  // Default for goods & general procurement
  return [
    'ISO 9001:2015 (Quality Management)',
    'OEM Authorization Certificate',
    'BIS / ISI / CE Certification (as applicable)',
    'GST Registration Certificate',
    'PAN Card',
  ];
}

/**
 * Main Dynamic Enrichment Function for a Tender
 */
export function enrichTenderDetails(tender: RawTender): RawTender {
  const title = tender.title || '';
  const desc = tender.description || '';
  const dept = tender.department || '';
  const org = tender.organization || '';
  const category = tender.category || 'GOODS';
  const sourcePortal = tender.sourcePortal || 'GeM';
  const estimatedValue = tender.estimatedValue && tender.estimatedValue > 0 ? tender.estimatedValue : null;

  // 1. Dynamic Turnover
  let minTurnover = tender.minTurnover;
  if (!minTurnover || minTurnover <= 0) {
    if (estimatedValue) {
      // Standard 30% of estimated value in Indian procurement
      minTurnover = Math.round(estimatedValue * 0.3);
    } else {
      // Sensible baseline according to scope
      const lower = `${title} ${dept}`.toLowerCase();
      if (lower.includes('medical') || lower.includes('hospital') || lower.includes('plant') || lower.includes('systems')) {
        minTurnover = 2500000; // 25 Lakhs
      } else if (category === 'WORKS') {
        minTurnover = 5000000; // 50 Lakhs
      } else {
        minTurnover = 1500000; // 15 Lakhs
      }
    }
  }

  // 2. Dynamic Net Worth
  let minNetWorth = tender.minNetWorth;
  if (!minNetWorth || minNetWorth <= 0) {
    if (estimatedValue) {
      minNetWorth = Math.round(estimatedValue * 0.15); // 15% standard
    } else {
      minNetWorth = Math.round(minTurnover * 0.4); // 40% of min turnover
    }
  }

  // 3. Dynamic Experience
  let minExperience = tender.minExperience;
  if (!minExperience || minExperience <= 0) {
    if (category === 'WORKS') {
      minExperience = 5;
    } else {
      minExperience = 3; // Standard 3 years in Indian public tenders
    }
  }

  // 4. Dynamic Required Certifications
  let requiredCertifications = tender.requiredCertifications || [];
  if (!requiredCertifications || requiredCertifications.length === 0) {
    requiredCertifications = inferCertifications(title, category, dept);
  }

  // 5. Dynamic EMD Amount
  let emdAmount = tender.emdAmount;
  let emdExemptMSME = Boolean(tender.emdExemptMSME ?? true);
  if (!emdAmount || emdAmount <= 0) {
    if (estimatedValue) {
      emdAmount = Math.round(estimatedValue * 0.02); // 2% standard
    } else {
      // For GeM bids with unstated value, standard EMD benchmark
      const lower = `${title} ${dept}`.toLowerCase();
      if (lower.includes('medical') || lower.includes('hospital') || lower.includes('equipment')) {
        emdAmount = 30000; // 30,000 INR
      } else {
        emdAmount = 25000;
      }
    }
  }

  // 6. Dynamic Tender Fee
  // On GeM portal, tender fee is strictly Nil / Free per Govt of India mandate
  let tenderFee = tender.tenderFee;
  if (tenderFee === undefined || tenderFee === null) {
    if (sourcePortal.toLowerCase().includes('gem') || (tender.sourceUrl && tender.sourceUrl.includes('gem.gov.in'))) {
      tenderFee = 0; // Free / Nil
    } else {
      tenderFee = estimatedValue && estimatedValue > 10000000 ? 2500 : 1000;
    }
  }

  // 7. Dynamic Dates: Bid Opening and Pre-bid Meeting
  const deadlineDate = tender.bidSubmissionDeadline ? new Date(tender.bidSubmissionDeadline) : new Date();

  let bidOpeningDate = tender.bidOpeningDate ? new Date(tender.bidOpeningDate) : null;
  if (!bidOpeningDate || isNaN(bidOpeningDate.getTime())) {
    // GeM standard: Bid Opening is 30 minutes after deadline
    bidOpeningDate = new Date(deadlineDate.getTime() + 30 * 60 * 1000);
  }

  let preBidMeetingDate = tender.preBidMeetingDate ? new Date(tender.preBidMeetingDate) : null;
  if (!preBidMeetingDate || isNaN(preBidMeetingDate.getTime())) {
    // Standard pre-bid meeting is scheduled 5-7 days before submission deadline
    const preDate = new Date(deadlineDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    preBidMeetingDate = preDate;
  }

  // 8. Dynamic Work Completion / Contract Period
  let completionPeriod = tender.completionPeriod;
  if (!completionPeriod || completionPeriod === 'Not specified') {
    completionPeriod = inferCompletionPeriod(title, category);
  }

  // 9. Dynamic Organization Type
  let organizationType = tender.organizationType;
  if (!organizationType || organizationType === 'Not specified') {
    organizationType = inferOrganizationType(org, dept);
  }

  // 10. Dynamic District and City
  let district = tender.district;
  let city = tender.city;
  const loc = inferDistrict(title, dept, tender.state || '', org);

  if (!district || district === 'Not specified') {
    district = loc.district;
  }

  if (!city || city === 'Not specified') {
    if (district && district !== 'Not specified') {
      const derived = district.replace(/\s+(District|City|Urban|Suburban|Nagar|Rural)$/i, '').trim();
      city = derived || loc.city;
    } else {
      city = loc.city;
    }
  }

  // Explicitly identify which fields were inferred vs officially sourced
  const inferredFields: string[] = [];
  if (!tender.minTurnover || tender.minTurnover <= 0) inferredFields.push('minTurnover');
  if (!tender.minNetWorth || tender.minNetWorth <= 0) inferredFields.push('minNetWorth');
  if (!tender.minExperience || tender.minExperience <= 0) inferredFields.push('minExperience');
  if (!tender.requiredCertifications || tender.requiredCertifications.length === 0) inferredFields.push('requiredCertifications');
  if (!tender.emdAmount || tender.emdAmount <= 0) inferredFields.push('emdAmount');
  if (tender.tenderFee === undefined || tender.tenderFee === null) inferredFields.push('tenderFee');
  if (!tender.bidOpeningDate) inferredFields.push('bidOpeningDate');
  if (!tender.preBidMeetingDate) inferredFields.push('preBidMeetingDate');
  if (!tender.completionPeriod || tender.completionPeriod === 'Not specified') inferredFields.push('completionPeriod');
  if (!tender.organizationType || tender.organizationType === 'Not specified') inferredFields.push('organizationType');
  if (!tender.district || tender.district === 'Not specified') inferredFields.push('district');
  if (!tender.city || tender.city === 'Not specified') inferredFields.push('city');

  return {
    ...tender,
    minTurnover,
    minNetWorth,
    minExperience,
    requiredCertifications,
    emdAmount,
    emdExemptMSME,
    tenderFee,
    bidOpeningDate,
    preBidMeetingDate,
    completionPeriod,
    organizationType,
    district,
    city,
    inferredFields,
  };
}
