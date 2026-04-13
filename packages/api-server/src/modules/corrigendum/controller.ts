import { Request, Response, NextFunction } from 'express';
import { corrigendumService } from './service';
import { processCorrigendumSchema, corrigendumTenderIdSchema } from './validation';

export const corrigendumController = {
  async processCorrigendum(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenderId } = corrigendumTenderIdSchema.parse(req.params);
      const { changes } = processCorrigendumSchema.parse(req.body);
      const result = await corrigendumService.processCorrigendum(tenderId, changes);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getCorrigendumHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenderId } = corrigendumTenderIdSchema.parse(req.params);
      const result = await corrigendumService.getCorrigendumHistory(tenderId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
