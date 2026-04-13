import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

export const savedService = {
  async saveTender(userId: string, tenderId: string) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');

    const existing = await prisma.savedTender.findUnique({
      where: { userId_tenderId: { userId, tenderId } },
    });
    if (existing) throw new AppError('Tender already saved', 409, 'ALREADY_SAVED');

    return prisma.savedTender.create({
      data: { userId, tenderId },
      include: { tender: true },
    });
  },

  async unsaveTender(userId: string, tenderId: string) {
    await prisma.savedTender.delete({
      where: { userId_tenderId: { userId, tenderId } },
    });
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
