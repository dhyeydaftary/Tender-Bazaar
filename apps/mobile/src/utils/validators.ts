import { z } from 'zod';

/**
 * Login form schema.
 */
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Registration form schema.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be under 100 characters'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    companyName: z
      .string()
      .min(2, 'Company name must be at least 2 characters')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Alert creation/update schema.
 */
export const alertSchema = z.object({
  name: z
    .string()
    .min(1, 'Alert name is required')
    .max(100, 'Name must be under 100 characters'),
  keywords: z
    .array(z.string().min(1))
    .min(1, 'At least one keyword is required')
    .max(30, 'Maximum 30 keywords allowed'),
  categories: z.array(z.string()).optional().default([]),
  states: z.array(z.string()).optional().default([]),
  minValue: z.number().min(0).optional(),
  maxValue: z.number().min(0).optional(),
  organizations: z.array(z.string()).optional().default([]),
  tenderTypes: z.array(z.string()).optional().default([]),
  frequency: z.enum(['INSTANT', 'DAILY', 'WEEKLY']).default('DAILY'),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
});

export type AlertFormData = z.infer<typeof alertSchema>;

/**
 * Profile update schema.
 */
export const profileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
    .optional()
    .or(z.literal('')),
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .optional()
    .or(z.literal('')),
  gstin: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Invalid GSTIN format',
    )
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
