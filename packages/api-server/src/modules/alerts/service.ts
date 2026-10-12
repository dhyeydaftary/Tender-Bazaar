import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { AlertFrequency, Prisma } from '@prisma/client';
import { invalidateUnreadCount, notificationService } from '../notifications/service';
import { planConfigService } from '../subscriptions/plan-config.service';
import { publishNotificationJob, type NotificationJobChannel } from '../../queue/notification-publisher';

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
        // Deduplication: skip tenders that already produced an in-app notification
        // for this user and alert.
        const existingNotifs = await prisma.notification.findMany({
          where: {
            userId: alert.userId,
            type: 'TENDER_ALERT',
            channel: 'IN_APP',
            createdAt: { gte: sinceDate },
          },
          select: { data: true },
        });

        const alreadyNotifiedTenderIds = new Set(
          existingNotifs
            .map((n) => (n.data as any)?.tenderId)
            .filter(Boolean),
        );

        const newMatchingTenders = matchingTenders.filter(
          (t) => !alreadyNotifiedTenderIds.has(t.id),
        );

        if (newMatchingTenders.length > 0) {
          // Create IN_APP notifications for each matching tender
          const notificationData = newMatchingTenders.map((tender) => ({
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
          await invalidateUnreadCount(notificationData.map((n) => n.userId));

          // Hand the match to the notification worker for the user's external
          // channels. Until now this step did not exist: in-app rows were written
          // and nothing was ever enqueued, so email/WhatsApp/SMS/push never fired
          // for an alert match.
          //
          // One job per channel per alert run (not per tender) — the templates
          // take the whole match set, and per-tender fan-out would be a burst of
          // near-identical messages for the same alert.
          await enqueueAlertNotifications(alert, newMatchingTenders);

          // Update alert's lastMatchedAt and matchCount
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              lastMatchedAt: new Date(),
              matchCount: { increment: newMatchingTenders.length },
            },
          });

          totalMatches += newMatchingTenders.length;
        } else {
          // Tenders were found but already notified; advance watermark
          await prisma.alert.update({
            where: { id: alert.id },
            data: { lastMatchedAt: new Date() },
          });
        }
      }
    }

    return { alertsProcessed: alerts.length, totalMatches };
  },
};

/**
 * Enqueue external-channel notification jobs for one alert's matches.
 *
 * Preserves the channel rules already in the codebase rather than inventing
 * new ones. A channel is used only when ALL of the following agree:
 *
 *   1. the alert opts into it      — Alert.{email,push,whatsapp,sms}Enabled
 *   2. the user opts into it       — notificationService.getNotificationPreferences()
 *                                    (Redis `notif_prefs:<userId>`; defaults
 *                                    email/push on, whatsapp/sms off)
 *   3. the plan permits it         — SubscriptionPlan.{emailAlerts,pushAlerts,
 *                                    whatsappAlerts}
 *
 * SMS has no plan flag in the schema (there is no `smsAlerts` column), so it is
 * gated on the alert flag and the user preference only. That gap is left as-is
 * deliberately rather than inventing an entitlement.
 *
 * IN_APP is not enqueued here — those rows are written directly by the caller,
 * which is what the bell and notifications page read.
 */
async function enqueueAlertNotifications(
  alert: {
    id: string;
    userId: string;
    name: string;
    emailEnabled: boolean;
    pushEnabled: boolean;
    whatsappEnabled: boolean;
    smsEnabled: boolean;
  },
  matchingTenders: Array<{
    id: string;
    title: string;
    organization: string;
    estimatedValue?: number | null;
    bidSubmissionDeadline?: Date | string | null;
    state?: string | null;
    category?: string | null;
  }>,
): Promise<void> {
  try {
    const [prefs, plan, user] = await Promise.all([
      notificationService.getNotificationPreferences(alert.userId),
      planConfigService.getUserPlan(alert.userId),
      prisma.user.findUnique({
        where: { id: alert.userId },
        select: { email: true, phone: true },
      }),
    ]);

    if (!user) return; // user removed between match and dispatch

    // Most recent session's FCM token, if the client ever registered one.
    const session = await prisma.session.findFirst({
      where: { userId: alert.userId, fcmToken: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { fcmToken: true },
    });

    const channels: Array<{ channel: NotificationJobChannel; allowed: boolean }> = [
      {
        channel: 'EMAIL',
        allowed: alert.emailEnabled && prefs.emailEnabled && plan.emailAlerts === true && !!user.email,
      },
      {
        channel: 'PUSH',
        allowed: alert.pushEnabled && prefs.pushEnabled && plan.pushAlerts === true && !!session?.fcmToken,
      },
      {
        channel: 'WHATSAPP',
        allowed:
          alert.whatsappEnabled && prefs.whatsappEnabled && plan.whatsappAlerts === true && !!user.phone,
      },
      {
        // No `smsAlerts` plan column exists; see the note above.
        channel: 'SMS',
        allowed: alert.smsEnabled && prefs.smsEnabled && !!user.phone,
      },
    ];

    const title = `New tender match: ${alert.name}`;
    const message =
      matchingTenders.length === 1
        ? `"${matchingTenders[0].title}" matches your alert "${alert.name}".`
        : `${matchingTenders.length} new tenders match your alert "${alert.name}".`;

    for (const { channel, allowed } of channels) {
      if (!allowed) continue;

      await publishNotificationJob({
        userId: alert.userId,
        type: 'TENDER_ALERT',
        channel,
        title,
        message,
        data: {
          alertId: alert.id,
          alertName: alert.name,
          // The worker's TENDER_ALERT templates read `tenders`.
          tenders: matchingTenders.map((t) => ({
            id: t.id,
            title: t.title,
            organization: t.organization,
            estimatedValue: t.estimatedValue ?? undefined,
            bidSubmissionDeadline: t.bidSubmissionDeadline ?? new Date(),
            state: t.state ?? undefined,
            category: t.category ?? undefined,
          })),
        },
        recipientEmail: channel === 'EMAIL' ? user.email : undefined,
        recipientPhone: channel === 'WHATSAPP' || channel === 'SMS' ? user.phone ?? undefined : undefined,
        fcmToken: channel === 'PUSH' ? session?.fcmToken ?? undefined : undefined,
      });
    }
  } catch (error) {
    // Never let dispatch failures roll back matches already recorded. Logged
    // without PII — alert id only.
    console.error(
      `[Alerts] Failed to enqueue notifications for alert ${alert.id}:`,
      (error as Error).message,
    );
  }
}

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
    where.category = { in: alert.categories as any };
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
