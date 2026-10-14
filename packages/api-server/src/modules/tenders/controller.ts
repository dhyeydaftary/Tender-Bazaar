import { Request, Response, NextFunction } from 'express';
import { tenderService } from './service';
import { searchTendersSchema } from './validation';
import { prisma } from '../../config/database';

export const tenderController = {
  async searchTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = searchTendersSchema.parse(req.query);
      const result = await tenderService.searchTenders(filters);

      // Persist the search for the signed-in user. Nothing wrote to
      // SearchHistory before, so "recent searches" on the dashboard and the
      // admin search analytics both read a permanently empty table.
      //
      // Deliberately fire-and-forget: a logging failure must never turn a
      // working search into an error response, and the caller should not wait
      // on the write.
      const userId = (req as any).user?.id;
      if (userId && filters.query?.trim()) {
        const { query, ...rest } = filters;
        prisma.searchHistory
          .create({
            data: {
              userId,
              query: query.trim(),
              filters: rest as any,
              resultCount: result.total ?? null,
            },
          })
          .catch((error) => console.error('Failed to record search history:', error));
      }

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getTenderById(req: Request, res: Response, next: NextFunction) {
    try {
      const tender = await tenderService.getTenderById(req.params.id);
      res.json({ success: true, data: tender });
    } catch (error) {
      next(error);
    }
  },

  async getSimilarTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const tenders = await tenderService.getSimilarTenders(req.params.id);
      res.json({ success: true, data: tenders });
    } catch (error) {
      next(error);
    }
  },

  async getTrendingTenders(_req: Request, res: Response, next: NextFunction) {
    try {
      const tenders = await tenderService.getTrendingTenders();
      res.json({ success: true, data: tenders });
    } catch (error) {
      next(error);
    }
  },

  async getTenderStats(req: Request, res: Response, next: NextFunction) {
    try {
      const state = req.query.state as string | undefined;
      const stats = await tenderService.getTenderStats(state);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getAutocompleteSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) || '';
      const suggestions = await tenderService.getAutocompleteSuggestions(query);
      res.json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  },
};
