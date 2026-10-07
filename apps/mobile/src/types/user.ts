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
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  gstin?: string;
  pan?: string;
  companyType?: CompanyType;
  registrationNumber?: string;
  incorporationDate?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDocument {
  id: string;
  userId: string;
  name: string;
  type: DocumentType;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  expiryDate?: string;
  isVerified: boolean;
  uploadedAt: string;
}

export type DocumentType =
  | 'PAN_CARD'
  | 'GST_CERTIFICATE'
  | 'MSME_CERTIFICATE'
  | 'ISO_CERTIFICATE'
  | 'INCORPORATION_CERTIFICATE'
  | 'FINANCIAL_STATEMENT'
  | 'EXPERIENCE_CERTIFICATE'
  | 'BID_DOCUMENT'
  | 'OTHER';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  whatsappNotifications: boolean;
  smsNotifications: boolean;
  biometricEnabled: boolean;
}
