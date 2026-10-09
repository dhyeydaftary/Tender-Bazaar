import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchService } from './service';
import { AppError } from '../../shared/middleware/error-handler';

const saveSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().default(''),
  filters: z.object({
    category: z.string().optional(),
    state: z.string().optional(),
    tenderType: z.string().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    organizations: z.array(z.string()).optional(),
  }).default({}),
});

const recordSearchSchema = z.object({
  query: z.string().min(1).max(500),
});

export const searchController = {
  async getSavedSearches(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const searches = await searchService.getSavedSearches(userId);
      res.json({ success: true, data: searches });
    } catch (error) {
      next(error);
    }
  },

  async saveSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = saveSearchSchema.parse(req.body);
      const result = await searchService.saveSearch(userId, data);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async deleteSavedSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { id } = req.params;
      const result = await searchService.deleteSavedSearch(userId, id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getSearchHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const history = await searchService.getSearchHistory(userId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  },

  async getRecentSearches(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const searches = await searchService.getRecentSearches(userId);
      res.json({ success: true, data: searches });
    } catch (error) {
      next(error);
    }
  },

  async recordSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { query } = recordSearchSchema.parse(req.body);
      await searchService.recordSearch(userId, query);

      res.json({ success: true, data: { message: 'Search recorded' } });
    } catch (error) {
      next(error);
    }
  },
};
