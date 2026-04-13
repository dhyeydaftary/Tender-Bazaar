import { Router } from 'express';
import { referralController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/code', authenticate, referralController.getOrGenerateCode);
router.get('/stats', authenticate, referralController.getStats);
router.post('/apply', authenticate, referralController.applyReferral);
router.get('/history', authenticate, referralController.getHistory);

export default router;
