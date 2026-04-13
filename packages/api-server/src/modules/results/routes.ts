import { Router } from 'express';
import { resultsController } from './controller';
import { authenticate, optionalAuth } from '../../shared/middleware/auth';
import { requireFeature } from '../../shared/middleware/plan-guard';

const router = Router();

router.get('/', optionalAuth, resultsController.searchResults);
router.get('/tender/:tenderId', resultsController.getTenderResults);
router.get('/competitors', authenticate, requireFeature('competitorAnalysis'), resultsController.getCompetitorAnalysis);
router.get('/winner/:companyName', resultsController.getWinnerProfile);

export default router;
