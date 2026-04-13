import { z } from 'zod';

export const analyzeTenderSchema = z.object({
  documentText: z.string().min(1, 'Document text is required').max(100000, 'Document text too long'),
});

export const strategyParamsSchema = z.object({
  tenderId: z.string().min(1),
});

export const analyzeParamsSchema = z.object({
  tenderId: z.string().min(1),
});
