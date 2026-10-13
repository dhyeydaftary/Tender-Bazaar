import { z } from 'zod';

/**
 * A positive-integer environment variable.
 *
 * These were previously read straight off `process.env` with
 * `Number(process.env.X ?? fallback)`. Because `??` only substitutes for
 * `undefined`, an explicitly malformed value slipped through unvalidated:
 * `"abc"` became `NaN`, which express-rate-limit treats as "no limit" and so
 * silently disabled rate limiting entirely, and `""` became `0`, which
 * rejected every request. Both failed silently at runtime.
 *
 * Validation is deliberately strict rather than coercive: `z.coerce.number()`
 * would happily accept `""` (0), `"1e3"`, `"0x10"` and `" 10 "`. The regex
 * admits only a plain positive decimal integer, so empty, zero, negative,
 * fractional and non-numeric values all fail fast at startup with a message
 * naming the variable.
 */
function positiveIntEnv(defaultValue: number) {
  return z
    .string()
    .default(String(defaultValue))
    .pipe(
      z
        .string()
        .regex(
          /^[1-9][0-9]*$/,
          'must be a positive whole number (empty, zero, negative, fractional and non-numeric values are rejected)',
        )
        .transform(Number)
        .refine(Number.isSafeInteger, 'must be within the safe integer range'),
    );
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/tenderbazaar'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('dev-jwt-refresh-secret-change-in-production'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /**
   * Opt in to the DEVELOPMENT-ONLY Google sign-in path, which accepts an
   * unsigned, client-generated ID token. Disabled by default, and ignored
   * outside NODE_ENV=development (see modules/auth/service.ts).
   */
  ALLOW_DEMO_GOOGLE_AUTH: z.enum(['true', 'false']).default('false'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  AI_SERVICE_URL: z.string().default('http://localhost:5000'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  /**
   * Rate-limit ceilings per 15-minute window. Authenticated callers are
   * bucketed per user, anonymous callers per IP, and AUTH_MAX caps *failed*
   * authentication attempts (see shared/middleware/rate-limiter.ts).
   */
  RATE_LIMIT_AUTHED_MAX: positiveIntEnv(1000),
  RATE_LIMIT_ANON_MAX: positiveIntEnv(300),
  RATE_LIMIT_AUTH_MAX: positiveIntEnv(20),

  /**
   * Opt in to the DEVELOPMENT-ONLY rate-limit bypass, which skips both the API
   * and the authentication limiter entirely. Disabled by default, and ignored
   * outside NODE_ENV=development (see shared/middleware/rate-limiter.ts).
   *
   * Validated as a literal 'true' | 'false' rather than coerced: a typo such as
   * `DISABLE_RATE_LIMIT=yes` fails at startup instead of being read as falsy
   * and silently doing nothing, or — far worse — as truthy in production.
   * Mirrors ALLOW_DEMO_GOOGLE_AUTH above: a production deployment cannot
   * disable rate limiting by configuration alone.
   */
  DISABLE_RATE_LIMIT: z.enum(['true', 'false']).default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Report which variables are wrong and why, but never their values: this
  // schema also carries JWT secrets, Razorpay keys and the database URL.
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
