import { Request, Response, NextFunction } from 'express';
import { resultsService } from './service';
import { searchResultsSchema, tenderIdParamSchema, companyNameParamSchema } from './validation';

export const resultsController = {
  async searchResults(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = searchResultsSchema.parse(req.query);
      const query = filters.query || filters.search;
      const result = await resultsService.searchResults({ ...filters, query });
      res.json({ success: true, data: result.results, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },

  async getTenderResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenderId } = tenderIdParamSchema.parse(req.params);
      const result = await resultsService.getTenderResults(tenderId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getCompetitorAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await resultsService.getCompetitorAnalysis(userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getWinnerProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyName } = companyNameParamSchema.parse(req.params);
      const result = await resultsService.getWinnerProfile(companyName);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
