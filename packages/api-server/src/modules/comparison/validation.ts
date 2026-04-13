import { z } from 'zod';

export const compareTendersSchema = z.object({
  tenderIds: z.array(z.string().min(1)).min(2, 'At least 2 tenders required').max(3, 'Maximum 3 tenders allowed'),
});
