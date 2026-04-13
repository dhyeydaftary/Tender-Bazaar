import { Router } from 'express';
import { savedController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { requireLimit } from '../../shared/middleware/plan-guard';

const router = Router();

router.get('/', authenticate, savedController.getSavedTenders);
router.post('/:tenderId', authenticate, requireLimit('maxSavedTenders'), savedController.saveTender);
router.delete('/:tenderId', authenticate, savedController.unsaveTender);
router.patch('/:tenderId/notes', authenticate, savedController.updateNotes);

export default router;
