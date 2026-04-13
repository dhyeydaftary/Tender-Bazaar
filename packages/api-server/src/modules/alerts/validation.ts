import { z } from 'zod';

export const createAlertSchema = z.object({
  name: z.string().min(1).max(100),
  keywords: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  minValue: z.number().min(0).optional(),
  maxValue: z.number().min(0).optional(),
  organizations: z.array(z.string()).optional(),
  tenderTypes: z.array(z.string()).optional(),
  frequency: z.enum(['INSTANT', 'DAILY', 'WEEKLY']),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

export const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  keywords: z.array(z.string().min(1)).min(1).optional(),
  categories: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  minValue: z.number().min(0).nullable().optional(),
  maxValue: z.number().min(0).nullable().optional(),
  organizations: z.array(z.string()).optional(),
  tenderTypes: z.array(z.string()).optional(),
  frequency: z.enum(['INSTANT', 'DAILY', 'WEEKLY']).optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

export const toggleAlertSchema = z.object({
  isActive: z.boolean(),
});
