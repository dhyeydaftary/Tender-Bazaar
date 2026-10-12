import { Request, Response, NextFunction } from 'express';
import {
  dashboardService,
  usersService,
  tendersService,
  subscriptionsService,
  analyticsService,
  scrapersService,
  notificationsService,
  contentService,
  supportService,
  reportsService,
  auditService,
  settingsService,
} from './services';
import {
  chartQuerySchema,
  recentSignupsQuerySchema,
  userListQuerySchema,
  updateUserBodySchema,
  exportUsersQuerySchema,
  tenderListQuerySchema,
  updateTenderBodySchema,
  subscriptionListQuerySchema,
  updatePlanBodySchema,
  updateSubscriptionBodySchema,
  analyticsQuerySchema,
  scraperRunsQuerySchema,
  updateScraperBodySchema,
  notificationListQuerySchema,
  broadcastNotificationBodySchema,
  broadcastListQuerySchema,
  postListQuerySchema,
  createPostBodySchema,
  updatePostBodySchema,
  announcementListQuerySchema,
  createAnnouncementBodySchema,
  updateAnnouncementBodySchema,
  bannerListQuerySchema,
  createBannerBodySchema,
  updateBannerBodySchema,
  ticketListQuerySchema,
  updateTicketBodySchema,
  ticketReplyBodySchema,
  reportQuerySchema,
  exportReportBodySchema,
  auditLogQuerySchema,
  updateSettingsBodySchema,
} from './validation';

// Helper to get the admin user from request
function getAdmin(req: Request) {
  return (req as any).user as { id: string; email: string; role: string; name: string };
}

// Helper to create audit trail
function audit(req: Request, action: string, entity: string, entityId?: string, changes?: any) {
  const admin = getAdmin(req);
  auditService.log({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action,
    entity,
    entityId,
    changes,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });
}

export const adminController = {
  /* ══════════════════════════════════════════════════════════
     DASHBOARD
     ══════════════════════════════════════════════════════════ */

  async getDashboardStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await dashboardService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getChartData(req: Request, res: Response, next: NextFunction) {
    try {
      const { period } = chartQuerySchema.parse(req.query);
      const data = await dashboardService.getChartData(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getRecentSignups(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit } = recentSignupsQuerySchema.parse(req.query);
      const signups = await dashboardService.getRecentSignups(limit);
      res.json({ success: true, data: signups });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     USERS
     ══════════════════════════════════════════════════════════ */

  async getUserList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = userListQuerySchema.parse(req.query);
      const result = await usersService.getUserList(filters);
      res.json({
        success: true,
        data: {
          users: result.users,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getUserDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getUserDetail(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateUserBodySchema.parse(req.body);
      const result = await usersService.updateUser(req.params.id, data);
      audit(req, 'user.update', 'User', req.params.id, result.changes);
      res.json({ success: true, data: result.user });
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.deleteUser(req.params.id);
      audit(req, 'user.deactivate', 'User', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async resetUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.resetUserPassword(req.params.id);
      audit(req, 'user.reset_password', 'User', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async exportUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = exportUsersQuerySchema.parse(req.query);
      const data = await usersService.exportUsers(filters);
      audit(req, 'user.export', 'User');
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     TENDERS
     ════════════════════════════════════════════════════���═════ */

  async getTenderList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = tenderListQuerySchema.parse(req.query);
      const result = await tendersService.getTenderList(filters);
      res.json({
        success: true,
        data: {
          tenders: result.tenders,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getTenderDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const tender = await tendersService.getTenderDetail(req.params.id);
      res.json({ success: true, data: tender });
    } catch (error) {
      next(error);
    }
  },

  async updateTender(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateTenderBodySchema.parse(req.body);
      const result = await tendersService.updateTender(req.params.id, data);
      audit(req, 'tender.update', 'Tender', req.params.id, result.changes);
      res.json({ success: true, data: result.tender });
    } catch (error) {
      next(error);
    }
  },

  async deleteTender(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tendersService.deleteTender(req.params.id);
      audit(req, 'tender.delete', 'Tender', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getTenderStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await tendersService.getTenderStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     SUBSCRIPTIONS
     ══════════════════════════════════════════════════════════ */

  async getSubscriptionList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = subscriptionListQuerySchema.parse(req.query);
      const result = await subscriptionsService.getSubscriptionList(filters);
      res.json({
        success: true,
        data: {
          subscriptions: result.subscriptions,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getSubscriptionStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await subscriptionsService.getSubscriptionStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await subscriptionsService.getPlans();
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  },

  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updatePlanBodySchema.parse(req.body);
      const result = await subscriptionsService.updatePlan(req.params.id, data);
      audit(req, 'plan.update', 'SubscriptionPlan', req.params.id, result.changes);
      res.json({ success: true, data: result.plan });
    } catch (error) {
      next(error);
    }
  },

  async updateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateSubscriptionBodySchema.parse(req.body);
      const result = await subscriptionsService.updateSubscription(req.params.id, data);
      audit(req, 'subscription.update', 'Subscription', req.params.id, data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionsService.cancelSubscription(req.params.id);
      audit(req, 'subscription.cancel', 'Subscription', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     ANALYTICS
     ══════════════════════════════════════════════════════════ */

  async getPlatformAnalytics(_req: Request, res: Response, next: NextFunction) {
    try {
      const analytics = await analyticsService.getPlatformAnalytics();
      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  },

  async getUserGrowth(req: Request, res: Response, next: NextFunction) {
    try {
      const { period } = analyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getUserGrowth(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getRevenueAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { period } = analyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getRevenueAnalytics(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getTenderAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { period } = analyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getTenderAnalytics(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getSearchTrends(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getSearchTrends();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     SCRAPERS
     ══════════════════════════════════════════════════════════ */

  async getScraperList(_req: Request, res: Response, next: NextFunction) {
    try {
      const scrapers = await scrapersService.getScraperList();
      res.json({ success: true, data: scrapers });
    } catch (error) {
      next(error);
    }
  },

  async getScraperRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = scraperRunsQuerySchema.parse(req.query);
      const data = await scrapersService.getScraperRuns(req.params.portalName, page, limit);
      res.json({
        success: true,
        data: data.runs,
        meta: { page: data.page, limit: data.limit, total: data.total, scraper: data.scraper },
      });
    } catch (error) {
      next(error);
    }
  },

  async triggerScraper(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = getAdmin(req);
      const result = await scrapersService.triggerScraper(req.params.portalName, admin.id);
      audit(req, 'scraper.trigger', 'ScraperHealth', req.params.portalName);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async updateScraper(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateScraperBodySchema.parse(req.body);
      const result = await scrapersService.updateScraper(req.params.portalName, data);
      audit(req, 'scraper.update', 'ScraperHealth', req.params.portalName, result.changes);
      res.json({ success: true, data: result.scraper });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════════════════════ */

  async getNotificationList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = notificationListQuerySchema.parse(req.query);
      const result = await notificationsService.getNotificationList(filters);
      res.json({
        success: true,
        data: result.notifications,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async sendBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = broadcastNotificationBodySchema.parse(req.body);
      const result = await notificationsService.sendBroadcast(payload);
      audit(req, 'notification.broadcast', 'Notification', undefined, {
        title: payload.title,
        channel: payload.channel,
        sentTo: result.sent,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getBroadcastList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = broadcastListQuerySchema.parse(req.query);
      const result = await notificationsService.getBroadcastList(filters as any);
      res.json({
        success: true,
        data: result.broadcasts,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getBroadcastStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await notificationsService.getBroadcastStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getAudienceEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const target = (req.query.target as string) || 'ALL';
      const estimate = await notificationsService.getAudienceEstimate(target);
      res.json({ success: true, data: estimate });
    } catch (error) {
      next(error);
    }
  },

  async getNotificationStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await notificationsService.getNotificationStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     CONTENT — Blog Posts
     ══════════════════════════════════════════════════════════ */

  async getContentStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await contentService.getContentStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getPostList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = postListQuerySchema.parse(req.query);
      const result = await contentService.getPostList(filters);
      res.json({
        success: true,
        data: result.posts,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getPostDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await contentService.getPostDetail(req.params.id);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  },

  async createPost(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPostBodySchema.parse(req.body);
      const admin = getAdmin(req);
      const post = await contentService.createPost(data, admin.id, admin.name);
      audit(req, 'content.post.create', 'BlogPost', post.id);
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  },

  async updatePost(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updatePostBodySchema.parse(req.body);
      const post = await contentService.updatePost(req.params.id, data);
      audit(req, 'content.post.update', 'BlogPost', req.params.id);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  },

  async deletePost(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentService.deletePost(req.params.id);
      audit(req, 'content.post.delete', 'BlogPost', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     CONTENT — Announcements
     ══════════════════════════════════════════════════════════ */

  async getAnnouncementList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = announcementListQuerySchema.parse(req.query);
      const result = await contentService.getAnnouncementList(filters);
      res.json({
        success: true,
        data: result.announcements,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAnnouncementBodySchema.parse(req.body);
      const admin = getAdmin(req);
      const announcement = await contentService.createAnnouncement(data, admin.id);
      audit(req, 'content.announcement.create', 'Announcement', announcement.id);
      res.status(201).json({ success: true, data: announcement });
    } catch (error) {
      next(error);
    }
  },

  async updateAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateAnnouncementBodySchema.parse(req.body);
      const announcement = await contentService.updateAnnouncement(req.params.id, data);
      audit(req, 'content.announcement.update', 'Announcement', req.params.id);
      res.json({ success: true, data: announcement });
    } catch (error) {
      next(error);
    }
  },

  async deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentService.deleteAnnouncement(req.params.id);
      audit(req, 'content.announcement.delete', 'Announcement', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     CONTENT — Banners
     ══════════════════════════════════════════════════════════ */

  async getBannerList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = bannerListQuerySchema.parse(req.query);
      const result = await contentService.getBannerList(filters);
      res.json({
        success: true,
        data: result.banners,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createBannerBodySchema.parse(req.body);
      const admin = getAdmin(req);
      const banner = await contentService.createBanner(data, admin.id);
      audit(req, 'content.banner.create', 'Banner', banner.id);
      res.status(201).json({ success: true, data: banner });
    } catch (error) {
      next(error);
    }
  },

  async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateBannerBodySchema.parse(req.body);
      const banner = await contentService.updateBanner(req.params.id, data);
      audit(req, 'content.banner.update', 'Banner', req.params.id);
      res.json({ success: true, data: banner });
    } catch (error) {
      next(error);
    }
  },

  async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await contentService.deleteBanner(req.params.id);
      audit(req, 'content.banner.delete', 'Banner', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     SUPPORT
     ══════════════════════════════════════════════════════════ */

  async getTicketList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = ticketListQuerySchema.parse(req.query);
      const result = await supportService.getTicketList(filters);
      res.json({
        success: true,
        data: result.tickets,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getTicketDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await supportService.getTicketDetail(req.params.id);
      res.json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  },

  async updateTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateTicketBodySchema.parse(req.body);
      const result = await supportService.updateTicket(req.params.id, data);
      audit(req, 'support.ticket.update', 'SupportTicket', req.params.id, result.changes);
      res.json({ success: true, data: result.ticket });
    } catch (error) {
      next(error);
    }
  },

  async replyToTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { message } = ticketReplyBodySchema.parse(req.body);
      const admin = getAdmin(req);
      const reply = await supportService.replyToTicket(req.params.id, admin.id, admin.role, message);
      audit(req, 'support.ticket.reply', 'SupportTicket', req.params.id);
      res.status(201).json({ success: true, data: reply });
    } catch (error) {
      next(error);
    }
  },

  async getTicketStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await supportService.getTicketStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     REPORTS
     ══════════════════════════════════════════════════════════ */

  async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = reportQuerySchema.parse(req.query);
      const report = await reportsService.getRevenueReport(filters);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async getUserReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = reportQuerySchema.parse(req.query);
      const report = await reportsService.getUserReport(filters);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async getTenderReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = reportQuerySchema.parse(req.query);
      const report = await reportsService.getTenderReport(filters);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async getSubscriptionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = reportQuerySchema.parse(req.query);
      const report = await reportsService.getSubscriptionReport(filters);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportType, ...filters } = exportReportBodySchema.parse(req.body);
      const data = await reportsService.exportReport(reportType, filters);
      audit(req, 'report.export', 'Report', undefined, { reportType });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     AUDIT LOGS
     ══════════════════════════════════════════════════════════ */

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = auditLogQuerySchema.parse(req.query);
      const result = await auditService.getAuditLogs(filters);
      res.json({
        success: true,
        data: result.logs,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  },

  async getAuditLogStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await auditService.getAuditLogStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /* ══════════════════════════════════════════════════════════
     SETTINGS
     ══════════════════════════════════════════════════════════ */

  async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getAllSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  async getSettingsByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getSettingsByCategory(req.params.category);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { settings } = updateSettingsBodySchema.parse(req.body);
      const admin = getAdmin(req);
      const result = await settingsService.updateSettings(
        settings as { category: string; key: string; value: any }[],
        admin.id,
      );
      audit(req, 'settings.update', 'AdminSetting', undefined, {
        updatedKeys: settings.map((s) => `${s.category}.${s.key}`),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
