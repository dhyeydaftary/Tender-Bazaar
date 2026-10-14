import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { deleteFile, buildFileUrl } from '../../shared/utils/upload';
import type { UpdateProfileInput, UpdateCompanyProfileInput, DocumentTypeEnum } from './validation';

// ─── User Profile Service ───────────────────────────────

export const userService = {
  /**
   * Get full user profile with company details, documents, subscription, and stats
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
        companyProfile: {
          include: {
            documents: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Gather stats in parallel
    const [savedTendersCount, eligibilityChecksCount] = await Promise.all([
      prisma.savedTender.count({ where: { userId } }),
      prisma.eligibilityCheck.count({ where: { userId } }),
    ]);

    return {
      ...user,
      stats: {
        savedTenders: savedTendersCount,
        eligibilityChecks: eligibilityChecksCount,
      },
    };
  },

  /**
   * Update basic user profile (name, phone)
   */
  async updateProfile(userId: string, data: UpdateProfileInput) {
    // If phone is being updated, check uniqueness
    if (data.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: data.phone,
          id: { not: userId },
        },
      });
      if (existingPhone) {
        throw new AppError(
          'This phone number is already associated with another account',
          409,
          'PHONE_ALREADY_EXISTS',
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        updatedAt: true,
      },
    });

    return updated;
  },

  /**
   * Upsert company profile - create if not exists, update if exists
   */
  async updateCompanyProfile(userId: string, data: UpdateCompanyProfileInput) {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Parse turnover if passed as range string or number
    let parsedTurnover: number | null | undefined;
    if (typeof data.annualTurnover === 'number') {
      parsedTurnover = data.annualTurnover;
    } else if (typeof data.annualTurnover === 'string') {
      const trimmed = data.annualTurnover.trim();
      if (!trimmed) {
        parsedTurnover = null;
      } else {
        switch (trimmed) {
          case 'below_25l': parsedTurnover = 1500000; break;
          case '25l_1cr': parsedTurnover = 6000000; break;
          case 'under_1cr': parsedTurnover = 5000000; break;
          case '1cr_5cr': parsedTurnover = 25000000; break;
          case '5cr_25cr': parsedTurnover = 150000000; break;
          case '25cr_100cr': parsedTurnover = 500000000; break;
          case '100cr_500cr': parsedTurnover = 2500000000; break;
          case 'above_100cr': parsedTurnover = 1500000000; break;
          case 'above_500cr': parsedTurnover = 7500000000; break;
          default: {
            const n = parseFloat(trimmed);
            if (!isNaN(n)) parsedTurnover = n;
          }
        }
      }
    }

    // Parse experience if passed as range string or number
    const expRaw = data.yearsInBusiness ?? data.experience;
    let parsedYears: number | null | undefined;
    if (typeof expRaw === 'number') {
      parsedYears = Math.round(expRaw);
    } else if (typeof expRaw === 'string') {
      const trimmed = expRaw.trim();
      if (!trimmed) {
        parsedYears = null;
      } else {
        switch (trimmed) {
          case '0_1':
          case 'under_1': parsedYears = 1; break;
          case '1_3': parsedYears = 2; break;
          case '3_5': parsedYears = 4; break;
          case '5_10': parsedYears = 7; break;
          case '10_20': parsedYears = 15; break;
          case 'above_10':
          case 'above_20': parsedYears = 22; break;
          default: {
            const n = parseInt(trimmed, 10);
            if (!isNaN(n)) parsedYears = n;
          }
        }
      }
    }

    const certificates = data.isoCertificates ?? data.certifications ?? [];
    const categories = [...(data.workCategories ?? [])];
    if (data.industry && !categories.includes(data.industry)) {
      categories.unshift(data.industry);
    }

    const companyProfile = await prisma.companyProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: data.companyName,
        gstin: data.gstin ?? undefined,
        pan: data.pan ?? undefined,
        companyType: data.companyType ?? undefined,
        registrationNumber: data.registrationNumber ?? undefined,
        incorporationDate: data.incorporationDate ? new Date(data.incorporationDate) : undefined,
        annualTurnover: parsedTurnover,
        netWorth: data.netWorth ?? undefined,
        employeeCount: data.employeeCount ?? undefined,
        yearsInBusiness: parsedYears,
        msmeRegistered: data.msmeRegistered ?? false,
        msmeNumber: data.msmeNumber ?? undefined,
        msmeCategory: data.msmeCategory ?? undefined,
        isoRegistered: certificates.length > 0 ? true : (data.isoRegistered ?? false),
        isoCertificates: certificates,
        startupDpiit: data.startupDpiit ?? false,
        gemRegistered: data.gemRegistered ?? false,
        epfRegistered: data.epfRegistered ?? false,
        gstRegistered: data.gstRegistered ?? false,
        workCategories: categories,
        specializations: data.specializations ?? [],
        statesOperated: data.statesOperated ?? [],
        pastProjectValues: data.pastProjectValues ?? [],
        maxProjectCapacity: data.maxProjectCapacity ?? undefined,
      },
      update: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.gstin !== undefined && { gstin: data.gstin ? data.gstin : null }),
        ...(data.pan !== undefined && { pan: data.pan }),
        ...(data.companyType !== undefined && { companyType: data.companyType }),
        ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber }),
        ...(data.incorporationDate !== undefined && {
          incorporationDate: data.incorporationDate ? new Date(data.incorporationDate) : null,
        }),
        ...(parsedTurnover !== undefined && { annualTurnover: parsedTurnover }),
        ...(data.netWorth !== undefined && { netWorth: data.netWorth }),
        ...(data.employeeCount !== undefined && { employeeCount: data.employeeCount }),
        ...(parsedYears !== undefined && { yearsInBusiness: parsedYears }),
        ...(data.msmeRegistered !== undefined && { msmeRegistered: data.msmeRegistered }),
        ...(data.msmeNumber !== undefined && { msmeNumber: data.msmeNumber }),
        ...(data.msmeCategory !== undefined && { msmeCategory: data.msmeCategory }),
        ...(certificates.length > 0 && { isoRegistered: true, isoCertificates: certificates }),
        ...(data.startupDpiit !== undefined && { startupDpiit: data.startupDpiit }),
        ...(data.gemRegistered !== undefined && { gemRegistered: data.gemRegistered }),
        ...(data.epfRegistered !== undefined && { epfRegistered: data.epfRegistered }),
        ...(data.gstRegistered !== undefined && { gstRegistered: data.gstRegistered }),
        ...(categories.length > 0 && { workCategories: categories }),
        ...(data.specializations !== undefined && { specializations: data.specializations }),
        ...(data.statesOperated !== undefined && { statesOperated: data.statesOperated }),
        ...(data.pastProjectValues !== undefined && { pastProjectValues: data.pastProjectValues }),
        ...(data.maxProjectCapacity !== undefined && { maxProjectCapacity: data.maxProjectCapacity }),
      },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return companyProfile;
  },

  /**
   * Upload a document and link it to the user's company profile.
   * Creates a company profile with a placeholder name if one doesn't exist.
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    docType: DocumentTypeEnum,
    docName?: string,
  ) {
    // Ensure company profile exists (create minimal one if needed)
    let companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!companyProfile) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      companyProfile = await prisma.companyProfile.create({
        data: {
          userId,
          companyName: user.name ? `${user.name}'s Company` : 'My Company',
        },
      });
    }

    const fileUrl = buildFileUrl(userId, file.filename);
    const documentName = docName || file.originalname;

    const document = await prisma.companyDocument.create({
      data: {
        companyProfileId: companyProfile.id,
        name: documentName,
        type: docType,
        fileUrl,
        fileSize: file.size,
      },
    });

    return document;
  },

  /**
   * Delete a document, verifying ownership first
   */
  async deleteDocument(userId: string, documentId: string) {
    // Find the document and verify ownership through the company profile
    const document = await prisma.companyDocument.findUnique({
      where: { id: documentId },
      include: {
        companyProfile: {
          select: { userId: true },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (document.companyProfile.userId !== userId) {
      throw new AppError('You do not have permission to delete this document', 403, 'FORBIDDEN');
    }

    // Delete the physical file
    await deleteFile(document.fileUrl);

    // Delete the database record
    await prisma.companyDocument.delete({
      where: { id: documentId },
    });

    return { message: 'Document deleted successfully' };
  },

  /**
   * Calculate profile completion percentage based on weighted sections:
   * - Basic info: 20% (name, email, phone, avatarUrl)
   * - Financial: 20% (annualTurnover, netWorth, employeeCount, yearsInBusiness)
   * - Registrations: 20% (gstin, pan, companyType, registrationNumber, incorporationDate)
   * - Certifications: 10% (msme, iso, startupDpiit, gem, epf, gst)
   * - Capabilities: 20% (workCategories, specializations, statesOperated, pastProjectValues, maxProjectCapacity)
   * - Documents: 10% (at least 1, 2, 3 documents)
   */
  async getProfileCompletionPercentage(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        companyProfile: {
          include: {
            documents: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const profile = user.companyProfile;
    const sections: Record<string, { weight: number; score: number; fields: Record<string, boolean> }> = {};

    // ── Basic Info (20%) ──
    const basicFields = {
      name: !!user.name,
      email: !!user.email,
      phone: !!user.phone,
      avatarUrl: !!user.avatarUrl,
    };
    const basicFilled = Object.values(basicFields).filter(Boolean).length;
    sections.basicInfo = {
      weight: 20,
      score: (basicFilled / Object.keys(basicFields).length) * 100,
      fields: basicFields,
    };

    // ── Financial (20%) ──
    const financialFields = {
      annualTurnover: !!profile?.annualTurnover,
      netWorth: !!profile?.netWorth,
      employeeCount: profile?.employeeCount != null,
      yearsInBusiness: profile?.yearsInBusiness != null,
    };
    const financialFilled = Object.values(financialFields).filter(Boolean).length;
    sections.financial = {
      weight: 20,
      score: (financialFilled / Object.keys(financialFields).length) * 100,
      fields: financialFields,
    };

    // ── Registrations (20%) ──
    const registrationFields = {
      companyName: !!profile?.companyName,
      gstin: !!profile?.gstin,
      pan: !!profile?.pan,
      companyType: !!profile?.companyType,
      registrationNumber: !!profile?.registrationNumber,
      incorporationDate: !!profile?.incorporationDate,
    };
    const registrationFilled = Object.values(registrationFields).filter(Boolean).length;
    sections.registrations = {
      weight: 20,
      score: (registrationFilled / Object.keys(registrationFields).length) * 100,
      fields: registrationFields,
    };

    // ── Certifications (10%) ──
    const certificationFields = {
      msmeRegistered: !!profile?.msmeRegistered,
      isoRegistered: !!profile?.isoRegistered,
      startupDpiit: !!profile?.startupDpiit,
      gemRegistered: !!profile?.gemRegistered,
      epfRegistered: !!profile?.epfRegistered,
      gstRegistered: !!profile?.gstRegistered,
    };
    // For certifications, count any that are true as progress
    const certFilled = Object.values(certificationFields).filter(Boolean).length;
    sections.certifications = {
      weight: 10,
      score: certFilled > 0 ? Math.min((certFilled / 3) * 100, 100) : 0,
      fields: certificationFields,
    };

    // ── Capabilities (20%) ──
    const capabilityFields = {
      workCategories: (profile?.workCategories?.length ?? 0) > 0,
      specializations: (profile?.specializations?.length ?? 0) > 0,
      statesOperated: (profile?.statesOperated?.length ?? 0) > 0,
      pastProjectValues: (profile?.pastProjectValues?.length ?? 0) > 0,
      maxProjectCapacity: profile?.maxProjectCapacity != null,
    };
    const capFilled = Object.values(capabilityFields).filter(Boolean).length;
    sections.capabilities = {
      weight: 20,
      score: (capFilled / Object.keys(capabilityFields).length) * 100,
      fields: capabilityFields,
    };

    // ── Documents (10%) ──
    const docCount = profile?.documents?.length ?? 0;
    const docScore = docCount >= 3 ? 100 : docCount >= 2 ? 66 : docCount >= 1 ? 33 : 0;
    sections.documents = {
      weight: 10,
      score: docScore,
      fields: {
        hasAtLeast1: docCount >= 1,
        hasAtLeast2: docCount >= 2,
        hasAtLeast3: docCount >= 3,
      },
    };

    // ── Calculate Overall ──
    const overallPercentage = Object.values(sections).reduce(
      (total, section) => total + (section.score / 100) * section.weight,
      0,
    );

    return {
      percentage: Math.round(overallPercentage),
      sections,
    };
  },

  /**
   * Calculate dynamic user analytics in real-time
   */
  async getUserAnalytics(userId: string) {
    // 1. Saved tenders
    const [savedTenders, totalSavedCount] = await Promise.all([
      prisma.savedTender.findMany({
        where: { userId },
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              category: true,
              estimatedValue: true,
            },
          },
        },
      }),
      prisma.savedTender.count({ where: { userId } }),
    ]);

    const catCounts: Record<string, number> = {
      WORKS: 0,
      GOODS: 0,
      SERVICES: 0,
      CONSULTANCY: 0,
    };

    for (const item of savedTenders) {
      const cat = (item.tender?.category || 'WORKS').toUpperCase();
      if (cat in catCounts) {
        catCounts[cat]++;
      } else {
        catCounts.WORKS++;
      }
    }

    let savedByCategory: Array<{ name: string; count: number; pct: number; color: string }>;
    let hasSavedTenders = totalSavedCount > 0;

    if (totalSavedCount > 0) {
      savedByCategory = [
        {
          name: 'Works',
          count: catCounts.WORKS,
          pct: Math.round((catCounts.WORKS / totalSavedCount) * 100),
          color: 'bg-primary-500',
        },
        {
          name: 'Goods',
          count: catCounts.GOODS,
          pct: Math.round((catCounts.GOODS / totalSavedCount) * 100),
          color: 'bg-blue-500',
        },
        {
          name: 'Services',
          count: catCounts.SERVICES,
          pct: Math.round((catCounts.SERVICES / totalSavedCount) * 100),
          color: 'bg-accent-500',
        },
        {
          name: 'Consultancy',
          count: catCounts.CONSULTANCY,
          pct: Math.round((catCounts.CONSULTANCY / totalSavedCount) * 100),
          color: 'bg-purple-500',
        },
      ];
    } else {
      // Calculate from live platform tenders in DB as baseline market split
      const platformCats = await prisma.tender.groupBy({
        by: ['category'],
        _count: { category: true },
      });
      const totalPlatform = platformCats.reduce((sum, c) => sum + c._count.category, 0) || 1;
      const getPlatformPct = (catName: string) => {
        const found = platformCats.find((c) => c.category === catName);
        return found ? Math.round((found._count.category / totalPlatform) * 100) : 0;
      };

      savedByCategory = [
        { name: 'Works', count: 0, pct: getPlatformPct('WORKS'), color: 'bg-primary-500' },
        { name: 'Goods', count: 0, pct: getPlatformPct('GOODS'), color: 'bg-blue-500' },
        { name: 'Services', count: 0, pct: getPlatformPct('SERVICES'), color: 'bg-accent-500' },
        { name: 'Consultancy', count: 0, pct: getPlatformPct('CONSULTANCY'), color: 'bg-purple-500' },
      ];
    }

    // 2. Eligibility checks
    const eligibilityChecks = await prisma.eligibilityCheck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const eligibilityChecksCount = eligibilityChecks.length;
    const avgScore =
      eligibilityChecksCount > 0
        ? Math.round(
            eligibilityChecks.reduce((sum, c) => sum + (c.score || 0), 0) /
              eligibilityChecksCount
          )
        : 0;

    const eligibilityTrend = eligibilityChecks.slice(0, 5).map((check) => ({
      tender: check.tender?.title || 'Tender Eligibility Check',
      score: Math.round(check.score),
      date: new Date(check.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        day: '2-digit',
      }),
    }));

    // 3. Search history
    const userSearches = await prisma.searchHistory.groupBy({
      by: ['query'],
      where: { userId },
      _count: { query: true },
      orderBy: {
        _count: { query: 'desc' },
      },
      take: 5,
    });

    let topSearches = userSearches.map((s) => ({
      keyword: s.query,
      count: s._count.query,
    }));

    if (topSearches.length < 5) {
      const platformSearches = await prisma.searchHistory.groupBy({
        by: ['query'],
        _count: { query: true },
        orderBy: {
          _count: { query: 'desc' },
        },
        take: 5 - topSearches.length,
      });

      const existingKeywords = new Set(topSearches.map((s) => s.keyword.toLowerCase()));
      for (const ps of platformSearches) {
        if (!existingKeywords.has(ps.query.toLowerCase())) {
          topSearches.push({ keyword: ps.query, count: ps._count.query });
          existingKeywords.add(ps.query.toLowerCase());
        }
      }

      if (topSearches.length < 5) {
        const fallbackKeywords = [
          'Aluminium Cable 1100V Grade',
          'Solar Power Plant Grid Connected',
          'Road Construction and Widening',
          'Hospital Equipment AIIMS Supply',
          'Railway Bridge Infrastructure Works',
        ];
        for (const kw of fallbackKeywords) {
          if (topSearches.length >= 5) break;
          if (!existingKeywords.has(kw.toLowerCase())) {
            topSearches.push({ keyword: kw, count: 1 });
            existingKeywords.add(kw.toLowerCase());
          }
        }
      }
    }

    // 4. Platform stats
    const totalPlatformViews = await prisma.tender.aggregate({
      _sum: { viewCount: true },
    });

    return {
      tendersSaved: totalSavedCount,
      hasSavedTenders,
      savedByCategory,
      eligibilityChecksCount,
      avgScore,
      eligibilityTrend,
      topSearches,
      platformTotalViews: totalPlatformViews._sum.viewCount || 0,
    };
  },
};
