import { Router } from 'express';
import { exportController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireFeature } from '../../shared/middleware/plan-guard';

const router = Router();

router.get('/tenders/csv', authenticate, requireFeature('exportEnabled'), exportController.exportTendersCSV);
router.get('/tender/:id/pdf', authenticate, requireFeature('documentDownload'), exportController.exportTenderPDF);
router.get('/eligibility/:checkId/pdf', authenticate, requireFeature('exportEnabled'), exportController.exportEligibilityReport);
router.get('/saved/csv', authenticate, requireFeature('exportEnabled'), exportController.exportSavedTendersCSV);

export default router;
