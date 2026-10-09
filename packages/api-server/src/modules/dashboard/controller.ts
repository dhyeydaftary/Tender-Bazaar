import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './service';
import { AppError } from '../../shared/middleware/error-handler';

export const dashboardController = {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = await dashboardService.getDashboard(userId);

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
