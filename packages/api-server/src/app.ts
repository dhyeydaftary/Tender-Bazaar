import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler } from './shared/middleware/error-handler';
import { sentryErrorHandler } from './shared/middleware/sentry';
import { apiLimiter } from './shared/middleware/rate-limiter';
import { buildHealthReport } from './shared/health';
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
import dashboardRoutes from './modules/dashboard/routes';

const app = express();

// Trust the reverse proxy in front of the app so `req.ip` (used to key
// anonymous rate limiting) reflects the real client rather than the proxy,
// which would otherwise collapse all anonymous traffic into one bucket.
// Only enabled outside development: with no proxy in front, trusting
// X-Forwarded-For would let any client spoof its own IP to evade the limit.
if (process.env.NODE_ENV !== 'development') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet());
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  ...(process.env.NODE_ENV === 'development' ? DEV_ORIGINS : []),
].filter(Boolean) as string[];

// Any http://localhost:* / http://127.0.0.1:* origin used to be allowed with
// credentials, in production too, so a page served from any port on a user's
// machine could make credentialed cross-origin calls to the production API.
// The loopback allowance is now development-only; production uses exactly the
// configured origins (FRONTEND_URL / ADMIN_URL), which docker-compose.prod.yml
// requires to be set.
const allowLoopbackOrigins = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (
      allowLoopbackOrigins &&
      (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
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
const healthHandler: express.RequestHandler = async (_req, res) => {
  const health = await buildHealthReport({
    database: () => prisma.$queryRaw`SELECT 1`,
    redis: () => redis.ping(),
    // GET /api/v1/tenders reads exclusively from Elasticsearch, so without this
    // check /health reported "ok" while the primary tender-listing endpoint was
    // failing — which is exactly how the original index_not_found outage stayed
    // invisible. Both the cluster and the tenders index are checked, because a
    // reachable cluster with no index is still a broken search.
    elasticsearch: async () => {
      const { esClient } = await import('./config/elasticsearch');
      const { TENDER_INDEX } = await import('./config/elasticsearch-setup');
      await esClient.cluster.health({});
      const indexExists = await esClient.indices.exists({ index: TENDER_INDEX });
      return indexExists ? 'healthy' : `index "${TENDER_INDEX}" missing`;
    },
  });

  res.status(health.status === 'ok' ? 200 : 503).json(health);
};

// `/health` for container health checks; `/api/v1/health` for browser clients,
// which reach the API only under /api/* through the gateway (the admin panel's
// Service Health card used to request `/health` on its own origin and 404).
app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

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
app.use('/api/v1/dashboard', dashboardRoutes);

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

// 404 for unmatched API routes.
//
// Without this, an unknown /api/... path fell through to Express's default
// handler, which replies with an HTML error page. Every other response from this
// server is JSON in the { success, error: { code, message } } shape, so a client
// that parsed the body (the web app's axios instance included) broke on the one
// case it was most likely to hit — a wrong or renamed endpoint. Scoped to /api
// so any non-API route keeps its current behaviour.
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// Sentry error tracking (before error handler)
app.use(sentryErrorHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
