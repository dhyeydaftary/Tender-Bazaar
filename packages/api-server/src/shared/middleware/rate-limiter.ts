import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development' && env.DISABLE_RATE_LIMIT === 'true',
});

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts' },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development' && env.DISABLE_RATE_LIMIT === 'true',
});

