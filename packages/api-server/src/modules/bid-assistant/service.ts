import axios from 'axios';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { env } from '../../config/env';

// Bid assistant is Enterprise-only
const PLAN_ACCESS: Record<string, boolean> = {
  free: false,
  starter: false,
  professional: false,
  enterprise: true,
};

function getMonthKey(userId: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `bid-assistant:${userId}:${yyyy}-${mm}`;
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

async function checkEnterprisePlan(userId: string): Promise<void> {
  const planSlug = await getUserPlanSlug(userId);
  const hasAccess = PLAN_ACCESS[planSlug] ?? false;

  if (!hasAccess) {
    throw new AppError(
      'Bid Document Assistant requires an Enterprise plan. Upgrade to access AI-powered bid analysis.',
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

function getCacheKey(userId: string, tenderId: string): string {
  return `bid-analysis:${userId}:${tenderId}`;
}

export const bidAssistantService = {
  async analyzeTenderDocument(userId: string, tenderId: string, documentText: string) {
    // Check Enterprise plan
    await checkEnterprisePlan(userId);

    // Check cache first
    const cacheKey = getCacheKey(userId, tenderId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch company profile and documents
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

    const companyData = {
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
    };

    let analysisResult: any = null;

    try {
      // Call AI service for document analysis
      const analyzeResponse = await axios.post(
        `${env.AI_SERVICE_URL}/bid-assistant/analyze`,
        {
          document_text: documentText,
          company_profile: companyData,
        },
        { timeout: 60000 }
      );
      analysisResult = analyzeResponse.data;
    } catch (error) {
      console.warn('AI bid analysis failed:', (error as any)?.message);
      throw new AppError('AI analysis service unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
    }

    // Generate document checklist
    let checklistResult: any = null;
    try {
      const companyDocuments = companyProfile.documents.map((doc) => ({
        name: doc.name,
        documentType: doc.type,
        fileUrl: doc.fileUrl,
      }));

      const checklistResponse = await axios.post(
        `${env.AI_SERVICE_URL}/bid-assistant/checklist`,
        {
          requirements: analysisResult,
          company_documents: companyDocuments,
        },
        { timeout: 30000 }
      );
      checklistResult = checklistResponse.data;
    } catch (error) {
      console.warn('AI checklist generation failed:', (error as any)?.message);
      checklistResult = { matched: [], missing: [], recommendations: [] };
    }

    const combinedResult = {
      analysis: analysisResult,
      checklist: checklistResult,
      tender: {
        id: tender.id,
        title: tender.title,
        organization: tender.organization,
        category: tender.category,
        state: tender.state,
        estimatedValue: tender.estimatedValue,
        emdAmount: tender.emdAmount,
        bidSubmissionDeadline: tender.bidSubmissionDeadline,
      },
    };

    // Cache for 24 hours
    await redis.setex(cacheKey, 86400, JSON.stringify(combinedResult));

    // Track usage
    await incrementUsage(userId);

    return combinedResult;
  },

  async getBidStrategy(userId: string, tenderId: string) {
    // Check Enterprise plan
    await checkEnterprisePlan(userId);

    // Fetch tender
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Fetch company profile
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!companyProfile) {
      throw new AppError('Complete your company profile first', 400, 'PROFILE_INCOMPLETE');
    }

    // Get competitor data: recent winners in same category
    const recentResults = await prisma.tenderResult.findMany({
      where: {
        tender: {
          category: tender.category,
        },
      },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            estimatedValue: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const competitorData = {
      recentWinners: recentResults.map((r) => r.winnerName || r.winnerCompany || 'Unknown'),
      averageWinningBid: recentResults.length > 0
        ? recentResults.reduce((sum, r) => sum + (r.awardedValue || 0), 0) / recentResults.length
        : null,
      totalBidders: recentResults.length,
      categoryTrends: `${recentResults.length} recent awards in ${tender.category || 'this category'}`,
    };

    const tenderInfo = {
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
      bidSubmissionDeadline: tender.bidSubmissionDeadline,
    };

    const companyData = {
      companyName: companyProfile.companyName,
      companyType: companyProfile.companyType,
      annualTurnover: companyProfile.annualTurnover,
      netWorth: companyProfile.netWorth,
      employeeCount: companyProfile.employeeCount,
      yearsInBusiness: companyProfile.yearsInBusiness,
      msmeRegistered: companyProfile.msmeRegistered,
      isoRegistered: companyProfile.isoRegistered,
      isoCertificates: companyProfile.isoCertificates,
      workCategories: companyProfile.workCategories,
      specializations: companyProfile.specializations,
      statesOperated: companyProfile.statesOperated,
      pastProjectValues: companyProfile.pastProjectValues,
      maxProjectCapacity: companyProfile.maxProjectCapacity,
    };

    let strategyResult: any = null;

    try {
      const response = await axios.post(
        `${env.AI_SERVICE_URL}/bid-assistant/strategy`,
        {
          tender_info: tenderInfo,
          company_profile: companyData,
          competitors: competitorData,
        },
        { timeout: 60000 }
      );
      strategyResult = response.data;
    } catch (error) {
      console.warn('AI strategy generation failed:', (error as any)?.message);
      throw new AppError('AI strategy service unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
    }

    return {
      strategy: strategyResult,
      tender: {
        id: tender.id,
        title: tender.title,
        organization: tender.organization,
        estimatedValue: tender.estimatedValue,
      },
    };
  },
};
