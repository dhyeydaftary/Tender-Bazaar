import { Router } from 'express';
import { bidAssistantController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireAiCheck } from '../../shared/middleware/plan-guard';

const router = Router();

// Bid assistant requires AI checks (aiBidAssistant level is checked in controller)
router.get('/overview', authenticate, bidAssistantController.getOverview);
router.post('/analyze', authenticate, requireAiCheck(), bidAssistantController.analyzeTender);
router.post('/analyze/:tenderId', authenticate, requireAiCheck(), bidAssistantController.analyzeTender);
router.get('/strategy/:tenderId', authenticate, bidAssistantController.getBidStrategy);

export default router;
