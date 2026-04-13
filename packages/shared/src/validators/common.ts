import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string().regex(
  /^[6-9]\d{9}$/,
  'Invalid Indian phone number'
);

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const gstinSchema = z.string().regex(
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  'Invalid GSTIN format'
);

export const panSchema = z.string().regex(
  /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  'Invalid PAN format'
);
