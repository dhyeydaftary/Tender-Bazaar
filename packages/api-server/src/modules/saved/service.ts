import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

export const savedService = {
  async saveTender(userId: string, tenderId: string) {
    let tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      tender = await prisma.tender.findFirst({
        where: {
          OR: [
            { sourceId: tenderId },
            { referenceNumber: tenderId },
          ],
        },
      });
    }
    if (!tender) throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');

    const existing = await prisma.savedTender.findUnique({
      where: { userId_tenderId: { userId, tenderId: tender.id } },
      include: { tender: true },
    });
    if (existing) return existing;

    await prisma.subscription.updateMany({
      where: { userId },
      data: { savedTendersCount: { increment: 1 } },
    }).catch(() => {});

    return prisma.savedTender.create({
      data: { userId, tenderId: tender.id },
      include: { tender: true },
    });
  },

  async unsaveTender(userId: string, tenderId: string) {
    let tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      tender = await prisma.tender.findFirst({
        where: {
          OR: [
            { sourceId: tenderId },
            { referenceNumber: tenderId },
          ],
        },
      });
    }
    const realId = tender ? tender.id : tenderId;
    const deleted = await prisma.savedTender.deleteMany({
      where: {
        userId,
        OR: [
          { tenderId: realId },
          { id: tenderId },
        ],
      },
    });

    if (deleted.count > 0) {
      await prisma.subscription.updateMany({
        where: { userId, savedTendersCount: { gt: 0 } },
        data: { savedTendersCount: { decrement: 1 } },
      }).catch(() => {});
    }

    return { message: 'Tender unsaved' };
  },

  async getSavedTenders(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [tenders, total] = await Promise.all([
      prisma.savedTender.findMany({
        where: { userId },
        include: { tender: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.savedTender.count({ where: { userId } }),
    ]);
    return { tenders, total, page, limit };
  },

  async updateNotes(userId: string, tenderId: string, notes: string) {
    return prisma.savedTender.update({
      where: { userId_tenderId: { userId, tenderId } },
      data: { notes },
    });
  },

  async isSaved(userId: string, tenderId: string) {
    const saved = await prisma.savedTender.findUnique({
      where: { userId_tenderId: { userId, tenderId } },
    });
    return !!saved;
  },
};
