import { z } from 'zod';

export const checkEligibilitySchema = z.object({
  tenderId: z.string().min(1),
});

export const bulkEligibilitySchema = z.object({
  tenderIds: z.array(z.string().min(1)).min(1).max(10),
});

export const eligibilityHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
