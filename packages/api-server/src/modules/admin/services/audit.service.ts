import { prisma } from '../../../config/database';

interface AuditLogEntry {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface AuditLogFilters {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  entity?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  sortOrder: string;
}

export const auditService = {
  /**
   * Create an audit log entry. Fire-and-forget — never throws.
   */
  async log(entry: AuditLogEntry) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          actorRole: entry.actorRole as any,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId || null,
          changes: entry.changes || undefined,
          metadata: entry.metadata || undefined,
        },
      });
    } catch (err) {
      console.error('[AuditLog] Failed to write audit log:', err);
    }
  },

  async getAuditLogs(filters: AuditLogFilters) {
    const { page, limit, search, action, entity, actorId, startDate, endDate, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (action) where.action = { startsWith: action };
    if (entity) where.entity = entity;
    if (actorId) where.actorId = actorId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sortOrder as any },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  },

  async getAuditLogStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalLogs, logsLast24h, logsLast7d, byAction, byEntity] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        _count: true,
        orderBy: { _count: { entity: 'desc' } },
      }),
    ]);

    return {
      totalLogs,
      logsLast24h,
      logsLast7d,
      byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
      byEntity: byEntity.map((e) => ({ entity: e.entity, count: e._count })),
    };
  },
};
