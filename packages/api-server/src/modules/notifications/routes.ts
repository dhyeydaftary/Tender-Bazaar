import { Router } from 'express';
import { notificationController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.get('/', authenticate, notificationController.getNotifications);
router.post('/read', authenticate, notificationController.markManyAsRead);
router.patch('/:id/read', authenticate, notificationController.markAsRead);
router.post('/read-all', authenticate, notificationController.markAllAsRead);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.patch('/settings', authenticate, notificationController.updatePreferences);
router.get('/settings', authenticate, notificationController.getPreferences);

export default router;
