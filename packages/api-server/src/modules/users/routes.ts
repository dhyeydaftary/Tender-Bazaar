import { Router } from 'express';
import { profileController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { upload } from '../../shared/utils/upload';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// GET    /api/v1/profile            — Get full user profile
router.get('/', profileController.getProfile);

// PATCH  /api/v1/profile            — Update basic profile (name, phone)
router.patch('/', profileController.updateProfile);

// PATCH  /api/v1/profile/company    — Create or update company profile
router.patch('/company', profileController.updateCompanyProfile);

// POST   /api/v1/profile/documents  — Upload a document (multipart form-data)
router.post('/documents', upload.single('file'), profileController.uploadDocument);

// DELETE /api/v1/profile/documents/:id — Delete a document
router.delete('/documents/:id', profileController.deleteDocument);

// GET    /api/v1/profile/completion — Get profile completion percentage
router.get('/completion', profileController.getProfileCompletion);

// GET    /api/v1/profile/analytics  — Get real user analytics calculated on the fly
router.get('/analytics', profileController.getAnalytics);

export default router;
