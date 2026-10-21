import { Request, Response, NextFunction } from 'express';
import { bidAssistantService } from './service';
import { analyzeTenderSchema, analyzeParamsSchema, strategyParamsSchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const bidAssistantController = {
  async analyzeTender(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const tenderId = (req.params.tenderId || req.body?.tenderId) as string;
      if (!tenderId) {
        throw new AppError('Tender ID is required', 400, 'TENDER_ID_REQUIRED');
      }

      const documentText = (req.body?.documentText || req.body?.text || '') as string;

      const result = await bidAssistantService.analyzeTenderDocument(userId, tenderId, documentText);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getBidStrategy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { tenderId } = strategyParamsSchema.parse(req.params);

      const result = await bidAssistantService.getBidStrategy(userId, tenderId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = await bidAssistantService.getOverview(userId);

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
