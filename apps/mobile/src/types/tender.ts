export enum TenderType {
  OPEN = 'OPEN',
  LIMITED = 'LIMITED',
  SINGLE = 'SINGLE',
  TWO_PACKET = 'TWO_PACKET',
  EOI = 'EOI',
  AUCTION = 'AUCTION',
  RFP = 'RFP',
  RFQ = 'RFQ',
}

export enum TenderCategory {
  WORKS = 'WORKS',
  GOODS = 'GOODS',
  SERVICES = 'SERVICES',
  CONSULTANCY = 'CONSULTANCY',
}

export enum TenderStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED',
  CORRIGENDUM = 'CORRIGENDUM',
}

export interface Tender {
  id: string;
  title: string;
  description?: string;
  referenceNumber: string;
  organization: string;
  department?: string;
  tenderType: TenderType;
  category: TenderCategory;
  status: TenderStatus;
  state: string;
  district?: string;
  city?: string;
  estimatedValue?: number;
  emdAmount?: number;
  publishedDate: string;
  bidSubmissionDeadline: string;
  bidOpeningDate?: string;
  preBidMeetingDate?: string;
  sourcePortal: string;
  sourceUrl: string;
  sourceId: string;
  aiSummary?: string;
  aiKeywords: string[];
  aiEligibilityText?: string;
  minTurnover?: number;
  minNetWorth?: number;
  minExperience?: number;
  requiredCertifications: string[];
  reservedForMSME: boolean;
  reservedForStartups: boolean;
  emdExemptMSME: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenderDetail extends Tender {
  documents: TenderDocument[];
  corrigendums: Corrigendum[];
  isSaved: boolean;
  eligibilityScore?: number;
}

export interface TenderDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Corrigendum {
  id: string;
  title: string;
  description: string;
  publishedDate: string;
  documentUrl?: string;
}

export interface TenderSearchParams {
  query?: string;
  categories?: TenderCategory[];
  states?: string[];
  tenderTypes?: TenderType[];
  status?: TenderStatus[];
  organizations?: string[];
  sourcePortals?: string[];
  minValue?: number;
  maxValue?: number;
  publishedFrom?: string;
  publishedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'publishedDate' | 'estimatedValue' | 'bidSubmissionDeadline' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface Category {
  value: TenderCategory;
  label: string;
  color: string;
  icon: string;
  count?: number;
}
