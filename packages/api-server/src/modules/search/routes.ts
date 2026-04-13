import { Router } from 'express';
import { searchController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/saved', authenticate, searchController.getSavedSearches);
router.post('/saved', authenticate, searchController.saveSearch);
router.delete('/saved/:id', authenticate, searchController.deleteSavedSearch);
router.get('/recent', authenticate, searchController.getRecentSearches);
router.post('/recent', authenticate, searchController.recordSearch);

export default router;
