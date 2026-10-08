import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';

interface TicketListFilters {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  sortBy: string;
  sortOrder: string;
}

interface TicketUpdateData {
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string | null;
}

export const supportService = {
  async getTicketList(filters: TicketListFilters) {
    const { page, limit, search, status, priority, category, assignedTo, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (assignedTo) where.assignedTo = assignedTo;

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: tickets.map((t) => ({
        ...t,
        messageCount: t._count.messages,
      })),
      total,
      page,
      limit,
    };
  },

  async getTicketDetail(ticketId: string) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            subscription: {
              select: { plan: { select: { name: true } }, status: true },
            },
            companyProfile: {
              select: { companyName: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new AppError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return ticket;
  },

  async updateTicket(ticketId: string, data: TicketUpdateData) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (data.status !== undefined && data.status !== ticket.status) {
      changes.status = { old: ticket.status, new: data.status };
      updateData.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
        updateData.resolvedAt = new Date();
      }
    }

    if (data.priority !== undefined && data.priority !== ticket.priority) {
      changes.priority = { old: ticket.priority, new: data.priority };
      updateData.priority = data.priority;
    }

    if (data.category !== undefined && data.category !== ticket.category) {
      changes.category = { old: ticket.category, new: data.category };
      updateData.category = data.category;
    }

    if (data.assignedTo !== undefined && data.assignedTo !== ticket.assignedTo) {
      changes.assignedTo = { old: ticket.assignedTo, new: data.assignedTo };
      updateData.assignedTo = data.assignedTo;
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return { ticket: updated, changes };
  },

  async replyToTicket(ticketId: string, senderId: string, senderRole: string, message: string) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const reply = await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId,
        senderRole: senderRole as any,
        message,
      },
    });

    // Auto-update ticket status if admin replies and ticket is OPEN
    if ((senderRole === 'ADMIN' || senderRole === 'SUPER_ADMIN') && ticket.status === 'OPEN') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return reply;
  },

  async getTicketStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      newLast24h,
      newLast7d,
      byPriority,
      byCategory,
      avgResolutionTime,
    ] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'WAITING' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: last24h } } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: last7d } } }),
      prisma.supportTicket.groupBy({
        by: ['priority'],
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
      // Calculate average resolution time for resolved tickets
      prisma.supportTicket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        orderBy: { resolvedAt: 'desc' },
        take: 100,
      }),
    ]);

    // Calculate average resolution time in hours
    let avgResolutionHours = 0;
    if (avgResolutionTime.length > 0) {
      const totalHours = avgResolutionTime.reduce((sum, t) => {
        const diff = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        return sum + diff;
      }, 0);
      avgResolutionHours = Math.round((totalHours / avgResolutionTime.length) * 10) / 10;
    }

    return {
      total,
      byStatus: { open, inProgress, waiting, resolved, closed },
      newLast24h,
      newLast7d,
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: (p._count as any)?._all ?? (p._count as any)?.priority ?? (typeof p._count === 'number' ? p._count : 0),
      })),
      byCategory: byCategory.map((c) => ({
        category: c.category || 'uncategorized',
        count: (c._count as any)?._all ?? (c._count as any)?.category ?? (typeof c._count === 'number' ? c._count : 0),
      })),
      avgResolutionHours,
    };
  },
};
