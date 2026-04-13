import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { referralService } from './service';
import { AppError } from '../../shared/middleware/error-handler';

const applyReferralSchema = z.object({
  code: z.string().min(1, 'Referral code is required'),
});

export const referralController = {
  async getOrGenerateCode(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const code = await referralService.generateReferralCode(userId);
      res.json({ success: true, data: { code } });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const stats = await referralService.getReferralStats(userId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async applyReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { code } = applyReferralSchema.parse(req.body);
      const result = await referralService.processReferral(code, userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const history = await referralService.getReferralHistory(userId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  },
};
