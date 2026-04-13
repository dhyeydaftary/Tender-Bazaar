import { Request, Response, NextFunction } from 'express';
import { notificationService } from './service';
import { getNotificationsSchema, notificationSettingsSchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const notificationController = {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { page, limit, unreadOnly } = getNotificationsSchema.parse(req.query);
      const result = await notificationService.getNotifications(userId, { page, limit, unreadOnly });

      res.json({ success: true, data: result.notifications, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const notification = await notificationService.markAsRead(userId, req.params.id);

      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await notificationService.markAllAsRead(userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await notificationService.getUnreadCount(userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const preferences = notificationSettingsSchema.parse(req.body);
      const result = await notificationService.updateNotificationPreferences(userId, preferences);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await notificationService.getNotificationPreferences(userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
