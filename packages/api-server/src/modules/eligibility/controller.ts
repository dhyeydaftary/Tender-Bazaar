import { Request, Response, NextFunction } from 'express';
import { eligibilityService } from './service';
import { checkEligibilitySchema, bulkEligibilitySchema, eligibilityHistorySchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const eligibilityController = {
  async checkEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { tenderId } = checkEligibilitySchema.parse(req.body);
      const result = await eligibilityService.checkEligibility(userId, tenderId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async bulkCheckEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { tenderIds } = bulkEligibilitySchema.parse(req.body);
      const results = await eligibilityService.getBulkEligibility(userId, tenderIds);

      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  },

  async getEligibilityHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { page, limit } = eligibilityHistorySchema.parse(req.query);
      const result = await eligibilityService.getEligibilityHistory(userId, page, limit);

      res.json({ success: true, data: result.checks, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },

  async getMatchingTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const results = await eligibilityService.getMatchingTenders(userId);

      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  },
};
