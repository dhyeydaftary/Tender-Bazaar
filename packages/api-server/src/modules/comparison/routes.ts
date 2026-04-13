import { Router } from 'express';
import { comparisonController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireFeature } from '../../shared/middleware/plan-guard';

const router = Router();

router.post('/compare', authenticate, requireFeature('tenderComparison'), comparisonController.compareTenders);

export default router;
