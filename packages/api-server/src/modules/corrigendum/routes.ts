import { Router } from 'express';
import { corrigendumController } from './controller';
import { authenticate, requireRole } from '../../shared/middleware/auth';

const router = Router();

router.post('/:tenderId', authenticate, requireRole('ADMIN'), corrigendumController.processCorrigendum);
router.get('/:tenderId/history', corrigendumController.getCorrigendumHistory);

export default router;
