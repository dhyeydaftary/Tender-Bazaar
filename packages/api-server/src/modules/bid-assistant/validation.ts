import { z } from 'zod';

export const analyzeTenderSchema = z.object({
  tenderId: z.string().optional(),
  documentText: z.string().max(100000).optional(),
});

export const strategyParamsSchema = z.object({
  tenderId: z.string().min(1),
});

export const analyzeParamsSchema = z.object({
  tenderId: z.string().optional(),
});
