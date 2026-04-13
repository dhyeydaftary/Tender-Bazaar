import { prisma } from '../../../config/database';

interface BroadcastPayload {
  title: string;
  message: string;
  channel: string;
  type?: string;
  userFilter?: {
    role?: string;
    planSlug?: string;
    state?: string;
  };
}

interface NotificationListFilters {
  page: number;
  limit: number;
  type?: string;
  channel?: string;
  sortOrder: string;
}

export const notificationsService = {
  async getNotificationList(filters: NotificationListFilters) {
    const { page, limit, type, channel, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (channel) where.channel = channel;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: sortOrder as any },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total, page, limit };
  },

  async sendBroadcast(payload: BroadcastPayload) {
    const { title, message, channel, type, userFilter } = payload;

    const userWhere: any = {};

    if (userFilter?.role) {
      userWhere.role = userFilter.role;
    }

    if (userFilter?.planSlug) {
      if (userFilter.planSlug === 'free') {
        userWhere.subscription = null;
      } else {
        userWhere.subscription = {
          plan: { slug: userFilter.planSlug },
          status: 'ACTIVE',
        };
      }
    }

    if (userFilter?.state) {
      userWhere.companyProfile = {
        statesOperated: { has: userFilter.state },
      };
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    if (users.length === 0) {
      return { sent: 0, message: 'No matching users found' };
    }

    // Batch create notifications
    const notifications = users.map((u) => ({
      userId: u.id,
      type: (type || 'SYSTEM') as any,
      channel: channel as any,
      title,
      message,
      data: { broadcast: true, sentAt: new Date().toISOString() },
    }));

    await prisma.notification.createMany({ data: notifications });

    return {
      sent: users.length,
      message: `Broadcast sent to ${users.length} users`,
      channel,
      type: type || 'SYSTEM',
    };
  },

  async getNotificationStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, sentLast24h, sentLast7d, byType, byChannel, readRate] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { createdAt: { gte: last24h } } }),
      prisma.notification.count({ where: { createdAt: { gte: last7d } } }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: true,
        orderBy: { _count: { type: 'desc' } },
      }),
      prisma.notification.groupBy({
        by: ['channel'],
        _count: true,
        orderBy: { _count: { channel: 'desc' } },
      }),
      prisma.notification.aggregate({
        where: { isRead: true },
        _count: true,
      }),
    ]);

    return {
      total,
      sentLast24h,
      sentLast7d,
      readRate: total > 0 ? Math.round((readRate._count / total) * 100) : 0,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
    };
  },
};
