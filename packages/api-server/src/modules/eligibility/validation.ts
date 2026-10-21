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

/**
 * Response contract for POST {AI_SERVICE_URL}/eligibility/check.
 *
 * The AI service's reply used to be consumed as `response.data` and read with
 * `??` defaults, so a malformed or partial payload was persisted and shown as
 * a real analysis — a missing `score` silently became 0, i.e. "not eligible",
 * and a nonsense `criteria` value was stored verbatim.
 *
 * `tenderId` is optional because the service does not have to echo it, but
 * when it does the caller must check it matches the tender that was requested
 * before storing or displaying the result. That is the guard against one
 * tender's analysis being attributed to another.
 */
/** One criterion as the Python engine emits it (a list of these). */
export const aiCriterionItemSchema = z.object({
  criterion: z.string(),
  status: z.enum(['MET', 'NOT_MET', 'PARTIALLY_MET', 'UNCLEAR']),
  detail: z.string(),
  importance: z.enum(['CRITICAL', 'IMPORTANT', 'OPTIONAL']).optional(),
});

/** One criterion as the local rule-based fallback emits it (a keyed object). */
export const fallbackCriterionSchema = z.object({
  met: z.boolean(),
  detail: z.string(),
});

/**
 * Normalise the AI service's naming before validation.
 *
 * The Python model declares `is_eligible`, so it serialises snake_case while
 * every other field is camelCase. The first version of this schema required
 * `isEligible` and therefore rejected every genuine AI response with
 * "isEligible: Required", silently forcing the rule-based fallback. Accepting
 * both spellings keeps the service and any older client compatible.
 */
const normaliseAiEligibilityPayload = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (!('isEligible' in raw) && 'is_eligible' in raw) {
    return { ...raw, isEligible: raw.is_eligible };
  }
  return raw;
};

const aiEligibilityResponseObject = z.object({
  tenderId: z.string().min(1).optional(),
  score: z.number().min(0).max(100),
  isEligible: z.boolean(),
  // The AI service returns an ARRAY of criterion objects; the local fallback
  // returns a keyed RECORD. The first version of this schema only accepted the
  // record, so it rejected every genuine AI response and silently forced the
  // fallback — the exact failure mode this schema exists to prevent.
  criteria: z.union([z.array(aiCriterionItemSchema), z.record(fallbackCriterionSchema)]),
  suggestions: z.array(z.string()).default([]),
  summary: z.string().optional(),

  // ---- Provenance ------------------------------------------------------
  // Reported by the service so the caller never has to infer LLM success from
  // an HTTP 200. Defaults are conservative: absent provenance is treated as
  // "no LLM analysis happened", never as success.
  ruleChecksCompleted: z.boolean().default(true),
  llmAnalysed: z.boolean().default(false),
  llmStatus: z
    .enum(['SUCCESS', 'FAILED', 'TIMED_OUT', 'UNAVAILABLE', 'SKIPPED_NO_TEXT'])
    .default('UNAVAILABLE'),
  /** Human-readable reason when the LLM stage did not succeed. Never a secret. */
  llmError: z.string().nullable().optional(),
  /** Optional supporting evidence; must not be invented by the caller. */
  sources: z
    .array(
      z.object({
        field: z.string(),
        excerpt: z.string(),
        document: z.string().optional(),
      }),
    )
    .optional(),
});

export const aiEligibilityResponseSchema = z.preprocess(
  normaliseAiEligibilityPayload,
  aiEligibilityResponseObject,
);

export type AiEligibilityResponse = z.infer<typeof aiEligibilityResponseObject>;
