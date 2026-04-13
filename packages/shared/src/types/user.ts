export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum CompanyType {
  PVT_LTD = 'PVT_LTD',
  LLP = 'LLP',
  PROPRIETORSHIP = 'PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  SOCIETY = 'SOCIETY',
  TRUST = 'TRUST',
  GOVERNMENT = 'GOVERNMENT',
}

export enum MSMECategory {
  MICRO = 'MICRO',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  gstin?: string;
  pan?: string;
  companyType?: CompanyType;
  registrationNumber?: string;
  incorporationDate?: Date;
  annualTurnover?: number;
  netWorth?: number;
  employeeCount?: number;
  yearsInBusiness?: number;
  msmeRegistered: boolean;
  msmeNumber?: string;
  msmeCategory?: MSMECategory;
  isoRegistered: boolean;
  isoCertificates: string[];
  startupDpiit: boolean;
  gemRegistered: boolean;
  epfRegistered: boolean;
  gstRegistered: boolean;
  workCategories: string[];
  specializations: string[];
  statesOperated: string[];
  pastProjectValues: number[];
  maxProjectCapacity?: number;
  createdAt: Date;
  updatedAt: Date;
}
