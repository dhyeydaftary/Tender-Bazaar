import { z } from 'zod';

export const searchTendersSchema = z.object({
  query: z.string().optional(),
  categories: z.string().transform(s => s.split(',')).optional(),
  states: z.string().transform(s => s.split(',')).optional(),
  tenderTypes: z.string().transform(s => s.split(',')).optional(),
  status: z.string().transform(s => s.split(',')).optional(),
  organizations: z.string().transform(s => s.split(',')).optional(),
  sourcePortals: z.string().transform(s => s.split(',')).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  publishedFrom: z.string().optional(),
  publishedTo: z.string().optional(),
  deadlineFrom: z.string().optional(),
  deadlineTo: z.string().optional(),
  reservedForMSME: z.coerce.boolean().optional(),
  reservedForStartups: z.coerce.boolean().optional(),
  emdExemptMSME: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['publishedDate', 'estimatedValue', 'bidSubmissionDeadline', 'relevance']).default('publishedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Pagination for the home-page tender lists (recommended, expiring soon). */
export const tenderListPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const tenderIdSchema = z.object({
  id: z.string().min(1),
});
