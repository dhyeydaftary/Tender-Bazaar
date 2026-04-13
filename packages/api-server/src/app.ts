import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler } from './shared/middleware/error-handler';
import { sentryErrorHandler } from './shared/middleware/sentry';
import { apiLimiter } from './shared/middleware/rate-limiter';
import { prisma } from './config/database';
import redis from './config/redis';
import authRoutes from './modules/auth/routes';
import tenderRoutes from './modules/tenders/routes';
import savedRoutes from './modules/saved/routes';
import profileRoutes from './modules/users/routes';
import eligibilityRoutes from './modules/eligibility/routes';
import alertRoutes from './modules/alerts/routes';
import notificationRoutes from './modules/notifications/routes';
import paymentRoutes from './modules/payments/routes';
import adminRoutes from './modules/admin/routes';
import resultRoutes from './modules/results/routes';
import corrigendumRoutes from './modules/corrigendum/routes';
import calendarRoutes from './modules/calendar/routes';
import searchRoutes from './modules/search/routes';
import exportRoutes from './modules/export/routes';
import referralRoutes from './modules/referral/routes';
import bidAssistantRoutes from './modules/bid-assistant/routes';
import comparisonRoutes from './modules/comparison/routes';
import apiKeyRoutes from './modules/api-keys/routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001',
  ],
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));

// Raw body parser for Razorpay webhook (must be before express.json)
app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check
app.get('/health', async (_req, res) => {
  const health = {
    status: 'ok' as string,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {} as Record<string, string>,
  };

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'healthy';
  } catch {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'healthy';
  } catch {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// API info
app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'TenderBazaar API',
    version: '1.0.0',
    status: 'running',
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenders', tenderRoutes);
app.use('/api/v1/saved', savedRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/eligibility', eligibilityRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/corrigendum', corrigendumRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/referral', referralRoutes);
app.use('/api/v1/bid-assistant', bidAssistantRoutes);
app.use('/api/v1/comparison', comparisonRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);

// Search suggestions
app.get('/api/v1/search/suggestions', async (req, res, next) => {
  try {
    const { tenderService } = await import('./modules/tenders/service');
    const query = (req.query.q as string) || '';
    const suggestions = await tenderService.getAutocompleteSuggestions(query);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
});

// Sentry error tracking (before error handler)
app.use(sentryErrorHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
