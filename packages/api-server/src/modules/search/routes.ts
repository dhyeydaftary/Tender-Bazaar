import { Router } from 'express';
import { searchController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/saved', authenticate, searchController.getSavedSearches);
router.post('/saved', authenticate, searchController.saveSearch);
router.delete('/saved/:id', authenticate, searchController.deleteSavedSearch);
// The web search page has always called GET /search/history; without this
// route it fell through to the 404 handler, so the page's "recent searches"
// list was permanently empty.
router.get('/history', authenticate, searchController.getSearchHistory);
router.get('/recent', authenticate, searchController.getRecentSearches);
router.post('/recent', authenticate, searchController.recordSearch);

export default router;
