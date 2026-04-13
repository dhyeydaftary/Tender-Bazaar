import { Router } from 'express';
import { tenderController } from './controller';
import { optionalAuth } from '../../shared/middleware/auth';
import { tenderPagination } from '../../shared/middleware/plan-guard';

const router = Router();

// tenderPagination enforces free-plan page/limit restrictions
router.get('/', optionalAuth, tenderPagination(), tenderController.searchTenders);
router.get('/stats', tenderController.getTenderStats);
router.get('/trending', tenderController.getTrendingTenders);
router.get('/:id', optionalAuth, tenderController.getTenderById);
router.get('/:id/similar', tenderController.getSimilarTenders);

export default router;
