import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { calendarService } from './service';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

const dateRangeSchema = z.object({
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid startDate' }),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid endDate' }),
});

const exportSchema = z.object({
  tenderIds: z.string().min(1, 'tenderIds is required'),
});

export const calendarController = {
  async getTendersByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const userId = (req as any).user?.id;

      const result = await calendarService.getTendersByDateRange(
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async exportToICal(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenderIds } = exportSchema.parse(req.query);
      const ids = tenderIds.split(',').map((id) => id.trim()).filter(Boolean);

      if (ids.length === 0) {
        throw new AppError('No tender IDs provided', 400, 'INVALID_INPUT');
      }

      const tenders = await prisma.tender.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          organization: true,
          category: true,
          estimatedValue: true,
          bidSubmissionDeadline: true,
          sourceUrl: true,
        },
      });

      if (tenders.length === 0) {
        throw new AppError('No tenders found', 404, 'NOT_FOUND');
      }

      const icsContent = calendarService.exportToICal(tenders);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tenders.ics"');
      res.send(icsContent);
    } catch (error) {
      next(error);
    }
  },
};
