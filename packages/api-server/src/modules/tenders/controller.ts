import { Request, Response, NextFunction } from 'express';
import { tenderService } from './service';
import { searchTendersSchema } from './validation';

export const tenderController = {
  async searchTenders(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = searchTendersSchema.parse(req.query);
      const result = await tenderService.searchTenders(filters);
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

  async getTenderStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await tenderService.getTenderStats();
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
