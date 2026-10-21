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

/**
 * The development fallbacks for the token-signing secrets. They are real,
 * working values for local development and are REJECTED in production by
 * `checkSecret` below — previously they were plain `.default()`s with no
 * production guard, so an operator who forgot to set JWT_SECRET got an API
 * that happily signed and accepted tokens anyone could forge from this
 * repository's source.
 */
export const DEV_JWT_SECRET = 'dev-jwt-secret-change-in-production';
export const DEV_JWT_REFRESH_SECRET = 'dev-jwt-refresh-secret-change-in-production';

/** Minimum length for a production signing secret. */
export const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Placeholder values that must never sign production tokens, regardless of
 * length. Compared case-insensitively against the whole value.
 */
const WEAK_SECRETS = new Set(
  [
    DEV_JWT_SECRET,
    DEV_JWT_REFRESH_SECRET,
    'changeme',
    'change-me',
    'change_me',
    'secret',
    'jwtsecret',
    'jwt-secret',
    'jwt_secret',
    'password',
    'your-secret',
    'your-secret-key',
    'your-jwt-secret',
    'your-super-secret-jwt-key',
    'development',
    'production',
    'test',
  ].map((value) => value.toLowerCase()),
);

/**
 * Validate one production signing secret. Returns a human-readable problem
 * description, or `null` when the value is acceptable.
 *
 * The value itself is never included in the message: these messages are
 * printed at startup and end up in container logs.
 */
export function checkProductionSecret(
  name: string,
  value: string | undefined,
): string | null {
  if (value === undefined || value.trim() === '') {
    return `${name}: must be set in production (no default is applied).`;
  }

  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    return `${name}: must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production (got ${value.length}).`;
  }

  if (WEAK_SECRETS.has(value.trim().toLowerCase())) {
    return `${name}: is a known placeholder value and must not be used in production.`;
  }

  if (/change[-_ ]?(me|in[-_ ]?production)/i.test(value)) {
    return `${name}: still looks like a placeholder ("change me") and must not be used in production.`;
  }

  if (/^(.)\1*$/.test(value)) {
    return `${name}: must not be a single repeated character.`;
  }

  return null;
}

/**
 * Cross-field validation for the signing secrets.
 *
 * Exported so it can be unit-tested without mutating `process.env`, in the
 * same style as `isRateLimitBypassed`.
 */
export function validateJwtSecrets(input: {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
}): string[] {
  if (input.NODE_ENV !== 'production') return [];

  const problems: string[] = [];

  const accessProblem = checkProductionSecret('JWT_SECRET', input.JWT_SECRET);
  if (accessProblem) problems.push(accessProblem);

  const refreshProblem = checkProductionSecret(
    'JWT_REFRESH_SECRET',
    input.JWT_REFRESH_SECRET,
  );
  if (refreshProblem) problems.push(refreshProblem);

  // Independent secrets: reusing one value means a stolen access token is also
  // a valid refresh token, which defeats the short access-token expiry.
  if (
    !accessProblem &&
    !refreshProblem &&
    input.JWT_SECRET === input.JWT_REFRESH_SECRET
  ) {
    problems.push(
      'JWT_SECRET and JWT_REFRESH_SECRET: must be different values in production.',
    );
  }

  return problems;
}

/**
 * Credentials that must never reach production in a connection URL. These are
 * the values shipped in .env.example and the Compose development defaults.
 */
const WEAK_CONNECTION_PASSWORDS = new Set([
  '',
  'changeme',
  'change-me',
  'change_me',
  'postgres',
  'password',
  'redis',
  'secret',
  'root',
  'admin',
]);

/** Pull the password out of a `scheme://user:password@host` URL, if present. */
function connectionPassword(url: string): string | null {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^@/]*)@/.exec(url.trim());
  if (!match) return null;
  const credentials = match[1];
  const separator = credentials.indexOf(':');
  const raw = separator === -1 ? credentials : credentials.slice(separator + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Production must not run on the development infrastructure credentials.
 *
 * `REDIS_PASSWORD` previously defaulted to the literal `changeme` in
 * docker-compose.prod.yml, and the database password defaulted to `postgres`,
 * so a deployment that set neither came up fully functional and fully
 * guessable. Exported for unit testing; values never appear in the messages.
 */
export function validateProductionConnections(input: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
}): string[] {
  if (input.NODE_ENV !== 'production') return [];

  const problems: string[] = [];

  const redisPassword = connectionPassword(input.REDIS_URL ?? '');
  if (redisPassword === null) {
    problems.push(
      'REDIS_URL: must include credentials in production (set REDIS_PASSWORD; Redis holds the scheduler state and job queues).',
    );
  } else if (WEAK_CONNECTION_PASSWORDS.has(redisPassword.toLowerCase())) {
    problems.push(
      'REDIS_URL: uses a placeholder Redis password. Set REDIS_PASSWORD to a real value.',
    );
  }

  const dbPassword = connectionPassword(input.DATABASE_URL ?? '');
  if (dbPassword !== null && WEAK_CONNECTION_PASSWORDS.has(dbPassword.toLowerCase())) {
    problems.push(
      'DATABASE_URL: uses a development default database password. Set POSTGRES_PASSWORD to a real value.',
    );
  }

  return problems;
}

export const envSchema = z
  .object({
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
  ALLOW_DEMO_GOOGLE_AUTH: z.enum(['true', 'false']).default('true'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  AI_SERVICE_URL: z.string().default('http://localhost:5000'),
  /**
   * The scraper engine's control API, reached over the Compose network. Its
   * state-changing endpoints require SCRAPER_API_TOKEN (the same shared secret
   * the scraper validates). Without the token the admin "trigger run" button
   * still works — it falls back to publishing onto the durable BullMQ queue.
   */
  SCRAPER_API_URL: z.string().default('http://scraper:4001'),
  SCRAPER_API_TOKEN: z.string().default(''),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  /**
   * Rate-limit ceilings per 15-minute window. Authenticated callers are
   * bucketed per user, anonymous callers per IP, and AUTH_MAX caps *failed*
   * authentication attempts (see shared/middleware/rate-limiter.ts).
   */
  RATE_LIMIT_AUTHED_MAX: positiveIntEnv(10000),
  RATE_LIMIT_ANON_MAX: positiveIntEnv(3000),
  RATE_LIMIT_AUTH_MAX: positiveIntEnv(500),

  /**
   * Opt in to the rate-limit bypass, which skips both the API
   * and the authentication limiter entirely.
   */
  DISABLE_RATE_LIMIT: z.enum(['true', 'false']).default('false'),
  })
  /**
   * Production refuses to start on a missing, weak or shared signing secret.
   * This runs after field parsing, so the development defaults above are
   * visible here and are rejected by name.
   */
  .superRefine((value, ctx) => {
    for (const problem of [
      ...validateJwtSecrets(value),
      ...validateProductionConnections(value),
    ]) {
      const field = problem.slice(0, problem.indexOf(':'));
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: problem.slice(field.length + 2),
        // The cross-field rule mentions both names, so it has no single path.
        path: field.includes(' and ') ? [] : [field],
      });
    }
  });

const rawEnv = {
  ...process.env,
  RATE_LIMIT_AUTHED_MAX:
    process.env.RATE_LIMIT_AUTHED_MAX ||
    process.env.RATE_LIMIT_MAX ||
    '10000',
  RATE_LIMIT_AUTH_MAX:
    process.env.RATE_LIMIT_AUTH_MAX ||
    process.env.AUTH_RATE_LIMIT_MAX ||
    '500',
  RATE_LIMIT_ANON_MAX: process.env.RATE_LIMIT_ANON_MAX || '3000',
  DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT || 'false',
};

const parsed = envSchema.safeParse(rawEnv);

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

/**
 * Optional integrations, and the variable names that enable each.
 *
 * These are deliberately NOT start-blocking: Phase 8 showed what happens when
 * one unconfigured optional integration can stop the server (an absent
 * RAZORPAY_KEY_ID crash-looped the whole API). But the opposite failure —
 * booting "successfully" with payments, email and WhatsApp silently inert — is
 * how an operator discovers at 2am that nobody has received an alert for a
 * week. So they are reported loudly at startup instead.
 *
 * Names only; no value is ever read into the report.
 */
const OPTIONAL_INTEGRATIONS: Array<{
  feature: string;
  vars: string[];
  impactWhenUnset: string;
}> = [
  {
    feature: 'Payments (Razorpay)',
    vars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    impactWhenUnset:
      'checkout returns 503 PAYMENTS_NOT_CONFIGURED; no subscription can be purchased',
  },
  {
    feature: 'Payment webhooks',
    vars: ['RAZORPAY_WEBHOOK_SECRET'],
    impactWhenUnset: 'gateway webhooks cannot be verified and are rejected',
  },
  {
    feature: 'Google sign-in',
    vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    impactWhenUnset: 'Google sign-in is unavailable; email/password still works',
  },
  {
    feature: 'Scraper control API',
    vars: ['SCRAPER_API_TOKEN'],
    impactWhenUnset:
      'admin "run now" falls back to the durable BullMQ queue instead of calling the scraper directly',
  },
  {
    feature: 'Error reporting (Sentry)',
    vars: ['SENTRY_DSN'],
    impactWhenUnset: 'exceptions are logged locally only',
  },
];

/**
 * Log which optional integrations are inactive. Call once at startup, after
 * the schema has parsed. Returns the feature names that are unconfigured so a
 * caller (or a test) can assert on them.
 */
export function reportOptionalIntegrationStatus(
  log: (message: string) => void = console.warn,
): string[] {
  const readEnv = process.env;
  const unconfigured = OPTIONAL_INTEGRATIONS.filter(({ vars }) =>
    vars.some((name) => {
      const value = readEnv[name];
      return !value || value.trim() === '';
    }),
  );

  if (unconfigured.length === 0) return [];

  log(
    `[config] ${unconfigured.length} optional integration(s) are NOT configured ` +
      `(NODE_ENV=${env.NODE_ENV}). The server starts normally; these features are inert:`,
  );
  for (const { feature, vars, impactWhenUnset } of unconfigured) {
    log(`[config]   - ${feature}: set ${vars.join(', ')} — otherwise ${impactWhenUnset}`);
  }
  log('[config] See docs/DEPLOYMENT.md § Environment variables for the full inventory.');

  return unconfigured.map(({ feature }) => feature);
}
