import { Request, Response, NextFunction } from 'express';
import { savedService } from './service';
import { AppError } from '../../shared/middleware/error-handler';

export const savedController = {
  async saveTender(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      const result = await savedService.saveTender(userId, req.params.tenderId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async unsaveTender(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      const result = await savedService.unsaveTender(userId, req.params.tenderId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getSavedTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await savedService.getSavedTenders(userId, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async updateNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      const { notes } = req.body;
      const result = await savedService.updateNotes(userId, req.params.tenderId, notes || '');
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
