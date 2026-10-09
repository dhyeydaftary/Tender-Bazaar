import rateLimit, { Options } from 'express-rate-limit';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

/**
 * Rate limiting.
 *
 * The previous configuration was a single 100-requests-per-15-minutes bucket
 * keyed on IP address, which made the app unusable:
 *
 *   - 100 requests per 15 minutes is ~6 requests/minute. One dashboard load
 *     fans out to half a dozen endpoints and the notification bell polls every
 *     30s, so a user burned the whole budget within a couple of minutes of
 *     normal clicking.
 *   - Keying on IP pooled every user behind one NAT/proxy (an office, a mobile
 *     carrier, or localhost during development) into a single shared bucket, so
 *     one active user locked out everyone else.
 *
 * Now the bucket is per *user* whenever a valid access token is present, with a
 * ceiling sized for an interactive SPA, and anonymous traffic keeps a tighter
 * per-IP bucket. Limits are env-tunable so they can be tightened in production
 * without a code change; they are validated as positive integers by the Zod
 * environment schema, so a malformed value fails at startup rather than
 * silently disabling the limiter.
 */

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const AUTHED_MAX = env.RATE_LIMIT_AUTHED_MAX;
const ANON_MAX = env.RATE_LIMIT_ANON_MAX;
const AUTH_ATTEMPT_MAX = env.RATE_LIMIT_AUTH_MAX;

/**
 * Resolve the user id from the access token so each account gets its own
 * bucket. The token is fully verified: an unverified decode would let anyone
 * mint a payload and hop buckets at will, defeating the limit. Unverified,
 * expired or absent tokens fall back to the IP bucket.
 */
function userIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { userId?: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

const rateLimitResponse: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
};

export const apiLimiter = rateLimit({
  ...rateLimitResponse,
  windowMs: FIFTEEN_MINUTES,
  // Authenticated users get the larger allowance; anonymous callers sharing an
  // IP get the smaller one.
  limit: (req) => (userIdFromRequest(req as Request) ? AUTHED_MAX : ANON_MAX),
  keyGenerator: (req) => {
    const userId = userIdFromRequest(req as Request);
    return userId ? `user:${userId}` : `ip:${(req as Request).ip ?? 'unknown'}`;
  },
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
  },
});

export const authLimiter = rateLimit({
  ...rateLimitResponse,
  windowMs: FIFTEEN_MINUTES,
  limit: AUTH_ATTEMPT_MAX,
  // Only *failed* attempts count toward the limit. Brute force is what this
  // guards against; counting successful logins just locked out legitimate
  // users who signed in, refreshed a token, or switched accounts a few times.
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts' },
  },
});
