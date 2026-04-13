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
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
};
