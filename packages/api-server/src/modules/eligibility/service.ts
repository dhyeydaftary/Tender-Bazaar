import axios from 'axios';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { env } from '../../config/env';
import { aiEligibilityResponseSchema } from './validation';

// Plan limits for AI eligibility checks per month
const PLAN_ELIGIBILITY_LIMITS: Record<string, number> = {
  free: 1,
  starter: 5,
  professional: 50,
  enterprise: -1, // unlimited
};

function getMonthKey(userId: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `eligibility:count:${userId}:${yyyy}-${mm}`;
}

function getMonthTTL(): number {
  const now = new Date();
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);
}

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

async function checkPlanLimit(userId: string, planSlug: string): Promise<void> {
  const limit = PLAN_ELIGIBILITY_LIMITS[planSlug] ?? 0;

  // Unlimited
  if (limit === -1) return;

  if (planSlug === 'free') {
    // Free plan: limit 1 ever (not per month)
    const existingCount = await prisma.eligibilityCheck.count({
      where: { userId },
    });
    if (existingCount >= 1) {
      throw new AppError(
        'Monthly eligibility check limit reached. Upgrade your plan.',
        403,
        'PLAN_LIMIT_EXCEEDED'
      );
    }
    return;
  }

  // Paid plans: monthly limit via Redis
  const redisKey = getMonthKey(userId);
  const currentCount = parseInt((await redis.get(redisKey)) || '0', 10);

  if (currentCount >= limit) {
    throw new AppError(
      'Monthly eligibility check limit reached. Upgrade your plan.',
      403,
      'PLAN_LIMIT_EXCEEDED'
    );
  }
}

async function incrementUsage(userId: string): Promise<void> {
  const redisKey = getMonthKey(userId);
  const ttl = getMonthTTL();
  const pipeline = redis.pipeline();
  pipeline.incr(redisKey);
  pipeline.expire(redisKey, ttl);
  await pipeline.exec();
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

export const eligibilityService = {
  async checkEligibility(userId: string, tenderId: string) {
    // Fetch company profile
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
      include: { documents: true },
    });

    if (!companyProfile) {
      throw new AppError('Complete your company profile first', 400, 'PROFILE_INCOMPLETE');
    }

    // Fetch tender
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Check plan limits
    const planSlug = await getUserPlanSlug(userId);
    await checkPlanLimit(userId, planSlug);

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
        { timeout: 30000 }
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

    // `basicFallbackCheck` is fully typed and the AI path is schema-validated,
    // so these are present by construction on both paths.
    const score = aiResult.score;
    const isEligible = aiResult.isEligible;
    const criteria = aiResult.criteria;
    const suggestions = aiResult.suggestions ?? [];

    // Upsert eligibility check record
    const eligibilityCheck = await prisma.eligibilityCheck.upsert({
      where: {
        userId_tenderId: { userId, tenderId },
      },
      update: {
        score,
        isEligible,
        criteria,
        suggestions,
        updatedAt: new Date(),
      },
      create: {
        userId,
        tenderId,
        score,
        isEligible,
        criteria,
        suggestions,
      },
    });

    // Increment usage counter
    await incrementUsage(userId);

    // Provenance, forwarded from the service rather than inferred here.
    //
    // `isFallback` alone was misleading: it only said whether THIS server
    // reached the AI service. When the service answered 200 but its own LLM
    // call had failed (an invalid key, for instance), isFallback was false and
    // the result looked like a completed AI analysis. `llmAnalysed` is the
    // field that actually answers "did a model analyse this tender", and it is
    // true only when the service reported SUCCESS.
    const llmStatus: string = aiResult.llmStatus ?? 'UNAVAILABLE';
    const llmAnalysed = aiResult.llmAnalysed === true && llmStatus === 'SUCCESS';

    return {
      eligibilityCheck,
      result: {
        score,
        isEligible,
        criteria,
        suggestions,
        /** Kept for existing clients: true when this server fell back locally. */
        isFallback: aiResult._fallback ?? false,
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
    const tenders = await prisma.tender.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { category: { in: companyProfile.workCategories as any } },
          { state: { in: companyProfile.statesOperated } },
        ],
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
};
