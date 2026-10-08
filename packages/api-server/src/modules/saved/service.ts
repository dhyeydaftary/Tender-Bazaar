import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

export const savedService = {
  async saveTender(userId: string, tenderId: string) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');

    // Idempotent: saving an already-saved tender returns the existing record
    // instead of failing. The unique constraint on (userId, tenderId) still
    // guarantees no duplicate row is ever created, and a repeated click or a
    // retried request can no longer surface as an error.
    const existing = await prisma.savedTender.findUnique({
      where: { userId_tenderId: { userId, tenderId } },
      include: { tender: true },
    });
    if (existing) return existing;

    return prisma.savedTender.create({
      data: { userId, tenderId },
      include: { tender: true },
    });
  },

  async unsaveTender(userId: string, tenderId: string) {
    // Idempotent: deleteMany matches zero rows instead of throwing P2025 when
    // the tender was already unsaved.
    await prisma.savedTender.deleteMany({
      where: { userId, tenderId },
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
