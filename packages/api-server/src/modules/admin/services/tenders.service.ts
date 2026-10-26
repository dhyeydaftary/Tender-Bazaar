import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';
import { enqueueTenderIndex } from '../../../queue/tender-index-queue';
import { OPEN_TENDER_STATUSES, CLOSED_TENDER_STATUSES } from '../../tenders/status-groups';

interface TenderListFilters {
  page: number;
  limit: number;
  search?: string;
  sourcePortal?: string;
  category?: string;
  status?: string;
  state?: string;
  sortBy: string;
  sortOrder: string;
}

export const tendersService = {
  async getTenderList(filters: TenderListFilters) {
    const { page, limit, search, sourcePortal, category, status, state, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (sourcePortal) {
      where.sourcePortal = { contains: sourcePortal, mode: 'insensitive' };
    }
    if (category) where.category = category;
    if (status) where.status = status;
    if (state) where.state = state;

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [tenders, total] = await Promise.all([
      prisma.tender.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          referenceNumber: true,
          organization: true,
          department: true,
          tenderType: true,
          category: true,
          status: true,
          state: true,
          district: true,
          estimatedValue: true,
          emdAmount: true,
          publishedDate: true,
          bidSubmissionDeadline: true,
          bidOpeningDate: true,
          sourcePortal: true,
          sourceUrl: true,
          viewCount: true,
          createdAt: true,
          _count: {
            select: {
              savedBy: true,
              eligibilityChecks: true,
              documents: true,
            },
          },
        },
      }),
      prisma.tender.count({ where }),
    ]);

    return { tenders, total, page, limit };
  },

  async getTenderDetail(tenderId: string) {
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        documents: true,
        results: true,
        _count: {
          select: { savedBy: true, eligibilityChecks: true },
        },
      },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    return tender;
  },

  async updateTender(tenderId: string, data: Record<string, any>) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    const fields = [
      'title', 'description', 'category', 'status', 'state', 'district',
      'organization', 'department', 'estimatedValue', 'emdAmount',
      'tenderType', 'reservedForMSME', 'reservedForStartups',
    ];

    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== (tender as any)[field]) {
        changes[field] = { old: (tender as any)[field], new: data[field] };
        updateData[field] = data[field];
      }
    }

    // Date fields
    const dateFields = ['bidSubmissionDeadline', 'bidOpeningDate', 'preBidMeetingDate'];
    for (const field of dateFields) {
      if (data[field] !== undefined) {
        updateData[field] = new Date(data[field]);
        changes[field] = { old: (tender as any)[field], new: data[field] };
      }
    }

    const updated = await prisma.tender.update({
      where: { id: tenderId },
      data: updateData,
    });

    // Keep Elasticsearch in step with the admin edit. Best-effort: a failed
    // enqueue is logged and never fails the update (PostgreSQL is the source of
    // truth); the boot-time reindex is the fallback.
    if (Object.keys(updateData).length > 0) {
      await enqueueTenderIndex(tenderId, 'index', 'admin:update');
    }

    return { tender: updated, changes };
  },

  async deleteTender(tenderId: string) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    await prisma.tender.delete({ where: { id: tenderId } });

    // Remove it from the search index too, with the queue's retry behaviour.
    await enqueueTenderIndex(tenderId, 'delete', 'admin:delete');

    return { message: 'Tender deleted successfully', tender: { id: tender.id, title: tender.title } };
  },

  async getTenderStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenders,
      activeTenders,
      closedTenders,
      tendersThisMonth,
      byCategory,
      byStatus,
      byState,
      byPortal,
      avgValue,
    ] = await Promise.all([
      prisma.tender.count(),
      prisma.tender.count({ where: { status: { in: [...OPEN_TENDER_STATUSES] } } }),
      prisma.tender.count({ where: { status: { in: [...CLOSED_TENDER_STATUSES] } } }),
      prisma.tender.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.tender.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
      prisma.tender.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.tender.groupBy({
        by: ['state'],
        _count: true,
        orderBy: { _count: { state: 'desc' } },
        take: 15,
      }),
      prisma.tender.groupBy({
        by: ['sourcePortal'],
        _count: true,
        orderBy: { _count: { sourcePortal: 'desc' } },
      }),
      prisma.tender.aggregate({
        where: { estimatedValue: { not: null } },
        _avg: { estimatedValue: true },
        _max: { estimatedValue: true },
        _min: { estimatedValue: true },
      }),
    ]);

    return {
      total: totalTenders,
      active: activeTenders,
      closed: closedTenders,
      addedThisMonth: tendersThisMonth,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        count: (c._count as any)?._all ?? (c._count as any)?.category ?? (typeof c._count === "number" ? c._count : 0),
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: (s._count as any)?._all ?? (s._count as any)?.status ?? (typeof s._count === "number" ? s._count : 0),
      })),
      byState: byState.map((s) => ({
        state: s.state,
        count: (s._count as any)?._all ?? (s._count as any)?.state ?? (typeof s._count === "number" ? s._count : 0),
      })),
      byPortal: byPortal.map((p) => ({
        portal: p.sourcePortal,
        count: (p._count as any)?._all ?? (p._count as any)?.sourcePortal ?? (typeof p._count === "number" ? p._count : 0),
      })),
      valueStats: {
        average: avgValue._avg.estimatedValue || 0,
        max: avgValue._max.estimatedValue || 0,
        min: avgValue._min.estimatedValue || 0,
      },
    };
  },
};
