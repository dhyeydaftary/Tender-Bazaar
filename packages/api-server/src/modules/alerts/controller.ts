import { Request, Response, NextFunction } from 'express';
import { alertService } from './service';
import { createAlertSchema, updateAlertSchema, toggleAlertSchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const alertController = {
  async createAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = createAlertSchema.parse(req.body);
      const alert = await alertService.createAlert(userId, data);

      res.status(201).json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  },

  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const alerts = await alertService.getAlerts(userId);

      res.json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  },

  async updateAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = updateAlertSchema.parse(req.body);
      const alert = await alertService.updateAlert(userId, req.params.id, data);

      res.json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  },

  async deleteAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await alertService.deleteAlert(userId, req.params.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async toggleAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { isActive } = toggleAlertSchema.parse(req.body);
      const alert = await alertService.toggleAlert(userId, req.params.id, isActive);

      res.json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  },

  async testAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await alertService.testAlert(userId, req.params.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
