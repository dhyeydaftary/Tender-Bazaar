import { Request, Response, NextFunction } from 'express';
import { comparisonService } from './service';
import { compareTendersSchema } from './validation';

export const comparisonController = {
  async compareTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenderIds } = compareTendersSchema.parse(req.body);
      const userId = (req as any).user?.id || undefined;

      const result = await comparisonService.compareTenders(tenderIds, userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
