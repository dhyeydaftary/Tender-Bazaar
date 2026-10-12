import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { AlertFrequency, Prisma } from '@prisma/client';

// Plan limits for max alerts
const PLAN_ALERT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 5,
  professional: 20,
  enterprise: -1, // unlimited
};

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

export const alertService = {
  async createAlert(userId: string, data: {
    name: string;
    keywords: string[];
    categories?: string[];
    states?: string[];
    minValue?: number;
    maxValue?: number;
    organizations?: string[];
    tenderTypes?: string[];
    frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    whatsappEnabled?: boolean;
    smsEnabled?: boolean;
  }) {
    // Check plan limits
    const planSlug = await getUserPlanSlug(userId);
    const limit = PLAN_ALERT_LIMITS[planSlug] ?? 1;

    if (limit !== -1) {
      const existingCount = await prisma.alert.count({ where: { userId } });
      if (existingCount >= limit) {
        throw new AppError(
          `You have reached your alert limit (${limit}). Upgrade your plan to create more alerts.`,
          403,
          'PLAN_LIMIT_EXCEEDED'
        );
      }
    }

    const alert = await prisma.alert.create({
      data: {
        userId,
        name: data.name,
        keywords: data.keywords,
        categories: data.categories ?? [],
        states: data.states ?? [],
        minValue: data.minValue,
        maxValue: data.maxValue,
        organizations: data.organizations ?? [],
        tenderTypes: data.tenderTypes ?? [],
        frequency: data.frequency as AlertFrequency,
        emailEnabled: data.emailEnabled ?? true,
        pushEnabled: data.pushEnabled ?? true,
        whatsappEnabled: data.whatsappEnabled ?? false,
        smsEnabled: data.smsEnabled ?? false,
      },
    });

    return alert;
  },

  async updateAlert(userId: string, alertId: string, data: {
    name?: string;
    keywords?: string[];
    categories?: string[];
    states?: string[];
    minValue?: number | null;
    maxValue?: number | null;
    organizations?: string[];
    tenderTypes?: string[];
    frequency?: 'INSTANT' | 'DAILY' | 'WEEKLY';
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    whatsappEnabled?: boolean;
    smsEnabled?: boolean;
  }) {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    if (alert.userId !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.categories !== undefined) updateData.categories = data.categories;
    if (data.states !== undefined) updateData.states = data.states;
    if (data.minValue !== undefined) updateData.minValue = data.minValue;
    if (data.maxValue !== undefined) updateData.maxValue = data.maxValue;
    if (data.organizations !== undefined) updateData.organizations = data.organizations;
    if (data.tenderTypes !== undefined) updateData.tenderTypes = data.tenderTypes;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled;
    if (data.pushEnabled !== undefined) updateData.pushEnabled = data.pushEnabled;
    if (data.whatsappEnabled !== undefined) updateData.whatsappEnabled = data.whatsappEnabled;
    if (data.smsEnabled !== undefined) updateData.smsEnabled = data.smsEnabled;

    return prisma.alert.update({
      where: { id: alertId },
      data: updateData,
    });
  },

  async deleteAlert(userId: string, alertId: string) {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    if (alert.userId !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    await prisma.alert.delete({ where: { id: alertId } });
    return { message: 'Alert deleted successfully' };
  },

  async toggleAlert(userId: string, alertId: string, isActive: boolean) {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    if (alert.userId !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    return prisma.alert.update({
      where: { id: alertId },
      data: { isActive },
    });
  },

  async getAlerts(userId: string) {
    return prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async testAlert(userId: string, alertId: string) {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    if (alert.userId !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

    const where = buildTenderWhereClause(alert);

    const tenders = await prisma.tender.findMany({
      where,
      orderBy: { publishedDate: 'desc' },
      take: 10,
    });

    return { alert, matchingTenders: tenders, matchCount: tenders.length };
  },

  async matchTendersToAlerts(frequency: 'INSTANT' | 'DAILY' | 'WEEKLY') {
    const alerts = await prisma.alert.findMany({
      where: {
        isActive: true,
        frequency: frequency as AlertFrequency,
      },
    });

    let totalMatches = 0;

    for (const alert of alerts) {
      const sinceDate = getSinceDate(alert, frequency);
      const where = buildTenderWhereClause(alert, sinceDate);

      const matchingTenders = await prisma.tender.findMany({
        where,
        orderBy: { publishedDate: 'desc' },
        take: 50,
      });

      if (matchingTenders.length > 0) {
        // Create IN_APP notifications for each matching tender
        const notificationData = matchingTenders.map((tender) => ({
          userId: alert.userId,
          type: 'TENDER_ALERT' as const,
          channel: 'IN_APP' as const,
          title: `New tender match: ${alert.name}`,
          message: `"${tender.title}" from ${tender.organization} matches your alert "${alert.name}".`,
          data: {
            alertId: alert.id,
            tenderId: tender.id,
            tenderTitle: tender.title,
            organization: tender.organization,
            estimatedValue: tender.estimatedValue,
            deadline: tender.bidSubmissionDeadline,
          },
        }));

        await prisma.notification.createMany({ data: notificationData });

        // Update alert's lastMatchedAt and matchCount
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            lastMatchedAt: new Date(),
            matchCount: { increment: matchingTenders.length },
          },
        });

        totalMatches += matchingTenders.length;
      }
    }

    return { alertsProcessed: alerts.length, totalMatches };
  },
};

function getSinceDate(
  alert: { lastMatchedAt: Date | null },
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY'
): Date {
  if (alert.lastMatchedAt) return alert.lastMatchedAt;

  const now = new Date();
  switch (frequency) {
    case 'INSTANT':
      // Last 1 hour for instant alerts without prior match
      return new Date(now.getTime() - 60 * 60 * 1000);
    case 'DAILY':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'WEEKLY':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function buildTenderWhereClause(
  alert: {
    keywords: string[];
    categories: string[];
    states: string[];
    minValue: number | null;
    maxValue: number | null;
    organizations: string[];
    tenderTypes: string[];
  },
  sinceDate?: Date
): Prisma.TenderWhereInput {
  const where: Prisma.TenderWhereInput = {
    status: 'ACTIVE',
  };

  // Keywords: match against title or description
  if (alert.keywords.length > 0) {
    where.OR = alert.keywords.map((keyword) => ({
      OR: [
        { title: { contains: keyword, mode: 'insensitive' as const } },
        { description: { contains: keyword, mode: 'insensitive' as const } },
      ],
    }));
  }

  // Categories filter
  if (alert.categories.length > 0) {
    const validCats = alert.categories
      .map((c) => c.toUpperCase())
      .filter((c) => ['WORKS', 'GOODS', 'SERVICES', 'CONSULTANCY'].includes(c));
    if (validCats.length > 0) {
      where.category = { in: validCats as any };
    }
  }

  // States filter
  if (alert.states.length > 0) {
    where.state = { in: alert.states };
  }

  // Value range filter
  if (alert.minValue !== null || alert.maxValue !== null) {
    where.estimatedValue = {};
    if (alert.minValue !== null) {
      where.estimatedValue.gte = alert.minValue;
    }
    if (alert.maxValue !== null) {
      where.estimatedValue.lte = alert.maxValue;
    }
  }

  // Organizations filter
  if (alert.organizations.length > 0) {
    where.organization = { in: alert.organizations };
  }

  // Tender types filter
  if (alert.tenderTypes.length > 0) {
    where.tenderType = { in: alert.tenderTypes as any };
  }

  // Since date filter (for matching jobs)
  if (sinceDate) {
    where.publishedDate = { gte: sinceDate };
  }

  return where;
}
