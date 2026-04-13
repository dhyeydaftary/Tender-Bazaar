import { prisma } from '../../../config/database';

// Default settings to seed on first fetch
const DEFAULT_SETTINGS: { category: string; key: string; value: any; description: string }[] = [
  // General
  { category: 'general', key: 'siteName', value: 'TenderBazaar', description: 'Platform name displayed across the application' },
  { category: 'general', key: 'siteDescription', value: 'AI-Powered Tender Aggregation Platform for India', description: 'Platform description for SEO and branding' },
  { category: 'general', key: 'contactEmail', value: 'support@tenderbazaar.in', description: 'Primary contact email' },
  { category: 'general', key: 'contactPhone', value: '+91-9876543210', description: 'Primary contact phone' },
  { category: 'general', key: 'maintenanceMode', value: false, description: 'Enable maintenance mode (blocks user access)' },

  // Email
  { category: 'email', key: 'senderEmail', value: 'noreply@tenderbazaar.in', description: 'Default sender email for transactional emails' },
  { category: 'email', key: 'senderName', value: 'TenderBazaar', description: 'Default sender name' },
  { category: 'email', key: 'welcomeEmailEnabled', value: true, description: 'Send welcome email on registration' },
  { category: 'email', key: 'weeklyDigestEnabled', value: true, description: 'Send weekly digest email' },

  // Notifications
  { category: 'notifications', key: 'pushEnabled', value: true, description: 'Enable push notifications globally' },
  { category: 'notifications', key: 'smsEnabled', value: false, description: 'Enable SMS notifications globally' },
  { category: 'notifications', key: 'whatsappEnabled', value: true, description: 'Enable WhatsApp notifications globally' },
  { category: 'notifications', key: 'alertBatchSize', value: 100, description: 'Max users per notification batch' },

  // Security
  { category: 'security', key: 'maxLoginAttempts', value: 5, description: 'Max failed login attempts before lockout' },
  { category: 'security', key: 'lockoutDuration', value: 30, description: 'Account lockout duration in minutes' },
  { category: 'security', key: 'sessionTimeout', value: 24, description: 'Session timeout in hours' },
  { category: 'security', key: 'requireEmailVerification', value: true, description: 'Require email verification for new accounts' },
  { category: 'security', key: 'twoFactorEnabled', value: false, description: 'Enable two-factor authentication' },

  // Billing
  { category: 'billing', key: 'currency', value: 'INR', description: 'Default currency for payments' },
  { category: 'billing', key: 'taxRate', value: 18, description: 'GST tax rate percentage' },
  { category: 'billing', key: 'gracePeriodDays', value: 3, description: 'Grace period after subscription expiry' },
  { category: 'billing', key: 'autoRenewDefault', value: true, description: 'Default auto-renew setting for new subscriptions' },

  // Scraper
  { category: 'scraper', key: 'globalEnabled', value: true, description: 'Enable/disable all scrapers globally' },
  { category: 'scraper', key: 'maxConcurrentScrapers', value: 3, description: 'Maximum concurrent scraping jobs' },
  { category: 'scraper', key: 'retryAttempts', value: 3, description: 'Number of retry attempts on failure' },
  { category: 'scraper', key: 'requestTimeout', value: 30000, description: 'Request timeout in ms for scraper HTTP calls' },
  { category: 'scraper', key: 'alertOnFailure', value: true, description: 'Send admin alert on scraper failure' },
];

export const settingsService = {
  async getAllSettings() {
    let settings = await prisma.adminSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Seed defaults if empty
    if (settings.length === 0) {
      await prisma.adminSetting.createMany({
        data: DEFAULT_SETTINGS.map((s) => ({
          category: s.category,
          key: s.key,
          value: s.value,
          description: s.description,
        })),
        skipDuplicates: true,
      });
      settings = await prisma.adminSetting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });
    }

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({
        id: s.id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedBy: s.updatedBy,
        updatedAt: s.updatedAt,
      });
    }

    return grouped;
  },

  async getSettingsByCategory(category: string) {
    const settings = await prisma.adminSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings;
  },

  async updateSettings(updates: { category: string; key: string; value: any }[], adminId: string) {
    const results = [];

    for (const update of updates) {
      const result = await prisma.adminSetting.upsert({
        where: {
          category_key: { category: update.category, key: update.key },
        },
        create: {
          category: update.category,
          key: update.key,
          value: update.value,
          updatedBy: adminId,
        },
        update: {
          value: update.value,
          updatedBy: adminId,
        },
      });
      results.push(result);
    }

    return { updated: results.length, settings: results };
  },
};
