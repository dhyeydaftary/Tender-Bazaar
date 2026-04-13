import { Request, Response, NextFunction } from 'express';
import { userService } from './service';
import { updateProfileSchema, updateCompanyProfileSchema, documentUploadSchema } from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const profileController = {
  /**
   * GET /api/v1/profile
   * Get the authenticated user's full profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const profile = await userService.getProfile(userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/profile
   * Update basic profile fields (name, phone)
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = updateProfileSchema.parse(req.body);
      const updated = await userService.updateProfile(userId, data);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/profile/company
   * Create or update company profile
   */
  async updateCompanyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = updateCompanyProfileSchema.parse(req.body);
      const companyProfile = await userService.updateCompanyProfile(userId, data);
      res.json({ success: true, data: companyProfile });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/profile/documents
   * Upload a document (multipart/form-data with 'file' field and 'type' field)
   */
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'NO_FILE');
      }

      // Validate the document metadata from body
      const { type, name } = documentUploadSchema.parse({
        type: req.body.type,
        name: req.body.name,
      });

      const document = await userService.uploadDocument(userId, req.file, type, name);
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/profile/documents/:id
   * Delete a document by ID
   */
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { id } = req.params;
      if (!id) {
        throw new AppError('Document ID is required', 400, 'MISSING_DOCUMENT_ID');
      }

      const result = await userService.deleteDocument(userId, id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/profile/completion
   * Get profile completion percentage with section breakdown
   */
  async getProfileCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const completion = await userService.getProfileCompletionPercentage(userId);
      res.json({ success: true, data: completion });
    } catch (error) {
      next(error);
    }
  },
};
