import { prisma } from '../../../config/database';

// Default settings to seed on first fetch
const DEFAULT_SETTINGS: { category: string; key: string; value: any; description: string }[] = [
  // General
  { category: 'general', key: 'siteName', value: 'TenderBazaar', description: 'Platform name displayed across the application' },
  { category: 'general', key: 'siteUrl', value: 'https://tenderbazaar.in', description: 'Primary platform URL' },
  { category: 'general', key: 'supportEmail', value: 'support@tenderbazaar.in', description: 'Primary support email' },
  { category: 'general', key: 'contactEmail', value: 'support@tenderbazaar.in', description: 'Primary contact email' },
  { category: 'general', key: 'contactPhone', value: '+91-9876543210', description: 'Primary contact phone' },
  { category: 'general', key: 'timezone', value: 'Asia/Kolkata', description: 'Platform default timezone' },
  { category: 'general', key: 'currency', value: 'INR', description: 'Default currency for payments' },
  { category: 'general', key: 'maintenanceMode', value: false, description: 'Enable maintenance mode (blocks non-admin access)' },
  { category: 'general', key: 'registrationOpen', value: true, description: 'Allow new users to create accounts' },

  // Scraping
  { category: 'scraping', key: 'maxConcurrency', value: 3, description: 'Maximum parallel scraping jobs' },
  { category: 'scraping', key: 'requestDelay', value: 2000, description: 'Delay between requests in ms' },
  { category: 'scraping', key: 'pageTimeout', value: 30000, description: 'Page timeout in ms' },
  { category: 'scraping', key: 'retryAttempts', value: 3, description: 'Number of retry attempts on failure' },
  { category: 'scraping', key: 'maxPagesPerRun', value: 50, description: 'Pagination limit per scraping run' },
  { category: 'scraping', key: 'deduplicationThreshold', value: '0.85', description: 'Levenshtein similarity threshold' },
  { category: 'scraping', key: 'userAgent', value: 'Mozilla/5.0 (compatible; TenderBazaarBot/1.0)', description: 'Bot User-Agent string' },
  { category: 'scraping', key: 'headlessBrowser', value: true, description: 'Run Playwright in headless mode' },
  { category: 'scraping', key: 'respectRobotsTxt', value: true, description: 'Respect robots.txt rules' },
  { category: 'scraping', key: 'proxyEnabled', value: false, description: 'Proxy rotation enabled' },
  { category: 'scraping', key: 'proxyUrl', value: '', description: 'Proxy server endpoint' },
  { category: 'scraping', key: 'autoScheduler', value: true, description: 'Automatically run scrapers on schedule' },

  // Notifications
  { category: 'notifications', key: 'emailEnabled', value: true, description: 'Send emails for alerts and digests' },
  { category: 'notifications', key: 'emailProvider', value: 'aws-ses', description: 'Email provider (aws-ses, sendgrid, smtp)' },
  { category: 'notifications', key: 'emailFrom', value: 'noreply@tenderbazaar.in', description: 'Sender email address' },
  { category: 'notifications', key: 'emailSenderName', value: 'TenderBazaar Notifications', description: 'Notification sender name' },
  { category: 'notifications', key: 'emailSenderAddress', value: 'notifications@tenderbazaar.in', description: 'Default notification sender email' },
  { category: 'notifications', key: 'smtpHost', value: 'email-smtp.ap-south-1.amazonaws.com', description: 'SMTP server host' },
  { category: 'notifications', key: 'smtpPort', value: '587', description: 'SMTP server port' },
  { category: 'notifications', key: 'whatsappEnabled', value: true, description: 'Enable WhatsApp notifications' },
  { category: 'notifications', key: 'whatsappProvider', value: 'wati', description: 'WhatsApp Business API provider' },
  { category: 'notifications', key: 'whatsappApiKey', value: '', description: 'WhatsApp API Key' },
  { category: 'notifications', key: 'pushEnabled', value: true, description: 'Enable push notifications globally' },
  { category: 'notifications', key: 'smsEnabled', value: false, description: 'Enable SMS notifications globally' },
  { category: 'notifications', key: 'smsProvider', value: 'msg91', description: 'SMS Gateway provider' },
  { category: 'notifications', key: 'digestEnabled', value: true, description: 'Send daily/weekly digest emails' },
  { category: 'notifications', key: 'digestFrequency', value: 'daily', description: 'Digest email frequency' },
  { category: 'notifications', key: 'digestTime', value: '09:00', description: 'Time of day in IST for digest dispatch' },

  // Security
  { category: 'security', key: 'sessionTimeout', value: 30, description: 'Session timeout in minutes' },
  { category: 'security', key: 'maxLoginAttempts', value: 5, description: 'Max failed login attempts before lockout' },
  { category: 'security', key: 'lockoutDuration', value: 15, description: 'Account lockout duration in minutes' },
  { category: 'security', key: 'passwordMinLength', value: 8, description: 'Minimum password character length' },
  { category: 'security', key: 'twoFactorRequired', value: false, description: 'Require two-factor authentication for admins' },
  { category: 'security', key: 'forceHttps', value: true, description: 'Redirect all HTTP requests to HTTPS' },
  { category: 'security', key: 'csrfProtection', value: true, description: 'Cross-site request forgery token validation' },
  { category: 'security', key: 'rateLimitPerMin', value: 60, description: 'Per-IP rate limit per minute' },
  { category: 'security', key: 'ipWhitelisting', value: false, description: 'Enable IP whitelisting for admin access' },
  { category: 'security', key: 'ipWhitelist', value: '', description: 'List of allowed IPs or CIDR blocks' },

  // API & Integrations
  { category: 'api', key: 'apiKey', value: '', description: 'Public platform API key' },
  { category: 'api', key: 'apiSecret', value: '', description: 'Server secret key' },
  { category: 'api', key: 'razorpayKey', value: '', description: 'Razorpay API key' },
  { category: 'api', key: 'anthropicKey', value: '', description: 'Anthropic Claude API key' },
  { category: 'api', key: 'webhookEnabled', value: false, description: 'Enable webhook delivery' },
  { category: 'api', key: 'webhookUrl', value: '', description: 'External webhook URL' },

  // Appearance
  { category: 'appearance', key: 'primaryColor', value: '#FF6B35', description: 'Primary brand color' },
  { category: 'appearance', key: 'secondaryColor', value: '#1B2845', description: 'Secondary brand color' },
  { category: 'appearance', key: 'accentColor', value: '#00D4AA', description: 'Accent color' },
  { category: 'appearance', key: 'font', value: 'plus-jakarta-sans', description: 'Platform typography font' },
  { category: 'appearance', key: 'logoUrl', value: '/logo.svg', description: 'Platform logo URL' },
  { category: 'appearance', key: 'faviconUrl', value: '/favicon.ico', description: 'Platform favicon URL' },
  { category: 'appearance', key: 'darkMode', value: true, description: 'Admin dark mode preference' },
  { category: 'appearance', key: 'compactLayout', value: false, description: 'Compact display layout' },
];

export const settingsService = {
  async getAllSettings() {
    // Upsert or insert any missing default settings
    await prisma.adminSetting.createMany({
      data: DEFAULT_SETTINGS.map((s) => ({
        category: s.category,
        key: s.key,
        value: s.value,
        description: s.description,
      })),
      skipDuplicates: true,
    });

    const settings = await prisma.adminSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

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
