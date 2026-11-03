import axios from 'axios';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { env } from '../../config/env';
import { aiServiceHeaders } from '../../config/ai-service';
import { planConfigService } from '../subscriptions/plan-config.service';
import { aiEligibilityResponseSchema } from './validation';
import { openForBiddingWhere } from '../tenders/status-groups';

async function getUserPlanSlug(userId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    return 'free';
  }

  return subscription.plan.slug;
}

/**
 * Enforce the plan's AI check allowance.
 *
 * Limits and usage come from planConfigService — the plan's `maxAiChecks` and
 * the subscription counters — exactly what the requireAiCheck middleware
 * enforces and GET /subscription/usage reports to the AI Checks card. This
 * module used to keep its own hardcoded limits (Starter 5 while the plan said
 * 10) and a Redis counter nothing else read, so the card always showed 0 used
 * against a limit that was not the one enforced. Checked here as well as in the
 * middleware because bulk checks run several checks behind one request.
 */
async function checkPlanLimit(userId: string): Promise<void> {
  const { allowed } = await planConfigService.checkLimit(userId, 'maxAiChecks');
  if (!allowed) {
    throw new AppError(
      'AI eligibility check limit reached for your plan. Upgrade your plan.',
      403,
      'PLAN_LIMIT_EXCEEDED'
    );
  }
}

function basicFallbackCheck(
  companyProfile: any,
  tender: any
): { score: number; isEligible: boolean; criteria: any; suggestions: string[] } {
  let score = 0;
  const criteria: Record<string, { met: boolean; detail: string }> = {};
  const suggestions: string[] = [];

  // Category match
  const categoryMatch = companyProfile.workCategories.some(
    (cat: string) => cat.toLowerCase() === tender.category?.toLowerCase()
  );
  criteria.categoryMatch = { met: categoryMatch, detail: categoryMatch ? 'Category matches' : 'Category does not match' };
  if (categoryMatch) score += 25;
  else suggestions.push('Consider expanding your work categories to match this tender.');

  // State match
  const stateMatch = companyProfile.statesOperated.some(
    (s: string) => s.toLowerCase() === tender.state?.toLowerCase()
  );
  criteria.stateMatch = { met: stateMatch, detail: stateMatch ? 'Operates in tender state' : 'Does not operate in tender state' };
  if (stateMatch) score += 25;
  else suggestions.push('Register your operations in this state.');

  // MSME match
  if (tender.reservedForMSME) {
    const msmeMet = companyProfile.msmeRegistered;
    criteria.msmeReservation = { met: msmeMet, detail: msmeMet ? 'MSME registered' : 'MSME registration required' };
    if (msmeMet) score += 25;
    else suggestions.push('This tender is reserved for MSMEs. Get MSME registration.');
  } else {
    score += 25;
    criteria.msmeReservation = { met: true, detail: 'No MSME reservation' };
  }

  // Startup reservation
  if (tender.reservedForStartups) {
    const startupMet = companyProfile.startupDpiit;
    criteria.startupReservation = { met: startupMet, detail: startupMet ? 'DPIIT registered startup' : 'DPIIT startup registration required' };
    if (!startupMet) suggestions.push('This tender is reserved for startups. Get DPIIT recognition.');
  }

  // Basic capacity check
  if (tender.estimatedValue && companyProfile.maxProjectCapacity) {
    const capacityMet = companyProfile.maxProjectCapacity >= tender.estimatedValue;
    criteria.capacityCheck = { met: capacityMet, detail: capacityMet ? 'Within capacity' : 'Exceeds project capacity' };
    if (capacityMet) score += 25;
    else suggestions.push('Tender value exceeds your declared project capacity.');
  } else {
    score += 25;
    criteria.capacityCheck = { met: true, detail: 'No capacity requirement specified' };
  }

  // Normalize score to 0-100
  score = Math.min(score, 100);
  const isEligible = score >= 50;

  return { score, isEligible, criteria, suggestions };
}

/**
 * One criterion as the dashboard renders it.
 *
 * A type alias rather than an interface: these are written to a Prisma `Json`
 * column, and only type aliases pick up the implicit index signature that
 * Prisma's `InputJsonValue` requires.
 */
export type NormalisedCriterion = {
  name: string;
  status: 'pass' | 'partial' | 'fail';
  detail: string;
  importance?: string;
};

/**
 * Collapse the two criteria shapes the response schema permits into the single
 * array the dashboard renders.
 *
 * The AI service emits an ARRAY of { criterion, status: MET | NOT_MET |
 * PARTIALLY_MET | UNCLEAR, detail, importance }. The local rule-based fallback
 * (`basicFallbackCheck`) emits a keyed RECORD of { met, detail }. Passing
 * either through untouched would hand the UI a shape it cannot render — the
 * record form in particular has no status field at all — so both are mapped
 * here. Anything unrecognised degrades to 'fail' rather than being presented
 * as a pass.
 *
 * Exported for direct testing: `checkEligibility` itself needs a database and
 * a live AI service, so this is where the merged normalisation is covered.
 */
export function normaliseEligibilityCriteria(rawCriteria: unknown): NormalisedCriterion[] {
  const toStatus = (rawStatus: string, met?: unknown): 'pass' | 'partial' | 'fail' => {
    if (rawStatus === 'MET' || rawStatus === 'PASS' || met === true) return 'pass';
    if (rawStatus === 'PARTIALLY_MET' || rawStatus === 'PARTIAL') return 'partial';
    return 'fail';
  };

  const detailFor = (detail: unknown, status: 'pass' | 'partial' | 'fail') =>
    (detail as string) || (status === 'pass' ? 'Requirement satisfied' : 'Requirement not met');

  if (Array.isArray(rawCriteria)) {
    return rawCriteria.map((c: any) => {
      const status = toStatus((c.status || '').toString().toUpperCase(), c.met);
      return {
        name: c.name || c.criterion || 'Criterion',
        status,
        detail: detailFor(c.detail, status),
        importance: c.importance || 'IMPORTANT',
      };
    });
  }

  if (rawCriteria && typeof rawCriteria === 'object') {
    return Object.entries(rawCriteria as Record<string, any>).map(([key, val]) => {
      const status = toStatus(
        (val.status || (val.met ? 'MET' : 'NOT_MET')).toString().toUpperCase(),
        val.met,
      );
      return {
        name: val.name || val.criterion || key,
        status,
        detail: detailFor(val.detail, status),
        importance: val.importance || 'IMPORTANT',
      };
    });
  }

  return [];
}

/**
 * Whether a model actually analysed this tender.
 *
 * `isFallback` only said whether THIS server reached the AI service. When the
 * service answered 200 but its own LLM call had failed, isFallback was false
 * and the result looked like completed AI analysis. `llmAnalysed` is true only
 * when the service positively reported SUCCESS, so absent or partial
 * provenance is treated as "no LLM analysis", never as success.
 */
export function deriveLlmProvenance(aiResult: {
  llmStatus?: unknown;
  llmAnalysed?: unknown;
}): { llmStatus: string; llmAnalysed: boolean } {
  const llmStatus = (aiResult.llmStatus as string) ?? 'UNAVAILABLE';
  return { llmStatus, llmAnalysed: aiResult.llmAnalysed === true && llmStatus === 'SUCCESS' };
}

export const eligibilityService = {
  async checkEligibility(userId: string, tenderId: string) {
    // Fetch company profile, or auto-provision if not yet created
    let companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
      include: { documents: true },
    });

    if (!companyProfile) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const companyName = user?.name ? `${user.name} Infrastructure Pvt Ltd` : 'My Enterprise';
      companyProfile = await prisma.companyProfile.create({
        data: {
          userId,
          companyName,
          companyType: 'PVT_LTD',
          annualTurnover: 500000000,
          netWorth: 150000000,
          employeeCount: 100,
          yearsInBusiness: 8,
          msmeRegistered: true,
          msmeCategory: 'MEDIUM',
          isoRegistered: true,
          isoCertificates: ['ISO 9001:2015', 'ISO 14001:2015'],
          startupDpiit: true,
          gemRegistered: true,
          epfRegistered: true,
          gstRegistered: true,
          workCategories: ['WORKS', 'GOODS', 'SERVICES', 'Construction', 'Civil', 'Electrical'],
          specializations: ['Civil Construction', 'Commercial Buildings', 'Parking Structures', 'Infrastructure'],
          statesOperated: ['Delhi', 'Maharashtra', 'Gujarat', 'Uttar Pradesh', 'All India'],
          pastProjectValues: [250000000, 450000000],
          maxProjectCapacity: 1000000000,
        },
        include: { documents: true },
      });
    }

    // Fetch tender
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Check plan limits
    await checkPlanLimit(userId);

    let aiResult: any = null;

    try {
      // Call Python AI service
      const response = await axios.post(
        `${env.AI_SERVICE_URL}/eligibility/check`,
        {
          company: {
            companyName: companyProfile.companyName,
            companyType: companyProfile.companyType,
            gstin: companyProfile.gstin,
            pan: companyProfile.pan,
            annualTurnover: companyProfile.annualTurnover,
            netWorth: companyProfile.netWorth,
            employeeCount: companyProfile.employeeCount,
            yearsInBusiness: companyProfile.yearsInBusiness,
            msmeRegistered: companyProfile.msmeRegistered,
            msmeCategory: companyProfile.msmeCategory,
            isoRegistered: companyProfile.isoRegistered,
            isoCertificates: companyProfile.isoCertificates,
            startupDpiit: companyProfile.startupDpiit,
            gemRegistered: companyProfile.gemRegistered,
            epfRegistered: companyProfile.epfRegistered,
            gstRegistered: companyProfile.gstRegistered,
            workCategories: companyProfile.workCategories,
            specializations: companyProfile.specializations,
            statesOperated: companyProfile.statesOperated,
            pastProjectValues: companyProfile.pastProjectValues,
            maxProjectCapacity: companyProfile.maxProjectCapacity,
          },
          tender: {
            id: tender.id,
            title: tender.title,
            description: tender.description,
            organization: tender.organization,
            department: tender.department,
            category: tender.category,
            tenderType: tender.tenderType,
            state: tender.state,
            estimatedValue: tender.estimatedValue,
            emdAmount: tender.emdAmount,
            minTurnover: tender.minTurnover,
            minNetWorth: tender.minNetWorth,
            minExperience: tender.minExperience,
            requiredCertifications: tender.requiredCertifications,
            reservedForMSME: tender.reservedForMSME,
            reservedForStartups: tender.reservedForStartups,
            emdExemptMSME: tender.emdExemptMSME,
            // The AI service's TenderInfo model calls this `eligibilityText`.
            // Sending it as `aiEligibilityText` meant Pydantic silently dropped
            // it, so the engine's LLM stage — which is gated on this field being
            // present — was skipped even when the tender had eligibility text.
            eligibilityText: tender.aiEligibilityText,
          },
        },
        { timeout: 30000, headers: aiServiceHeaders() }
      );

      // Validate the model service's reply against a schema instead of
      // trusting it. An unparseable or partial payload must not be persisted
      // as a real analysis — previously a missing `score` became 0, which
      // reads to the user as "not eligible".
      const parsed = aiEligibilityResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(
          `AI eligibility response failed validation: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        );
      }

      // Identity check: if the service echoes a tender id it must be the one
      // we asked about. This is what stops a mismatched or cross-wired
      // response being stored against the wrong tender.
      if (parsed.data.tenderId && parsed.data.tenderId !== tender.id) {
        throw new Error(
          `AI eligibility response is for a different tender (expected ${tender.id}, got ${parsed.data.tenderId})`,
        );
      }

      aiResult = parsed.data;
    } catch (error) {
      // AI service unavailable, malformed, or answering about another tender.
      // Fall back to the deterministic rule-based check and mark it, so the
      // result is never presented as AI analysis it is not.
      console.warn('AI eligibility unavailable or rejected, using rule-based fallback:', (error as any)?.message);
      aiResult = basicFallbackCheck(companyProfile, tender);
      aiResult._fallback = true;
      // The AI service was never reached (or its reply was rejected), so no
      // LLM stage ran. Recorded explicitly rather than left to inference.
      aiResult.llmAnalysed = false;
      aiResult.llmStatus = 'UNAVAILABLE';
      aiResult.llmError = 'The analysis service could not be reached.';
      aiResult.ruleChecksCompleted = true;
    }

    // The response schema accepts criteria as EITHER an array of
    // { criterion, status } (the Python engine) OR a keyed record of
    // { met, detail } (the local rule-based fallback), and `is_eligible` is
    // already mapped to `isEligible` by its preprocess step. Both criteria
    // shapes are normalised to the single { name, status, detail } array the
    // dashboard renders (see normaliseEligibilityCriteria).
    const score = typeof aiResult.score === 'number' ? aiResult.score : 0;
    const isEligible = aiResult.isEligible ?? score >= 50;
    const suggestions = Array.isArray(aiResult.suggestions) ? aiResult.suggestions : [];
    const normalizedCriteria = normaliseEligibilityCriteria(aiResult.criteria);

    // Upsert eligibility check record
    const eligibilityCheck = await prisma.eligibilityCheck.upsert({
      where: {
        userId_tenderId: { userId, tenderId },
      },
      update: {
        score,
        isEligible,
        criteria: normalizedCriteria,
        suggestions,
        updatedAt: new Date(),
      },
      create: {
        userId,
        tenderId,
        score,
        isEligible,
        criteria: normalizedCriteria,
        suggestions,
      },
    });

    // Count the check against the plan (the counter the usage API reads)
    await planConfigService.incrementUsage(userId, 'maxAiChecks');

    // Provenance, forwarded from the service rather than inferred here.
    //
    // `isFallback` alone was misleading: it only said whether THIS server
    // reached the AI service. When the service answered 200 but its own LLM
    // call had failed (an invalid key, for instance), isFallback was false and
    // the result looked like a completed AI analysis. `llmAnalysed` is the
    // field that actually answers "did a model analyse this tender", and it is
    // true only when the service reported SUCCESS.
    const { llmStatus, llmAnalysed } = deriveLlmProvenance(aiResult);

    const checkResult = {
      score,
      isEligible,
      criteria: normalizedCriteria,
      suggestions,
      summary: aiResult.summary || `Eligibility score: ${score}/100. ${isEligible ? 'Company appears eligible for this tender.' : 'Company may not meet all requirements.'}`,
      isFallback: aiResult._fallback ?? false,
    };

    return {
      ...checkResult,
      eligibilityCheck,
      result: {
        // score, isEligible, criteria, suggestions, summary and isFallback.
        // isFallback is kept for existing clients: it is true when this server
        // fell back locally, which is narrower than `llmAnalysed` below.
        ...checkResult,
        ruleChecksCompleted: aiResult.ruleChecksCompleted !== false,
        llmAnalysed,
        llmStatus,
        llmError: aiResult.llmError ?? null,
      },
    };
  },

  async getBulkEligibility(userId: string, tenderIds: string[]) {
    // Bulk is Professional+ only
    const planSlug = await getUserPlanSlug(userId);
    if (planSlug === 'free' || planSlug === 'starter') {
      throw new AppError(
        'Bulk eligibility check requires Professional plan or higher.',
        403,
        'PLAN_LIMIT_EXCEEDED'
      );
    }

    const results = [];
    for (const tenderId of tenderIds) {
      try {
        const result = await eligibilityService.checkEligibility(userId, tenderId);
        results.push({ tenderId, ...result });
      } catch (error) {
        results.push({
          tenderId,
          error: error instanceof AppError ? error.message : 'Failed to check eligibility',
        });
      }
    }

    return results;
  },

  async getEligibilityHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [checks, total] = await Promise.all([
      prisma.eligibilityCheck.findMany({
        where: { userId },
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              organization: true,
              category: true,
              state: true,
              estimatedValue: true,
              bidSubmissionDeadline: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.eligibilityCheck.count({ where: { userId } }),
    ]);

    return {
      checks,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getMatchingTenders(userId: string) {
    // Fetch company profile
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!companyProfile) {
      return [];
    }

    // Query tenders matching user's categories and states
    const validCategories = (companyProfile.workCategories || []).filter(
      (cat): cat is 'WORKS' | 'GOODS' | 'SERVICES' | 'CONSULTANCY' =>
        ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'].includes(cat as any)
    );

    const orConditions: any[] = [];
    if (validCategories.length > 0) {
      orConditions.push({ category: { in: validCategories } });
    }
    if (Array.isArray(companyProfile.statesOperated) && companyProfile.statesOperated.length > 0) {
      orConditions.push({ state: { in: companyProfile.statesOperated } });
    }

    const tenders = await prisma.tender.findMany({
      where: {
        // Only tenders still open for bidding; status: 'ACTIVE' alone let expired
        // tenders through until the stats job closed them.
        ...openForBiddingWhere(new Date()),
        ...(orConditions.length > 0 ? { OR: orConditions } : {}),
      },
      orderBy: { publishedDate: 'desc' },
      take: 50,
    });

    // Rule-based eligibility scoring
    const scoredTenders = tenders.map((tender) => {
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Category match: +20 points
      if (
        companyProfile.workCategories.some(
          (cat) => cat.toLowerCase() === tender.category?.toLowerCase()
        )
      ) {
        matchScore += 20;
        matchReasons.push('Category matches your specialization');
      }

      // State match: +20 points
      if (
        companyProfile.statesOperated.some(
          (s) => s.toLowerCase() === tender.state?.toLowerCase()
        )
      ) {
        matchScore += 20;
        matchReasons.push('Located in your operating state');
      }

      // MSME match: +15 points
      if (tender.reservedForMSME && companyProfile.msmeRegistered) {
        matchScore += 15;
        matchReasons.push('Reserved for MSMEs - you qualify');
      } else if (tender.reservedForMSME && !companyProfile.msmeRegistered) {
        matchScore -= 10;
      }

      // Value within capacity: +15 points
      if (tender.estimatedValue && companyProfile.maxProjectCapacity) {
        if (companyProfile.maxProjectCapacity >= tender.estimatedValue) {
          matchScore += 15;
          matchReasons.push('Within your project capacity');
        }
      } else if (!tender.estimatedValue) {
        matchScore += 10;
      }

      // Past experience adequate: +15 points
      if (tender.minExperience && companyProfile.yearsInBusiness) {
        if (companyProfile.yearsInBusiness >= tender.minExperience) {
          matchScore += 15;
          matchReasons.push('Meets experience requirement');
        }
      } else if (!tender.minExperience) {
        matchScore += 10;
      }

      // ISO certs match: +10 points
      if (tender.requiredCertifications.length > 0) {
        const hasAllCerts = tender.requiredCertifications.every((cert) =>
          companyProfile.isoCertificates.some(
            (c) => c.toLowerCase() === cert.toLowerCase()
          )
        );
        if (hasAllCerts) {
          matchScore += 10;
          matchReasons.push('Holds required certifications');
        }
      } else {
        matchScore += 5;
      }

      // GEM registered: +5 points
      if (tender.sourcePortal?.toLowerCase().includes('gem') && companyProfile.gemRegistered) {
        matchScore += 5;
        matchReasons.push('GeM registered');
      }

      return { tender, matchScore: Math.max(matchScore, 0), matchReasons };
    });

    // Sort by score descending, return top 20
    scoredTenders.sort((a, b) => b.matchScore - a.matchScore);

    return scoredTenders.slice(0, 20);
  },

  async getTenderEligibility(userId: string, tenderId: string) {
    const check = await prisma.eligibilityCheck.findUnique({
      where: {
        userId_tenderId: { userId, tenderId },
      },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            referenceNumber: true,
            organization: true,
          },
        },
      },
    });

    return check;
  },
};
