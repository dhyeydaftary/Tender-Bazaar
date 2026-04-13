import { z } from 'zod';

export const processCorrigendumSchema = z.object({
  changes: z.record(z.string(), z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'At least one change is required' }
  ),
});

export const corrigendumTenderIdSchema = z.object({
  tenderId: z.string().min(1),
});
