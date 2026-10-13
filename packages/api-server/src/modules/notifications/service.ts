import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { NotificationType, NotificationChannel } from '@prisma/client';

/**
 * Drop the cached unread count so the next read recounts from the database.
 *
 * The unread badge is served from a 60s Redis cache, but only
 * `createNotification` below used to invalidate it. Every other code path that
 * inserts notifications — alert matches, corrigendum updates, payment events,
 * admin broadcasts — wrote straight through Prisma, so the badge kept serving
 * a stale count (typically 0) while unread notifications were already sitting
 * in the user's inbox. Those paths now call this.
 *
 * Accepts many user ids because the bulk senders insert for a whole audience in
 * one `createMany`.
 */
export async function invalidateUnreadCount(userIds: string | string[]): Promise<void> {
  const ids = Array.from(new Set(Array.isArray(userIds) ? userIds : [userIds])).filter(Boolean);
  if (ids.length === 0) return;

  await redis.del(...ids.map((id) => `unread:${id}`));
}

export const notificationService = {
  async getNotifications(
    userId: string,
    { page = 1, limit = 20, unreadOnly }: { page?: number; limit?: number; unreadOnly?: boolean }
  ) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }
    if (notification.userId !== userId) {
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    // Invalidate unread count cache
    await redis.del(`unread:${userId}`);

    return updated;
  },

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    // Invalidate unread count cache
    await redis.del(`unread:${userId}`);

    return { markedCount: result.count };
  },

  async markReadByIds(userId: string, ids: string[]) {
    const result = await prisma.notification.updateMany({
      where: { userId, id: { in: ids }, isRead: false },
      data: { isRead: true },
    });

    // Invalidate unread count cache
    await redis.del(`unread:${userId}`);

    return { markedCount: result.count };
  },

  async getUnreadCount(userId: string) {
    // Try Redis cache first
    const cached = await redis.get(`unread:${userId}`);
    if (cached !== null) {
      return { count: parseInt(cached, 10) };
    }

    // Cache miss: count from DB
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    // Cache for 60 seconds
    await redis.set(`unread:${userId}`, count.toString(), 'EX', 60);

    return { count };
  },

  async createNotification(
    userId: string,
    data: {
      type: NotificationType;
      channel: NotificationChannel;
      title: string;
      message: string;
      data?: any;
    }
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: data.type,
        channel: data.channel,
        title: data.title,
        message: data.message,
        data: data.data ?? undefined,
      },
    });

    await invalidateUnreadCount(userId);

    return notification;
  },

  async updateNotificationPreferences(
    userId: string,
    preferences: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      whatsappEnabled?: boolean;
      smsEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    }
  ) {
    const key = `notif_prefs:${userId}`;
    const fields: Record<string, string> = {};

    if (preferences.emailEnabled !== undefined) fields.emailEnabled = String(preferences.emailEnabled);
    if (preferences.pushEnabled !== undefined) fields.pushEnabled = String(preferences.pushEnabled);
    if (preferences.whatsappEnabled !== undefined) fields.whatsappEnabled = String(preferences.whatsappEnabled);
    if (preferences.smsEnabled !== undefined) fields.smsEnabled = String(preferences.smsEnabled);
    if (preferences.quietHoursStart !== undefined) fields.quietHoursStart = preferences.quietHoursStart;
    if (preferences.quietHoursEnd !== undefined) fields.quietHoursEnd = preferences.quietHoursEnd;

    if (Object.keys(fields).length > 0) {
      await redis.hmset(key, fields);
    }

    // Return the full preferences
    return this.getNotificationPreferences(userId);
  },

  async getNotificationPreferences(userId: string) {
    const key = `notif_prefs:${userId}`;
    const prefs = await redis.hgetall(key);

    // Return defaults if nothing stored
    return {
      emailEnabled: prefs.emailEnabled !== undefined ? prefs.emailEnabled === 'true' : true,
      pushEnabled: prefs.pushEnabled !== undefined ? prefs.pushEnabled === 'true' : true,
      whatsappEnabled: prefs.whatsappEnabled !== undefined ? prefs.whatsappEnabled === 'true' : false,
      smsEnabled: prefs.smsEnabled !== undefined ? prefs.smsEnabled === 'true' : false,
      quietHoursStart: prefs.quietHoursStart || null,
      quietHoursEnd: prefs.quietHoursEnd || null,
    };
  },
};
