import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from './service';
import { configureWebhookSchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const apiKeyController = {
  async generateKey(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await apiKeyService.generateApiKey(userId);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getKeyInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const info = await apiKeyService.getApiKeyInfo(userId);

      if (!info) {
        return res.json({
          success: true,
          data: null,
          meta: { message: 'No API key found. Generate one to get started.' },
        });
      }

      res.json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  },

  async regenerateKey(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const result = await apiKeyService.regenerateApiKey(userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async revokeKey(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      await apiKeyService.revokeApiKey(userId);

      res.json({ success: true, data: { message: 'API key revoked successfully' } });
    } catch (error) {
      next(error);
    }
  },

  async configureWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = configureWebhookSchema.parse(req.body);
      const config = await apiKeyService.configureWebhook(userId, data);

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },

  async getWebhookConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const config = await apiKeyService.getWebhookConfig(userId);

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },
};
