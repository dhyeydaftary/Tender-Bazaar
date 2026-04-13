import { Router } from 'express';
import { calendarController } from './controller';
import { authenticate, optionalAuth } from '../../shared/middleware/auth';
import { requireFeature } from '../../shared/middleware/plan-guard';

const router = Router();

router.get('/tenders', authenticate, requireFeature('tenderCalendar'), calendarController.getTendersByDateRange);
router.get('/export', authenticate, requireFeature('tenderCalendar'), calendarController.exportToICal);

export default router;
