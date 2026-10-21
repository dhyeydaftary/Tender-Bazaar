import { Router } from 'express';
import { eligibilityController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireAiCheck } from '../../shared/middleware/plan-guard';

const router = Router();

router.post('/', authenticate, requireAiCheck(), eligibilityController.checkEligibility);
router.post('/check', authenticate, requireAiCheck(), eligibilityController.checkEligibility);
router.post('/bulk', authenticate, requireAiCheck(), eligibilityController.bulkCheckEligibility);
router.get('/history', authenticate, eligibilityController.getEligibilityHistory);
router.get('/tender/:tenderId', authenticate, eligibilityController.getTenderEligibility);
router.get('/match', authenticate, eligibilityController.getMatchingTenders);

export default router;
