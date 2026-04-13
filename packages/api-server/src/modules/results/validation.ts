import { z } from 'zod';

export const searchResultsSchema = z.object({
  query: z.string().optional(),
  organization: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  winnerName: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const tenderIdParamSchema = z.object({
  tenderId: z.string().min(1),
});

export const companyNameParamSchema = z.object({
  companyName: z.string().min(1),
});
