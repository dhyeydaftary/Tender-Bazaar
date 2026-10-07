import apiClient, { apiRequest } from './client';
import type { ApiResponse } from '@/types/api';
import type { User, CompanyProfile, CompanyDocument } from '@/types/user';

// ─── Request Types ──────────────────────────────────────────────────────────

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UpdateCompanyProfileData {
  companyName?: string;
  gstin?: string;
  pan?: string;
  companyType?: string;
  registrationNumber?: string;
  incorporationDate?: string;
  annualTurnover?: number;
  netWorth?: number;
  employeeCount?: number;
  yearsInBusiness?: number;
  msmeRegistered?: boolean;
  msmeNumber?: string;
  msmeCategory?: string;
  isoRegistered?: boolean;
  isoCertificates?: string[];
  startupDpiit?: boolean;
  gemRegistered?: boolean;
  epfRegistered?: boolean;
  gstRegistered?: boolean;
  workCategories?: string[];
  specializations?: string[];
  statesOperated?: string[];
  pastProjectValues?: number[];
  maxProjectCapacity?: number;
}

export interface ProfileWithCompany {
  user: User;
  company?: CompanyProfile;
  documents: CompanyDocument[];
}

// ─── API Calls ──────────────────────────────────────────────────────────────

export function getProfile(): Promise<ApiResponse<ProfileWithCompany>> {
  return apiRequest(apiClient.get('/profile'));
}

export function updateProfile(
  data: UpdateProfileData,
): Promise<ApiResponse<User>> {
  return apiRequest(apiClient.put('/profile', data));
}

export function updateCompanyProfile(
  data: UpdateCompanyProfileData,
): Promise<ApiResponse<CompanyProfile>> {
  return apiRequest(apiClient.put('/profile/company', data));
}

export function uploadDocument(
  formData: FormData,
): Promise<ApiResponse<CompanyDocument>> {
  return apiRequest(
    apiClient.post('/profile/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}
