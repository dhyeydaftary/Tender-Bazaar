import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { exportService } from './service';
import { AppError } from '../../shared/middleware/error-handler';

const tenderIdsSchema = z.object({
  ids: z.string().min(1, 'ids is required'),
});

export const exportController = {
  async exportTendersCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = tenderIdsSchema.parse(req.query);
      const tenderIds = ids.split(',').map((id) => id.trim()).filter(Boolean);

      if (tenderIds.length === 0) {
        throw new AppError('No tender IDs provided', 400, 'INVALID_INPUT');
      }

      const csv = await exportService.exportTendersCSV(tenderIds);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tenders-export.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async exportTenderPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const html = await exportService.exportTenderPDF(id);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="tender-${id}.html"`);
      res.send(html);
    } catch (error) {
      next(error);
    }
  },

  async exportEligibilityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { checkId } = req.params;
      const html = await exportService.exportEligibilityReport(checkId, userId);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="eligibility-report-${checkId}.html"`);
      res.send(html);
    } catch (error) {
      next(error);
    }
  },

  async exportSavedTendersCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const csv = await exportService.exportSavedTendersCSV(userId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="saved-tenders-export.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },
};
