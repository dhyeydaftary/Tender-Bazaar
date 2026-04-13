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

    // Build the data object, converting date string to Date if present
    const profileData: Record<string, unknown> = { ...data };
    if (data.incorporationDate) {
      profileData.incorporationDate = new Date(data.incorporationDate);
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
        annualTurnover: data.annualTurnover ?? undefined,
        netWorth: data.netWorth ?? undefined,
        employeeCount: data.employeeCount ?? undefined,
        yearsInBusiness: data.yearsInBusiness ?? undefined,
        msmeRegistered: data.msmeRegistered ?? false,
        msmeNumber: data.msmeNumber ?? undefined,
        msmeCategory: data.msmeCategory ?? undefined,
        isoRegistered: data.isoRegistered ?? false,
        isoCertificates: data.isoCertificates ?? [],
        startupDpiit: data.startupDpiit ?? false,
        gemRegistered: data.gemRegistered ?? false,
        epfRegistered: data.epfRegistered ?? false,
        gstRegistered: data.gstRegistered ?? false,
        workCategories: data.workCategories ?? [],
        specializations: data.specializations ?? [],
        statesOperated: data.statesOperated ?? [],
        pastProjectValues: data.pastProjectValues ?? [],
        maxProjectCapacity: data.maxProjectCapacity ?? undefined,
      },
      update: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.gstin !== undefined && { gstin: data.gstin }),
        ...(data.pan !== undefined && { pan: data.pan }),
        ...(data.companyType !== undefined && { companyType: data.companyType }),
        ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber }),
        ...(data.incorporationDate !== undefined && {
          incorporationDate: data.incorporationDate ? new Date(data.incorporationDate) : null,
        }),
        ...(data.annualTurnover !== undefined && { annualTurnover: data.annualTurnover }),
        ...(data.netWorth !== undefined && { netWorth: data.netWorth }),
        ...(data.employeeCount !== undefined && { employeeCount: data.employeeCount }),
        ...(data.yearsInBusiness !== undefined && { yearsInBusiness: data.yearsInBusiness }),
        ...(data.msmeRegistered !== undefined && { msmeRegistered: data.msmeRegistered }),
        ...(data.msmeNumber !== undefined && { msmeNumber: data.msmeNumber }),
        ...(data.msmeCategory !== undefined && { msmeCategory: data.msmeCategory }),
        ...(data.isoRegistered !== undefined && { isoRegistered: data.isoRegistered }),
        ...(data.isoCertificates !== undefined && { isoCertificates: data.isoCertificates }),
        ...(data.startupDpiit !== undefined && { startupDpiit: data.startupDpiit }),
        ...(data.gemRegistered !== undefined && { gemRegistered: data.gemRegistered }),
        ...(data.epfRegistered !== undefined && { epfRegistered: data.epfRegistered }),
        ...(data.gstRegistered !== undefined && { gstRegistered: data.gstRegistered }),
        ...(data.workCategories !== undefined && { workCategories: data.workCategories }),
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
};
