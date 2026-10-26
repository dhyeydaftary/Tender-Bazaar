import { Router } from 'express';
import { adminController } from './controller';
import { authenticate, requireRole } from '../../shared/middleware/auth';

const router = Router();

// ─── All admin routes require authentication + ADMIN/SUPER_ADMIN role ───
router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */

router.get('/dashboard', adminController.getDashboardStats);
router.get('/dashboard/charts', adminController.getChartData);
router.get('/dashboard/recent-signups', adminController.getRecentSignups);

/* ═══════════════════════════════════════════════════════════════
   USER MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

router.get('/users', adminController.getUserList);
router.get('/users/export', adminController.exportUsers);
router.get('/users/:id', adminController.getUserDetail);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/reset-password', adminController.resetUserPassword);

/* ═══════════════════════════════════════════════════════════════
   TENDER MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

router.get('/tenders', adminController.getTenderList);
router.get('/tenders/stats', adminController.getTenderStats);
router.get('/tenders/:id', adminController.getTenderDetail);
router.patch('/tenders/:id', adminController.updateTender);
router.delete('/tenders/:id', adminController.deleteTender);

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

router.get('/subscriptions', adminController.getSubscriptionList);
router.get('/subscriptions/stats', adminController.getSubscriptionStats);
router.get('/subscriptions/plans', adminController.getPlans);
router.patch('/subscriptions/plans/:id', requireRole('SUPER_ADMIN'), adminController.updatePlan);
router.patch('/subscriptions/:id', adminController.updateSubscription);
router.post('/subscriptions/:id/cancel', adminController.cancelSubscription);

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════════════════ */

router.get('/analytics', adminController.getPlatformAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowth);
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/tenders', adminController.getTenderAnalytics);
router.get('/analytics/search-trends', adminController.getSearchTrends);

/* ═══════════════════════════════════════════════════════════════
   SCRAPERS
   ═══════════════════════════════════════════════════════════════ */

router.get('/scrapers', adminController.getScraperList);
router.get('/scrapers/engine', adminController.getScraperEngineStatus);
router.get('/scrapers/:portalName/runs', adminController.getScraperRuns);
router.post('/scrapers/:portalName/trigger', adminController.triggerScraper);
router.patch('/scrapers/:portalName', adminController.updateScraper);

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

router.get('/notifications', adminController.getNotificationList);
router.get('/notifications/stats', adminController.getNotificationStats);
router.get('/notifications/broadcasts', adminController.getBroadcastList);
router.get('/notifications/broadcasts/stats', adminController.getBroadcastStats);
router.get('/notifications/broadcasts/audience', adminController.getAudienceEstimate);
router.post('/notifications/broadcast', adminController.sendBroadcast);

/* ═══════════════════════════════════════════════════════════════
   CONTENT — Blog Posts
   ═══════════════════════════════════════════════════════════════ */

router.get('/content/stats', adminController.getContentStats);
router.get('/content/posts', adminController.getPostList);
router.post('/content/posts', adminController.createPost);
router.get('/content/posts/:id', adminController.getPostDetail);
router.patch('/content/posts/:id', adminController.updatePost);
router.delete('/content/posts/:id', adminController.deletePost);

/* ═══════════════════════════════════════════════════════════════
   CONTENT — Announcements
   ═══════════════════════════════════════════════════════════════ */

router.get('/content/announcements', adminController.getAnnouncementList);
router.post('/content/announcements', adminController.createAnnouncement);
router.patch('/content/announcements/:id', adminController.updateAnnouncement);
router.delete('/content/announcements/:id', adminController.deleteAnnouncement);

/* ═══════════════════════════════════════════════════════════════
   CONTENT — Banners
   ═══════════════════════════════════════════════════════════════ */

router.get('/content/banners', adminController.getBannerList);
router.post('/content/banners', adminController.createBanner);
router.patch('/content/banners/:id', adminController.updateBanner);
router.delete('/content/banners/:id', adminController.deleteBanner);

/* ═══════════════════════════════════════════════════════════════
   SUPPORT TICKETS
   ═══════════════════════════════════════════════════════════════ */

router.get('/support/tickets', adminController.getTicketList);
router.get('/support/stats', adminController.getTicketStats);
router.get('/support/tickets/:id', adminController.getTicketDetail);
router.patch('/support/tickets/:id', adminController.updateTicket);
router.post('/support/tickets/:id/reply', adminController.replyToTicket);

/* ═══════════════════════════════════════════════════════════════
   REPORTS
   ═══════════════════════════════════════════════════════════════ */

router.get('/reports/revenue', adminController.getRevenueReport);
router.get('/reports/users', adminController.getUserReport);
router.get('/reports/tenders', adminController.getTenderReport);
router.get('/reports/subscriptions', adminController.getSubscriptionReport);
router.post('/reports/export', adminController.exportReport);

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOGS
   ═══════════════════════════════════════════════════════════════ */

router.get('/audit-logs', adminController.getAuditLogs);
router.get('/audit-logs/stats', adminController.getAuditLogStats);

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════ */

router.get('/settings', adminController.getSettings);
router.patch('/settings', requireRole('SUPER_ADMIN'), adminController.updateSettings);
router.get('/settings/:category', adminController.getSettingsByCategory);

export default router;
