export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    sesFromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@tenderbazaar.com',
  },
  whatsapp: {
    apiUrl: process.env.WATI_API_URL || '',
    apiKey: process.env.WATI_API_KEY || '',
  },
  sms: {
    authKey: process.env.MSG91_AUTH_KEY || '',
    senderId: process.env.MSG91_SENDER_ID || '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    /**
     * Path to a Firebase service-account JSON key, mounted as a secret.
     *
     * Required for push to work at all: FIREBASE_PROJECT_ID alone made
     * Firebase Admin fall back to Application Default Credentials, which do
     * not exist in this container, so every send failed silently.
     */
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    /**
     * When true, the service refuses to start without a usable push
     * credential. Default false: push is treated as an optional channel and
     * reported as disabled, so email/SMS/WhatsApp keep working.
     */
    required: (process.env.PUSH_NOTIFICATIONS_REQUIRED || 'false') === 'true',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  /**
   * Production is the only mode in which an unconfigured provider is an
   * error. Development and test keep the console fallbacks (see
   * providers/delivery-guard.ts).
   */
  isProduction: process.env.NODE_ENV === 'production',
};
