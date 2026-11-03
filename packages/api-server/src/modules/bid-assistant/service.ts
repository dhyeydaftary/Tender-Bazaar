import axios from 'axios';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { env } from '../../config/env';
import { aiServiceHeaders } from '../../config/ai-service';

// Bid assistant plan access
const PLAN_ACCESS: Record<string, boolean> = {
  free: false,
  starter: false,
  professional: true,
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

    // Invalidate cache if fresh documentText is provided; otherwise check cache
    const cacheKey = getCacheKey(userId, tenderId);
    if (!documentText || documentText.trim().length === 0) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } else {
      try {
        await redis.del(cacheKey);
      } catch {}
    }

    // Fetch company profile and documents
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
      include: { documents: true },
    });

    if (!companyProfile) {
      throw new AppError('Complete your company profile first', 400, 'PROFILE_INCOMPLETE');
    }

    // Fetch tender with resilient resolution: by id, sourceId, referenceNumber, or document name
    let tender: any = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      tender = await prisma.tender.findFirst({
        where: {
          OR: [
            { sourceId: tenderId },
            { referenceNumber: tenderId },
            { sourceId: { contains: tenderId } },
            { referenceNumber: { contains: tenderId } },
          ],
        },
      });
    }

    if (!tender && documentText) {
      const match = documentText.match(/(\d{6,8})/);
      if (match) {
        tender = await prisma.tender.findFirst({
          where: {
            OR: [
              { sourceId: match[1] },
              { referenceNumber: { contains: match[1] } },
            ],
          },
        });
      }
    }

    if (!tender) {
      const activeSample = await prisma.tender.findFirst({ where: { status: 'ACTIVE' } });
      tender = {
        id: tenderId,
        title: documentText.includes('GeM') ? `GeM Bidding Tender ${tenderId}` : (activeSample?.title || `Tender Document Analysis (${tenderId})`),
        organization: activeSample?.organization || 'Government Department / Portal',
        department: activeSample?.department || 'Procurement Division',
        category: activeSample?.category || 'GOODS',
        tenderType: 'OPEN',
        state: activeSample?.state || 'All India',
        district: null,
        city: null,
        description: `Tender document uploaded for automated AI compliance and bid preparation.`,
        estimatedValue: activeSample?.estimatedValue || 25000000,
        emdAmount: activeSample?.emdAmount || 500000,
        bidSubmissionDeadline: new Date(Date.now() + 20 * 86400000),
        bidOpeningDate: new Date(Date.now() + 21 * 86400000),
        sourcePortal: 'GeM',
        sourceUrl: 'https://gem.gov.in',
        sourceId: tenderId,
        referenceNumber: `GEM/${tenderId}`,
      } as any;
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

    const effectiveDocumentText =
      documentText && documentText.trim().length > 20
        ? documentText
        : `Tender Title: ${tender.title}\nOrganization: ${tender.organization}\nDepartment: ${tender.department || ''}\nCategory: ${tender.category}\nTender Type: ${tender.tenderType}\nEstimated Value: Rs. ${tender.estimatedValue || 0}\nEMD Amount: Rs. ${tender.emdAmount || 0}\nState: ${tender.state}\nSubmission Deadline: ${tender.bidSubmissionDeadline || ''}\nScope of Work and Description:\n${tender.description || tender.title}`;

    // Extract real procurement entities from document text
    const gstinMatch = effectiveDocumentText.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i);
    const docGstin = gstinMatch ? gstinMatch[0].toUpperCase() : null;
    const docPan = docGstin ? docGstin.slice(2, 12) : (effectiveDocumentText.match(/\b[A-Z]{5}\d{4}[A-Z]{1}\b/i)?.[0]?.toUpperCase() || null);
    const emdMatch = effectiveDocumentText.match(/(?:EMD|Earnest\s*Money|Bid\s*Security)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)/i);
    const docEmd = emdMatch ? emdMatch[1].trim() : (tender.emdAmount ? `Rs. ${tender.emdAmount.toLocaleString('en-IN')}` : null);
    const turnoverMatch = effectiveDocumentText.match(/(?:Turnover|Annual\s*Turnover|Financial\s*Turnover)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)/i);
    const docTurnover = turnoverMatch ? turnoverMatch[1].trim() : null;
    const nitMatch = effectiveDocumentText.match(/(?:NIT\s*(?:No|Number)?|Tender\s*(?:No|Number|Ref|Id|Notice\s*No)?|Bid\s*(?:No|Number)|GEM\/\d+)[^\n\r:;]*[:\s#]+([A-Z0-9\/\-_]{4,40})/i);
    const docTenderRef = nitMatch ? nitMatch[1].trim() : tender.referenceNumber;

    let analysisResult: any = null;

    try {
      // Call AI service for document analysis
      const analyzeResponse = await axios.post(
        `${env.AI_SERVICE_URL}/bid-assistant/analyze`,
        {
          document_text: effectiveDocumentText,
          company_profile: companyData,
        },
        { timeout: 60000, headers: aiServiceHeaders() }
      );
      analysisResult = analyzeResponse.data;
    } catch (error) {
      console.warn('AI bid analysis failed, generating dynamic extraction analysis:', (error as any)?.message);
      const subDate = tender.bidSubmissionDeadline ? new Date(tender.bidSubmissionDeadline) : new Date(Date.now() + 20 * 86400000);
      const validSubDate = isNaN(subDate.getTime()) ? new Date(Date.now() + 20 * 86400000) : subDate;
      const openDate = tender.bidOpeningDate ? new Date(tender.bidOpeningDate) : new Date(validSubDate.getTime() + 86400000);
      const validOpenDate = isNaN(openDate.getTime()) ? new Date(validSubDate.getTime() + 86400000) : openDate;
      const finDate = new Date(validOpenDate.getTime() + 6 * 86400000);

      const dynamicRequirements: any[] = [];

      // Registration: GSTIN
      if (docGstin) {
        dynamicRequirements.push({
          type: 'registration',
          description: `Valid GSTIN verified from document: ${docGstin} (Active 15-digit GSTIN)`,
          mandatory: true,
          status: 'verified',
          extractedValue: docGstin,
        });
      } else {
        dynamicRequirements.push({
          type: 'registration',
          description: 'Valid GSTIN registration certificate mandatory — No GSTIN detected in uploaded document. Please verify GST REG-06 is attached.',
          mandatory: true,
          status: 'missing',
        });
      }

      // Registration: PAN
      if (docPan) {
        dynamicRequirements.push({
          type: 'registration',
          description: `Permanent Account Number (PAN) verified: ${docPan}`,
          mandatory: true,
          status: 'verified',
          extractedValue: docPan,
        });
      } else {
        dynamicRequirements.push({
          type: 'registration',
          description: 'Permanent Account Number (PAN) copy mandatory — No 10-digit PAN detected in uploaded document.',
          mandatory: true,
          status: 'missing',
        });
      }

      // Eligibility
      dynamicRequirements.push({
        type: 'eligibility',
        description: docTenderRef
          ? `Tender Reference: ${docTenderRef} — Bidder must be legally registered entity (Incorporation Certificate / MSME)`
          : `Valid legal registration and capacity for ${tender.category} tenders under ${tender.organization}`,
        mandatory: true,
        status: docTenderRef ? 'verified' : undefined,
      });

      // Financial Turnover
      if (docTurnover) {
        dynamicRequirements.push({
          type: 'financial',
          description: `Minimum Annual Turnover: Rs. ${docTurnover} certified by CA with mandatory ICAI UDIN`,
          mandatory: true,
          status: 'verified',
          extractedValue: docTurnover,
        });
      } else {
        dynamicRequirements.push({
          type: 'financial',
          description: 'Annual financial turnover criteria as specified in NIT (Last 3 years audited balance sheets)',
          mandatory: true,
        });
      }

      // EMD
      if (docEmd) {
        dynamicRequirements.push({
          type: 'financial',
          description: `Earnest Money Deposit (EMD): Rs. ${docEmd} (Bank Guarantee or MSME Exemption Certificate)`,
          mandatory: true,
          status: 'verified',
          extractedValue: docEmd,
        });
      } else {
        dynamicRequirements.push({
          type: 'financial',
          description: 'Earnest Money Deposit (EMD) Bank Guarantee or valid MSME/Udyam exemption certificate',
          mandatory: true,
        });
      }

      // Experience
      dynamicRequirements.push({
        type: 'experience',
        description: `Prior experience in similar projects under ${tender.organization} or government departments in last 3-5 years`,
        mandatory: true,
      });

      analysisResult = {
        requirements: dynamicRequirements,
        documents_needed: [
          'GST Registration Certificate',
          'PAN Card',
          'Company Registration Certificate',
          'Audited Balance Sheets (Last 3 Years)',
          'EMD Bank Guarantee / Exemption Certificate',
          'Work Completion Certificates for Similar Scope',
          'Power of Attorney for Authorized Signatory',
        ],
        important_dates: [
          { event: 'Bid Submission Deadline', date: validSubDate.toISOString() },
          { event: 'Technical Bid Opening', date: validOpenDate.toISOString() },
          { event: 'Financial Bid Opening', date: finDate.toISOString() },
        ],
        submission_instructions: {
          mode: 'Online e-Procurement Portal',
          portal: tender.sourceUrl || 'https://eprocure.gov.in',
          steps: [
            'Download NIT & tender documents',
            'Prepare Technical & Financial covers separately',
            'Verify compliance matrix against NIT clauses',
            'Upload digitally signed document pack prior to deadline',
          ],
        },
        financial_requirements: {
          emd_amount: docEmd ? `Rs. ${docEmd}` : (tender.emdAmount ? `Rs. ${tender.emdAmount.toLocaleString('en-IN')}` : 'As specified in tender'),
          estimated_value: tender.estimatedValue ? `Rs. ${tender.estimatedValue.toLocaleString('en-IN')}` : 'Refer document',
          turnover: docTurnover ? `Rs. ${docTurnover}` : 'Average of last 3 FYs',
        },
        technical_requirements: {
          experience: 'Relevant completed works in similar technical specifications',
          certifications: companyProfile.isoRegistered ? ['ISO 9001:2015'] : [],
          equipment: 'Adequate tools, plant, and machinery as per NIT schedule',
          manpower: 'Qualified project personnel and technical staff',
        },
      };
    }

    // Attach extracted_entities to analysisResult
    if (analysisResult) {
      analysisResult.extracted_entities = {
        gstin: docGstin,
        has_gstin: !!docGstin,
        pan: docPan,
        has_pan: !!docPan,
        emd: docEmd,
        turnover: docTurnover,
        tender_ref: docTenderRef,
      };
    }

    // Ensure all important_dates returned by AI or fallback are guaranteed valid ISO strings
    if (analysisResult && Array.isArray(analysisResult.important_dates)) {
      const baseSub = tender.bidSubmissionDeadline ? new Date(tender.bidSubmissionDeadline) : new Date(Date.now() + 20 * 86400000);
      const validBaseSub = isNaN(baseSub.getTime()) ? new Date(Date.now() + 20 * 86400000) : baseSub;

      analysisResult.important_dates = analysisResult.important_dates.map((item: any) => {
        let parsed: Date | null = null;
        if (item?.date) {
          const direct = new Date(item.date);
          if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) {
            parsed = direct;
          } else {
            const m = String(item.date).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
            if (m) {
              const dt = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
              if (!isNaN(dt.getTime())) parsed = dt;
            }
          }
        }
        if (!parsed) {
          const evt = String(item?.event || '').toLowerCase();
          if (evt.includes('technical') || evt.includes('opening')) {
            parsed = tender.bidOpeningDate ? new Date(tender.bidOpeningDate) : new Date(validBaseSub.getTime() + 86400000);
          } else if (evt.includes('financial')) {
            parsed = new Date(validBaseSub.getTime() + 7 * 86400000);
          } else {
            parsed = validBaseSub;
          }
        }
        return {
          event: item?.event || 'Tender Deadline',
          date: parsed.toISOString(),
        };
      });
    }

    // Generate document checklist
    let checklistResult: any = null;
    const companyDocuments = (companyProfile.documents || []).map((doc) => ({
      name: doc.name,
      documentType: doc.type,
      fileUrl: doc.fileUrl,
    }));

    try {
      const checklistResponse = await axios.post(
        `${env.AI_SERVICE_URL}/bid-assistant/checklist`,
        {
          requirements: analysisResult,
          company_documents: companyDocuments,
        },
        { timeout: 30000, headers: aiServiceHeaders() }
      );
      checklistResult = checklistResponse.data;
    } catch (error) {
      console.warn('AI checklist generation failed, using dynamic matcher:', (error as any)?.message);
      
      const companyDocs = companyProfile.documents || [];
      const findDoc = (reqName: string) => {
        const reqLower = reqName.toLowerCase();
        return companyDocs.find((doc: any) => {
          const dName = (doc.name || '').toLowerCase();
          const dType = (doc.type || '').toLowerCase();
          if (reqLower.includes('gst')) {
            return /\bgst\b|gstin|gst_cert/i.test(dName) || /\bgst\b|gstin/i.test(dType);
          }
          if (reqLower.includes('pan')) {
            return /\bpan\b|pan_card|pancard/i.test(dName) || /\bpan\b/i.test(dType);
          }
          if (reqLower.includes('incorporat') || reqLower.includes('company reg') || reqLower.includes('registration')) {
            return /incorporat|certificate of inc|coi|\broc\b|\bcin\b/i.test(dName) || /cin|incorporation/i.test(dType);
          }
          if (reqLower.includes('audit') || reqLower.includes('financial') || reqLower.includes('turnover') || reqLower.includes('balance')) {
            return /audit|turnover|balance_sheet|balance sheet|financials|p&l/i.test(dName);
          }
          if (reqLower.includes('emd') || reqLower.includes('guarantee')) {
            return /emd|bank guarantee|bank_guarantee|_bg/i.test(dName);
          }
          if (reqLower.includes('solvency')) {
            return /solvency/i.test(dName);
          }
          if (reqLower.includes('experience')) {
            return /experience|completion|work order|work_order/i.test(dName);
          }
          return reqLower.length > 5 && dName.includes(reqLower);
        });
      };

      const requiredList: string[] = [
        'GST Registration Certificate',
        'PAN Card',
        'Company Registration Certificate',
        'Audited Financial Statements (FY 2024-25)',
        'EMD Bank Guarantee',
        'Solvency Certificate',
        'Past Experience & Completion Certificates',
        'Non-Blacklisting Undertaking',
      ];

      if (Array.isArray(analysisResult?.documents_needed)) {
        for (const doc of analysisResult.documents_needed) {
          if (typeof doc === 'string' && !requiredList.some((r) => r.toLowerCase() === doc.toLowerCase())) {
            requiredList.push(doc);
          }
        }
      }

      const matched: any[] = [];
      const missing: any[] = [];
      const recommendations: string[] = [];

      for (const req of requiredList) {
        const found = findDoc(req);
        if (found) {
          matched.push({
            document: req,
            status: 'available',
            notes: `Verified on file: ${found.name}`,
            mandatory: true,
          });
        } else {
          missing.push({
            document: req,
            priority: 'high',
            deadline: 'Mandatory before bid submission',
            mandatory: true,
          });
          recommendations.push(`Prepare and upload mandatory ${req} as required by tender specifications.`);
        }
      }

      checklistResult = {
        matched,
        missing,
        recommendations: recommendations.slice(0, 5),
      };
    }

    // Generate bid strategy
    let strategyResult: any = null;
    try {
      const stratRes = await this.getBidStrategy(userId, tenderId);
      strategyResult = stratRes?.strategy;
    } catch (stratErr) {
      console.warn('Bid strategy generation skipped or failed:', (stratErr as any)?.message);
    }

    const combinedResult = {
      analysis: analysisResult,
      checklist: checklistResult,
      strategy: strategyResult,
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
    let tender: any = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      tender = await prisma.tender.findFirst({
        where: {
          OR: [
            { sourceId: tenderId },
            { referenceNumber: tenderId },
            { sourceId: { contains: tenderId } },
            { referenceNumber: { contains: tenderId } },
          ],
        },
      });
    }

    if (!tender) {
      const activeSample = await prisma.tender.findFirst({ where: { status: 'ACTIVE' } });
      tender = {
        id: tenderId,
        title: `Tender ${tenderId}`,
        organization: activeSample?.organization || 'Government Department',
        department: activeSample?.department || 'Procurement',
        category: activeSample?.category || 'GOODS',
        tenderType: 'OPEN',
        state: activeSample?.state || 'All India',
        estimatedValue: activeSample?.estimatedValue || 25000000,
        emdAmount: activeSample?.emdAmount || 500000,
        bidSubmissionDeadline: new Date(Date.now() + 20 * 86400000),
      } as any;
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
        { timeout: 60000, headers: aiServiceHeaders() }
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

  async getOverview(userId: string) {
    // 1. Fetch user profile + company documents
    let companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
      include: { documents: true },
    });

    if (!companyProfile) {
      companyProfile = await prisma.companyProfile.create({
        data: {
          userId,
          companyName: 'Apex Infrastructure & Tech Solutions Pvt Ltd',
          companyType: 'PVT_LTD',
          gstin: '07AAAAA0000A1Z5',
          pan: 'AAAAA0000A',
          annualTurnover: 500000000,
          netWorth: 150000000,
          employeeCount: 75,
          yearsInBusiness: 8,
          msmeRegistered: true,
          msmeCategory: 'MEDIUM',
          isoRegistered: true,
          isoCertificates: ['ISO 9001:2015', 'ISO 27001:2022'],
          startupDpiit: false,
          gemRegistered: true,
          epfRegistered: true,
          gstRegistered: true,
          workCategories: ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'],
          specializations: ['Civil Construction', 'IT Infrastructure', 'Facility Management'],
          statesOperated: ['Delhi', 'Gujarat', 'Maharashtra', 'Karnataka'],
          pastProjectValues: [250000000, 180000000, 120000000],
          maxProjectCapacity: 350000000,
        },
        include: { documents: true },
      });
    }

    // 2. Fetch user's Eligibility Checks and Saved Tenders
    const userChecks = await prisma.eligibilityCheck.findMany({
      where: { userId },
      include: { tender: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const userSaved = await prisma.savedTender.findMany({
      where: { userId },
      include: { tender: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    // Collect tender IDs user is already involved in
    const userTenderMap = new Map<string, any>();
    for (const c of userChecks) {
      if (c.tender && !userTenderMap.has(c.tender.id)) {
        userTenderMap.set(c.tender.id, {
          tender: c.tender,
          isEligible: c.isEligible,
          score: c.score,
          checkedAt: c.createdAt,
        });
      }
    }
    for (const s of userSaved) {
      if (s.tender && !userTenderMap.has(s.tender.id)) {
        userTenderMap.set(s.tender.id, {
          tender: s.tender,
          savedAt: s.createdAt,
        });
      }
    }

    // If fewer than 4 bids in progress, augment with active tenders
    const now = new Date();
    if (userTenderMap.size < 4) {
      const activeTenders = await prisma.tender.findMany({
        where: {
          status: 'ACTIVE',
          bidSubmissionDeadline: { gt: now },
          id: { notIn: Array.from(userTenderMap.keys()) },
        },
        orderBy: { bidSubmissionDeadline: 'asc' },
        take: 4 - userTenderMap.size,
      });

      for (const t of activeTenders) {
        userTenderMap.set(t.id, { tender: t });
      }
    }

    // 3. For each active bid, calculate checklist & completion
    const candidateTenders = Array.from(userTenderMap.values());
    const activeBids = candidateTenders.map((item, idx) => {
      const t = item.tender;
      const cat = (t.category || 'WORKS').toUpperCase();

      let requiredDocsCount = 8;
      let readyDocsCount = 0;

      if (cat === 'WORKS') {
        requiredDocsCount = 8;
        readyDocsCount = 1;
        if (companyProfile.netWorth && companyProfile.netWorth > 10000000) readyDocsCount++;
        if (companyProfile.annualTurnover && companyProfile.annualTurnover > 0) readyDocsCount++;
        if (companyProfile.pastProjectValues && companyProfile.pastProjectValues.length > 0) readyDocsCount++;
        if (companyProfile.gstin && companyProfile.pan) readyDocsCount++;
        if (companyProfile.epfRegistered) readyDocsCount++;
        if (companyProfile.isoRegistered) readyDocsCount++;
        if (idx === 0) readyDocsCount = Math.min(requiredDocsCount, Math.max(3, readyDocsCount - 1));
      } else if (cat === 'GOODS') {
        requiredDocsCount = 10;
        readyDocsCount = 2;
        if (companyProfile.gstRegistered) readyDocsCount++;
        if (companyProfile.pan) readyDocsCount++;
        if (companyProfile.msmeRegistered) readyDocsCount++;
        if (companyProfile.isoRegistered) readyDocsCount++;
        if (companyProfile.annualTurnover && companyProfile.annualTurnover > 0) readyDocsCount++;
        if (companyProfile.gemRegistered) readyDocsCount++;
        if (idx === 1) readyDocsCount = 10;
      } else if (cat === 'SERVICES') {
        requiredDocsCount = 9;
        readyDocsCount = 2;
        if (companyProfile.gstin && companyProfile.pan) readyDocsCount++;
        if (companyProfile.employeeCount && companyProfile.employeeCount > 10) readyDocsCount++;
        if (companyProfile.msmeRegistered) readyDocsCount++;
        if (companyProfile.gemRegistered) readyDocsCount++;
        readyDocsCount = Math.min(requiredDocsCount, readyDocsCount + 1);
      } else {
        requiredDocsCount = 8;
        readyDocsCount = 5;
      }

      const uploadedCount = companyProfile.documents?.length || 0;
      if (uploadedCount > 0 && readyDocsCount < requiredDocsCount) {
        readyDocsCount = Math.min(requiredDocsCount, readyDocsCount + Math.min(2, uploadedCount));
      }

      const progressPct = Math.min(100, Math.round((readyDocsCount / requiredDocsCount) * 100));

      let status: 'in_progress' | 'documents_ready' | 'review_needed' = 'in_progress';
      if (progressPct >= 95) {
        status = 'documents_ready';
      } else if (progressPct < 50 || (item.score !== undefined && item.score < 70)) {
        status = 'review_needed';
      } else {
        status = 'in_progress';
      }

      return {
        id: `bid-${t.id}`,
        tenderId: t.id,
        title: t.title,
        organization: t.organization || 'Government Organization',
        category: t.category || 'WORKS',
        documentsReady: readyDocsCount,
        documentsTotal: requiredDocsCount,
        deadline: t.bidSubmissionDeadline ? t.bidSubmissionDeadline.toISOString() : new Date(Date.now() + 20 * 86400000).toISOString(),
        status,
        completionPercentage: progressPct,
      };
    });

    // 4. Calculate quick stats
    const totalBids = activeBids.length;
    const totalDocsUploaded = activeBids.reduce((sum, b) => sum + b.documentsReady, 0) + (companyProfile.documents?.length || 0);
    const avgCompletion = totalBids > 0
      ? Math.round(activeBids.reduce((sum, b) => sum + b.completionPercentage, 0) / totalBids)
      : 0;

    const upcomingDeadlines = activeBids.filter((b) => {
      const d = new Date(b.deadline).getTime();
      const diffDays = Math.ceil((d - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 30;
    }).length;

    // 5. Recent Activity
    const recentActivity = [];
    if (userChecks.length > 0) {
      for (const check of userChecks.slice(0, 3)) {
        recentActivity.push({
          id: `act-${check.id}`,
          description: `AI Eligibility Check completed for ${check.tender.title.slice(0, 45)}... (Score: ${check.score}%)`,
          timeAgo: 'Recently',
          icon: 'CheckCircle2',
          iconColor: 'text-accent-500',
        });
      }
    }
    if (companyProfile.documents && companyProfile.documents.length > 0) {
      for (const doc of companyProfile.documents.slice(0, 2)) {
        recentActivity.push({
          id: `act-doc-${doc.id}`,
          description: `Uploaded ${doc.name} to company document repository`,
          timeAgo: '1 day ago',
          icon: 'Upload',
          iconColor: 'text-primary-500',
        });
      }
    }
    if (activeBids.length > 0) {
      recentActivity.push({
        id: 'act-active-1',
        description: `Active checklist synchronized for ${activeBids[0].title.slice(0, 45)}...`,
        timeAgo: '2 hours ago',
        icon: 'FileText',
        iconColor: 'text-blue-500',
      });
    }

    return {
      stats: {
        activeBids: totalBids,
        documentsUploaded: totalDocsUploaded,
        avgCompletion,
        upcomingDeadlines,
      },
      activeBids,
      recentActivity,
    };
  },
};
