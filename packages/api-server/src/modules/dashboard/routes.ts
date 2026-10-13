import { Router } from 'express';
import { dashboardController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/', authenticate, dashboardController.getDashboard);

export default router;
