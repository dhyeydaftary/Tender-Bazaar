import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as profileApi from '../services/api/profile';
import type {
  UpdateProfileData,
  UpdateCompanyProfileData,
  ProfileWithCompany,
} from '../services/api/profile';

// ─── Query Key Factory ─────────────────────────────────────────────────────

export const profileKeys = {
  all: ['profile'] as const,
  detail: () => [...profileKeys.all, 'detail'] as const,
  completion: () => [...profileKeys.all, 'completion'] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's full profile including company and documents.
 * Stale time is 5 minutes — profile data changes infrequently.
 */
export function useProfile() {
  return useQuery({
    queryKey: profileKeys.detail(),
    queryFn: async () => {
      const res = await profileApi.getProfile();
      return res.data!;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Update the user's basic profile fields (name, phone, avatarUrl).
 * Invalidates the profile query on success so the UI refreshes.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      profileApi.updateProfile(data).then((res) => res.data!),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Update the company profile fields.
 * Invalidates the profile query on success so derived data (completion %)
 * is recalculated.
 */
export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCompanyProfileData) =>
      profileApi.updateCompanyProfile(data).then((res) => res.data!),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Upload a company document via multipart form data.
 * Invalidates the profile query on success so the document list updates.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      profileApi.uploadDocument(formData).then((res) => res.data!),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Calculate profile completion percentage from profile data.
 *
 * Weight breakdown:
 *   name             10%
 *   email            10%
 *   phone            10%
 *   avatar           10%
 *   company basic    20%  (companyName, companyType, registrationNumber,
 *                          incorporationDate)
 *   company regs     15%  (gstin, pan, msmeRegistered, gstRegistered)
 *   company caps     15%  (workCategories, specializations, statesOperated)
 *   documents        10%  (at least 3 documents uploaded)
 *
 * Depends on the same profile query so it shares its cache.
 */
export function useProfileCompletion() {
  return useQuery({
    queryKey: profileKeys.completion(),
    queryFn: async (): Promise<{
      percentage: number;
      sections: {
        name: string;
        weight: number;
        completed: boolean;
      }[];
    }> => {
      const res = await profileApi.getProfile();
      const data = res.data!;
      const { user, company, documents } = data;

      const sections: {
        name: string;
        weight: number;
        completed: boolean;
      }[] = [
        {
          name: 'Name',
          weight: 10,
          completed: !!user.name && user.name.trim().length > 0,
        },
        {
          name: 'Email',
          weight: 10,
          completed: !!user.email && user.email.trim().length > 0,
        },
        {
          name: 'Phone',
          weight: 10,
          completed: !!user.phone && user.phone.trim().length > 0,
        },
        {
          name: 'Avatar',
          weight: 10,
          completed: !!user.avatarUrl,
        },
        {
          name: 'Company Basic',
          weight: 20,
          completed: !!(
            company &&
            company.companyName &&
            company.companyType &&
            company.registrationNumber &&
            company.incorporationDate
          ),
        },
        {
          name: 'Company Registrations',
          weight: 15,
          completed: !!(
            company &&
            company.gstin &&
            company.pan &&
            company.msmeRegistered !== undefined &&
            company.gstRegistered !== undefined
          ),
        },
        {
          name: 'Company Capabilities',
          weight: 15,
          completed: !!(
            company &&
            company.workCategories &&
            company.workCategories.length > 0 &&
            company.specializations &&
            company.specializations.length > 0 &&
            company.statesOperated &&
            company.statesOperated.length > 0
          ),
        },
        {
          name: 'Documents',
          weight: 10,
          completed: documents && documents.length >= 3,
        },
      ];

      const percentage = sections.reduce(
        (total, section) => total + (section.completed ? section.weight : 0),
        0,
      );

      return { percentage, sections };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
