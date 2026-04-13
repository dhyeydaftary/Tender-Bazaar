import { z } from 'zod';

// ─── Document Types ─────────────────────────────────────

export const DocumentType = z.enum([
  'PAN_CARD',
  'GST_CERTIFICATE',
  'MSME_CERTIFICATE',
  'BALANCE_SHEET',
  'BANK_STATEMENT',
  'EXPERIENCE_CERTIFICATE',
  'ISO_CERTIFICATE',
  'OTHER',
]);

export type DocumentTypeEnum = z.infer<typeof DocumentType>;

// ─── Update Profile ─────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  phone: z
    .string()
    .regex(
      /^(\+91[\-\s]?)?[6-9]\d{9}$/,
      'Please enter a valid Indian phone number (e.g., +91 9876543210)',
    )
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Company Type Enum ──────────────────────────────────

const CompanyTypeEnum = z.enum([
  'PVT_LTD',
  'LLP',
  'PROPRIETORSHIP',
  'PARTNERSHIP',
  'SOCIETY',
  'TRUST',
  'GOVERNMENT',
]);

const MSMECategoryEnum = z.enum(['MICRO', 'SMALL', 'MEDIUM']);

// ─── Update Company Profile ─────────────────────────────

export const updateCompanyProfileSchema = z.object({
  // Basic company info
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be at most 200 characters'),
  gstin: z
    .string()
    .regex(
      /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/,
      'Please enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)',
    )
    .optional()
    .nullable(),
  pan: z
    .string()
    .regex(
      /^[A-Z]{5}\d{4}[A-Z]{1}$/,
      'Please enter a valid PAN (e.g., ABCDE1234F)',
    )
    .optional()
    .nullable(),
  companyType: CompanyTypeEnum.optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  incorporationDate: z
    .string()
    .datetime({ message: 'Please provide a valid ISO date' })
    .optional()
    .nullable(),

  // Financial info
  annualTurnover: z
    .number()
    .min(0, 'Annual turnover cannot be negative')
    .optional()
    .nullable(),
  netWorth: z
    .number()
    .min(0, 'Net worth cannot be negative')
    .optional()
    .nullable(),
  employeeCount: z
    .number()
    .int('Employee count must be a whole number')
    .min(0, 'Employee count cannot be negative')
    .optional()
    .nullable(),
  yearsInBusiness: z
    .number()
    .int('Years in business must be a whole number')
    .min(0, 'Years in business cannot be negative')
    .optional()
    .nullable(),

  // MSME details
  msmeRegistered: z.boolean().optional(),
  msmeNumber: z.string().max(50).optional().nullable(),
  msmeCategory: MSMECategoryEnum.optional().nullable(),

  // Certifications & registrations
  isoRegistered: z.boolean().optional(),
  isoCertificates: z.array(z.string().max(100)).optional(),

  startupDpiit: z.boolean().optional(),
  gemRegistered: z.boolean().optional(),
  epfRegistered: z.boolean().optional(),
  gstRegistered: z.boolean().optional(),

  // Capabilities
  workCategories: z.array(z.string().max(100)).optional(),
  specializations: z.array(z.string().max(100)).optional(),
  statesOperated: z.array(z.string().max(50)).optional(),
  pastProjectValues: z.array(z.number().min(0)).optional(),
  maxProjectCapacity: z
    .number()
    .min(0, 'Max project capacity cannot be negative')
    .optional()
    .nullable(),
});

export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;

// ─── Document Upload ────────────────────────────────────

export const documentUploadSchema = z.object({
  type: DocumentType,
  name: z.string().min(1, 'Document name is required').max(200).optional(),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
