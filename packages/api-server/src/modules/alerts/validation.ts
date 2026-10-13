import { z } from 'zod';
import { TenderCategory } from '@prisma/client';

/**
 * The categories an alert can match on.
 *
 * Derived from the Prisma `TenderCategory` enum rather than hard-coded, so this
 * list cannot drift from the column it is compared against: `Tender.category`
 * is that enum, while `Alert.categories` is a free-form `String[]`, which is
 * how unsupported values came to be storable in the first place.
 */
export const SUPPORTED_ALERT_CATEGORIES: string[] = Object.values(TenderCategory);

/**
 * Canonicalise one category, case-insensitively: 'works' and 'Works' both
 * become 'WORKS'. Returns null for anything outside the supported set.
 */
export function canonicaliseAlertCategory(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return SUPPORTED_ALERT_CATEGORIES.includes(upper) ? upper : null;
}

/**
 * The supported subset of a category list, de-duplicated and canonicalised.
 *
 * Used on BOTH paths, but for different reasons:
 *   - writes: to decide whether a category counts as a real filter;
 *   - reads/matching: to tolerate legacy rows that contain values which were
 *     storable before this validation existed. Reads never throw on them —
 *     unsupported values are simply ignored.
 */
export function supportedAlertCategories(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];

  const supported: string[] = [];
  for (const value of values) {
    const canonical = canonicaliseAlertCategory(value);
    if (canonical && !supported.includes(canonical)) supported.push(canonical);
  }
  return supported;
}

/**
 * A category on a NEW write. Accepts any casing and normalises to the canonical
 * uppercase form, so the UI's 'Works' and a hand-rolled 'works' both store as
 * 'WORKS'. Unsupported values are rejected with a message naming what is
 * allowed, instead of being stored and then silently ignored by the matcher —
 * which previously left the alert with no effective category filter.
 */
const alertCategorySchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => SUPPORTED_ALERT_CATEGORIES.includes(value), {
    message: `category must be one of: ${SUPPORTED_ALERT_CATEGORIES.join(', ')}`,
  });

/**
 * Keywords are OPTIONAL and default to an empty array: an alert may filter on
 * category/state/value alone, which is a flow the create dialog offers (it
 * names such an alert after its category). `buildTenderWhereClause` only adds
 * the keyword clause when `keywords.length > 0`, so a keyword-less alert is a
 * well-defined category filter rather than a broken one.
 *
 * Individual keywords, however, must be non-empty after trimming. A `''` or
 * '   ' entry becomes `title: { contains: '' }`, which matches EVERY tender and
 * silently converts the alert into a notify-on-everything subscription. The
 * create dialog already trims and discards blank input, so nothing legitimate
 * sends one.
 */
const keywordSchema = z.string().trim().min(1, 'keywords must not be blank');

/**
 * The filter fields an alert can match on. Mirrors every branch of
 * `buildTenderWhereClause` in ./service.ts — if a filter is added there, it
 * belongs here too, or an alert using only that filter would be rejected.
 */
export interface AlertFilterCriteria {
  keywords?: string[] | null;
  categories?: string[] | null;
  states?: string[] | null;
  organizations?: string[] | null;
  tenderTypes?: string[] | null;
  minValue?: number | null;
  maxValue?: number | null;
}

/**
 * True when an alert narrows the tender set at all.
 *
 * `buildTenderWhereClause` starts from `{ status: 'ACTIVE' }` and adds a clause
 * per non-empty filter. An alert with every filter absent or empty therefore
 * produces a where-clause that matches EVERY active tender, so the user is
 * notified about the entire catalogue on every run. Any single filter is
 * enough — category-only, keyword-only, state-only and value-range-only alerts
 * are all legitimate and must keep working.
 */
export function hasAlertFilterCriteria(criteria: AlertFilterCriteria): boolean {
  const filled = (value?: string[] | null) => Array.isArray(value) && value.length > 0;

  return (
    filled(criteria.keywords) ||
    // Only SUPPORTED categories narrow anything. `categories: ['BOGUS']` is
    // dropped by the matcher, so counting it as a filter would let an alert
    // pass this check and still match every active tender.
    supportedAlertCategories(criteria.categories).length > 0 ||
    filled(criteria.states) ||
    filled(criteria.organizations) ||
    filled(criteria.tenderTypes) ||
    criteria.minValue != null ||
    criteria.maxValue != null
  );
}

/** Shared wording so the create and update paths report this identically. */
export const ALERT_NO_FILTER_MESSAGE =
  'An alert needs at least one filter: keywords, category, state, organization, ' +
  'tender type, or a minimum/maximum value. Without one it would match every active tender.';

export const createAlertSchema = z
  .object({
    name: z.string().min(1).max(100),
    keywords: z.array(keywordSchema).optional().default([]),
    categories: z.array(alertCategorySchema).optional().default([]),
    states: z.array(z.string()).optional().default([]),
    minValue: z.number().min(0).optional(),
    maxValue: z.number().min(0).optional(),
    organizations: z.array(z.string()).optional(),
    tenderTypes: z.array(z.string()).optional(),
    frequency: z.enum(['INSTANT', 'DAILY', 'WEEKLY']),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
  })
  // Cross-field: at least one filter must be present. Reported on a synthetic
  // `filters` path so the 400 VALIDATION_ERROR details name the problem rather
  // than blaming one arbitrary field (no single field is at fault).
  .superRefine((data, ctx) => {
    if (!hasAlertFilterCriteria(data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filters'],
        message: ALERT_NO_FILTER_MESSAGE,
      });
    }
  });

export const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  // Optional on update (omit to leave unchanged), but an empty array is still
  // allowed so a user can strip keywords and keep a category-only alert.
  keywords: z.array(keywordSchema).optional(),
  // Same canonicalisation and whitelist as create: an update must not be a way
  // to introduce an unsupported category that create would have rejected.
  categories: z.array(alertCategorySchema).optional(),
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
