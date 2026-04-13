import { Router } from 'express';
import { alertController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireLimit } from '../../shared/middleware/plan-guard';

const router = Router();

router.post('/', authenticate, requireLimit('maxAlerts'), alertController.createAlert);
router.get('/', authenticate, alertController.getAlerts);
router.patch('/:id', authenticate, alertController.updateAlert);
router.delete('/:id', authenticate, alertController.deleteAlert);
router.patch('/:id/toggle', authenticate, alertController.toggleAlert);
router.post('/:id/test', authenticate, alertController.testAlert);

export default router;
