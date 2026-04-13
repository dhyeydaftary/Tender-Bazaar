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
  publishedDate: Date;
  bidSubmissionDeadline: Date;
  bidOpeningDate?: Date;
  preBidMeetingDate?: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface TenderSearchFilters {
  query?: string;
  categories?: TenderCategory[];
  states?: string[];
  tenderTypes?: TenderType[];
  status?: TenderStatus[];
  organizations?: string[];
  sourcePortals?: string[];
  minValue?: number;
  maxValue?: number;
  publishedFrom?: Date;
  publishedTo?: Date;
  deadlineFrom?: Date;
  deadlineTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'publishedDate' | 'estimatedValue' | 'bidSubmissionDeadline' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface TenderSearchResult {
  tenders: Tender[];
  total: number;
  page: number;
  limit: number;
  aggregations: {
    categories: Record<string, number>;
    states: Record<string, number>;
    valueRanges: Record<string, number>;
    organizations: Record<string, number>;
  };
}
