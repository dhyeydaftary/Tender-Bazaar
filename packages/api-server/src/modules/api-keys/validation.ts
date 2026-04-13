import { z } from 'zod';

export const configureWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(
    z.enum(['new_tender_match', 'tender_updated', 'deadline_reminder'])
  ).min(1, 'Select at least one event'),
  active: z.boolean().optional().default(true),
});

export type ConfigureWebhookInput = z.infer<typeof configureWebhookSchema>;
