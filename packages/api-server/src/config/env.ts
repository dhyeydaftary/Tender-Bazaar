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
 * What a production REDIS_URL looks like once parsed. `null` when the value is
 * not a redis:// or rediss:// URL at all.
 */
export function parseRedisUrl(
  value: string | undefined,
): { host: string; username: string; password: string | null; tls: boolean } | null {
  const trimmed = (value ?? '').trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') return null;
  if (!url.hostname) return null;
  const decode = (raw: string) => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };
  const password = url.password === '' ? null : decode(url.password);
  return { host: url.hostname, username: decode(url.username), password, tls: url.protocol === 'rediss:' };
}

/**
 * Production must not run on the development infrastructure credentials.
 *
 * `REDIS_PASSWORD` previously defaulted to the literal `changeme` in
 * docker-compose.prod.yml, and the database password defaulted to `postgres`,
 * so a deployment that set neither came up fully functional and fully
 * guessable.
 *
 * Redis in particular:
 *   - the URL must parse as redis:// or rediss://;
 *   - an unauthenticated loopback URL is the development default and refused;
 *   - a password, when present, must not be a known placeholder;
 *   - a username without a password is malformed and refused;
 *   - a URL WITHOUT a password is accepted only with the explicit opt-in
 *     REDIS_ALLOW_UNAUTHENTICATED=true. Render's Key Value service hands out
 *     an internal URL with no credentials by default; the opt-in records the
 *     operator's statement that the instance is reachable only on a private
 *     network. Nothing is inferred from the hostname, which the API cannot
 *     verify.
 *
 * Exported for unit testing; values never appear in the messages.
 */
export function validateProductionConnections(input: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  REDIS_ALLOW_UNAUTHENTICATED?: string;
}): string[] {
  if (input.NODE_ENV !== 'production') return [];

  const problems: string[] = [];

  const redis = parseRedisUrl(input.REDIS_URL);
  if (!redis) {
    problems.push('REDIS_URL: must be a valid redis:// or rediss:// URL in production.');
  } else if (redis.password === null) {
    if (isLoopbackHost(redis.host)) {
      // An unauthenticated loopback URL is the development default, whatever
      // the opt-in says. An authenticated loopback URL (a sidecar) stays valid.
      problems.push('REDIS_URL: must not be the unauthenticated localhost default in production.');
    } else if (redis.username !== '') {
      problems.push('REDIS_URL: has a username but no password; the credentials are malformed.');
    } else if (input.REDIS_ALLOW_UNAUTHENTICATED !== 'true') {
      problems.push(
        'REDIS_URL: has no password. Either put the Redis password in the URL, or set ' +
          'REDIS_ALLOW_UNAUTHENTICATED=true to confirm this Redis is reachable only on a private network ' +
          "(for example Render Key Value's internal URL with authentication off).",
      );
    }
  } else if (WEAK_CONNECTION_PASSWORDS.has(redis.password.toLowerCase())) {
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

/**
 * The only deployment allowed to run simulated ("demo") payments: the isolated
 * client demo (docker-compose.demo*.yml). Both values must match — the marker
 * is set by the demo overlay, and the database name is the same guard the demo
 * seed uses (prisma/demo-seed.ts) — so a stray PAYMENTS_DEMO_MODE=true copied
 * into any other environment cannot switch real billing off.
 */
export const DEMO_DEPLOYMENT_ID = 'tenderbazaar-demo';
export const DEMO_DATABASE_NAME = 'tenderbazaar_demo';

/** The database name of a `scheme://user:pass@host:port/name?params` URL. */
export function databaseNameOf(url: string | undefined): string | null {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*\/([^/?#]+)(?:[?#].*)?$/.exec(
    (url ?? '').trim(),
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * PAYMENTS_DEMO_MODE=true replaces Razorpay with a simulated checkout that
 * activates subscriptions without taking money. It is refused — the server does
 * not start — unless every condition below holds, whatever NODE_ENV is:
 *
 *   - DEMO_DEPLOYMENT is exactly `tenderbazaar-demo`;
 *   - DATABASE_URL points at the `tenderbazaar_demo` database;
 *   - no Razorpay key is configured (a deployment holding real credentials is
 *     a billing deployment, and must never silently simulate payments).
 *
 * Exported for unit testing; values never appear in the messages.
 */
export function validatePaymentsDemoMode(input: {
  PAYMENTS_DEMO_MODE?: string;
  DEMO_DEPLOYMENT?: string;
  DATABASE_URL?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
}): string[] {
  if (input.PAYMENTS_DEMO_MODE !== 'true') return [];

  const problems: string[] = [];

  if (input.DEMO_DEPLOYMENT !== DEMO_DEPLOYMENT_ID) {
    problems.push(
      `PAYMENTS_DEMO_MODE: is only allowed in the isolated demo deployment (DEMO_DEPLOYMENT=${DEMO_DEPLOYMENT_ID}).`,
    );
  }

  if (databaseNameOf(input.DATABASE_URL) !== DEMO_DATABASE_NAME) {
    problems.push(
      `PAYMENTS_DEMO_MODE: is only allowed against the ${DEMO_DATABASE_NAME} database.`,
    );
  }

  if ((input.RAZORPAY_KEY_ID ?? '').trim() !== '' || (input.RAZORPAY_KEY_SECRET ?? '').trim() !== '') {
    problems.push(
      'PAYMENTS_DEMO_MODE: must not be combined with Razorpay credentials; unset RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET or turn demo payments off.',
    );
  }

  return problems;
}

/**
 * Whether development-only shortcuts (mock payments, dev CORS origins, the
 * rate-limit bypass, verbose errors) may run.
 *
 * Takes the RAW `process.env.NODE_ENV`, not the schema value: the schema
 * defaults an unset NODE_ENV to 'development' so a bare local checkout keeps
 * working, but a server that simply forgot to set NODE_ENV must not thereby
 * switch every development shortcut on. Only an explicit
 * `NODE_ENV=development` does that.
 */
export function developmentShortcutsAllowed(rawNodeEnv: string | undefined): boolean {
  return rawNodeEnv === 'development';
}

/**
 * Environment variables set by hosting platforms on every service they run.
 * Their presence means "this is a hosted deployment", where NODE_ENV must be
 * set to 'production' explicitly: a deployed API must never run with the
 * development defaults (localhost URLs, the public development signing
 * secrets) just because NODE_ENV was forgotten.
 *
 * Render, the deployment target, sets RENDER=true and RENDER_SERVICE_ID on
 * all services. The other names are the equivalent markers of common
 * platforms, so the same rule holds if the API is ever moved. None of them is
 * set on a developer machine or in CI. Exported for the tests.
 */
export const HOSTED_PLATFORM_MARKERS = [
  'RENDER',
  'RENDER_SERVICE_ID',
  'FLY_APP_NAME', // Fly.io
  'RAILWAY_ENVIRONMENT', // Railway
  'DYNO', // Heroku
  'K_SERVICE', // Google Cloud Run
  'WEBSITE_SITE_NAME', // Azure App Service
  'ECS_CONTAINER_METADATA_URI_V4', // AWS ECS / Fargate
] as const;

/**
 * A browser origin the API may trust for CORS: an absolute http(s) URL with no
 * path, query, fragment, credentials or wildcard. Returns a problem
 * description, or null when acceptable. In production the origin must also be
 * https and must not be a loopback host.
 */
export function checkTrustedOrigin(
  name: string,
  value: string,
  production: boolean,
): string | null {
  const trimmed = value.trim();
  if (trimmed.includes('*')) {
    return `${name}: wildcards are not allowed; list each trusted origin exactly.`;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return `${name}: must be an absolute URL such as https://app.example.com.`;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return `${name}: must use http or https.`;
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    return `${name}: must be a bare origin (scheme://host[:port]) with no path, query or credentials.`;
  }
  if (production) {
    if (url.protocol !== 'https:') {
      return `${name}: must use https in production.`;
    }
    if (isLoopbackHost(url.hostname)) {
      return `${name}: must not point at localhost in production.`;
    }
  }
  return null;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    /^127\./.test(hostname)
  );
}

/** Split a comma-separated origin list, dropping empty entries. */
export function parseOriginList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
}

/**
 * Settings a production API must have, checked against the RAW environment
 * (before schema defaults), because several schema defaults point at
 * localhost and would otherwise be silently accepted.
 *
 *   - On a hosted platform (Render), NODE_ENV must be exactly 'production'.
 *   - In production, DATABASE_URL and FRONTEND_URL must be set explicitly,
 *     every CORS origin must be a bare https origin that is not localhost, the
 *     removed unsigned Google sign-in must not be requested, Google client ids
 *     must look like real ones, and Razorpay must be configured completely or
 *     not at all.
 *
 * Exported for unit testing; values never appear in the messages.
 */
export function validateDeploymentEnvironment(raw: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const nodeEnv = raw.NODE_ENV;

  const hostedMarker = HOSTED_PLATFORM_MARKERS.find((name) => (raw[name] ?? '').trim() !== '');
  if (hostedMarker && nodeEnv !== 'production') {
    problems.push(
      `NODE_ENV: must be set to 'production' on a hosted deployment (${hostedMarker} is set); ` +
        `got ${nodeEnv === undefined || nodeEnv === '' ? 'nothing' : `'${nodeEnv}'`}.`,
    );
  }

  if (nodeEnv !== 'production') return problems;

  if ((raw.DATABASE_URL ?? '').trim() === '') {
    problems.push('DATABASE_URL: must be set in production (the development default points at localhost).');
  }

  if ((raw.REDIS_URL ?? '').trim() === '') {
    problems.push('REDIS_URL: must be set in production (the development default points at localhost).');
  }

  if ((raw.FRONTEND_URL ?? '').trim() === '') {
    problems.push('FRONTEND_URL: must be set in production; it is the web origin trusted by CORS and used in emailed links.');
  } else {
    const problem = checkTrustedOrigin('FRONTEND_URL', raw.FRONTEND_URL!, true);
    if (problem) problems.push(problem);
  }

  if ((raw.ADMIN_URL ?? '').trim() !== '') {
    const problem = checkTrustedOrigin('ADMIN_URL', raw.ADMIN_URL!, true);
    if (problem) problems.push(problem);
  }

  for (const origin of parseOriginList(raw.CORS_ORIGINS)) {
    const problem = checkTrustedOrigin('CORS_ORIGINS', origin, true);
    if (problem) problems.push(problem);
  }

  if (raw.ALLOW_DEMO_GOOGLE_AUTH === 'true') {
    problems.push(
      'ALLOW_DEMO_GOOGLE_AUTH: unsigned Google sign-in has been removed and must not be requested in production; unset it.',
    );
  }

  for (const clientId of parseOriginList(raw.GOOGLE_CLIENT_ID)) {
    if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)) {
      problems.push(
        'GOOGLE_CLIENT_ID: must be one or more OAuth client ids ending in .apps.googleusercontent.com, or unset to disable Google sign-in.',
      );
      break;
    }
  }

  const aiToken = (raw.AI_SERVICE_TOKEN ?? '').trim();
  if (aiToken !== '') {
    if (aiToken.length < 16) {
      problems.push('AI_SERVICE_TOKEN: must be at least 16 characters in production (or unset to disable AI calls).');
    } else if (/^dev-|placeholder|change[-_ ]?me|your-/i.test(aiToken)) {
      problems.push('AI_SERVICE_TOKEN: is a development or placeholder value and must not be used in production.');
    }
  }

  const hasKeyId = (raw.RAZORPAY_KEY_ID ?? '').trim() !== '';
  const hasKeySecret = (raw.RAZORPAY_KEY_SECRET ?? '').trim() !== '';
  if (hasKeyId !== hasKeySecret) {
    problems.push(
      'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET: set both (payments enabled) or neither (payments disabled); a partial configuration cannot verify payments.',
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
  /**
   * Explicit statement that REDIS_URL may carry no password because the Redis
   * instance is reachable only on a private network (Render Key Value's
   * default internal URL). Without it, production refuses an unauthenticated
   * URL. It never relaxes the placeholder-password or malformed-URL checks.
   */
  REDIS_ALLOW_UNAUTHENTICATED: z.enum(['true', 'false']).default('false'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  /**
   * Elasticsearch is optional: tender search falls back to PostgreSQL whenever
   * it is unreachable. 'false' turns it off entirely (no index setup, no
   * boot-time reindex, /health reports it as disabled) for deployments without
   * a cluster. The tender-index queue is still drained so it stays bounded.
   */
  ELASTICSEARCH_ENABLED: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('dev-jwt-refresh-secret-change-in-production'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  /**
   * OAuth client id(s) whose Google ID tokens are accepted, comma-separated
   * when the web and mobile apps use different clients. Empty disables Google
   * sign-in (the endpoint answers 503).
   */
  GOOGLE_CLIENT_ID: z.string().trim().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /**
   * Retired. It used to enable a sign-in path that accepted unsigned,
   * client-generated Google tokens; that path has been removed and Google ID
   * tokens are always verified. Still parsed so a stale 'true' is caught:
   * production refuses to start with it (validateDeploymentEnvironment).
   */
  ALLOW_DEMO_GOOGLE_AUTH: z.enum(['true', 'false']).default('false'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  /** The admin app's origin, trusted by CORS alongside FRONTEND_URL. */
  ADMIN_URL: z.string().default(''),
  /**
   * Further exact origins trusted by CORS, comma-separated (for example a
   * custom domain alongside the *.vercel.app one). No wildcards.
   */
  CORS_ORIGINS: z.string().default(''),
  AI_SERVICE_URL: z.string().default('http://localhost:5000'),
  /**
   * Shared secret presented to the AI service as `Authorization: Bearer ...`
   * (config/ai-service.ts). The AI service refuses every request without it.
   * Server-side only; never a NEXT_PUBLIC_* value. Empty disables AI calls
   * (they fall back to the rule-based results, as when the service is down).
   */
  AI_SERVICE_TOKEN: z.string().trim().default(''),
  /**
   * The scraper engine's control API, reached over the Compose network. Its
   * state-changing endpoints require SCRAPER_API_TOKEN (the same shared secret
   * the scraper validates). Without the token the admin "trigger run" button
   * still works — it falls back to publishing onto the durable BullMQ queue.
   */
  SCRAPER_API_URL: z.string().default('http://scraper:4001'),
  SCRAPER_API_TOKEN: z.string().default(''),
  /**
   * When the engine is unreachable, publish the run onto the durable BullMQ
   * queue instead (default). The demo configuration sets 'false': it has no
   * queue consumer, so a queued job would never run.
   */
  SCRAPER_QUEUE_FALLBACK: z.enum(['true', 'false']).default('true'),
  /**
   * Trimmed, so a whitespace-only value is exactly '' — "not configured" — for
   * every consumer. Untrimmed, `'  '` read as configured (isRazorpayConfigured,
   * the webhook check) while being a key anyone can guess, which made the
   * HMACs it "verifies" forgeable.
   */
  RAZORPAY_KEY_ID: z.string().trim().default(''),
  RAZORPAY_KEY_SECRET: z.string().trim().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().default(''),
  /**
   * Simulated checkout for the isolated client demo only. Off by default; when
   * 'true', validatePaymentsDemoMode() must pass or the server refuses to start.
   */
  PAYMENTS_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  /** Identifies the isolated demo deployment; see validatePaymentsDemoMode. */
  DEMO_DEPLOYMENT: z.string().default(''),

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
      ...validatePaymentsDemoMode(value),
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
const deploymentProblems = validateDeploymentEnvironment(process.env);

if (!parsed.success || deploymentProblems.length > 0) {
  // Report which variables are wrong and why, but never their values: this
  // schema also carries JWT secrets, Razorpay keys and the database URL.
  const problems = [
    ...(parsed.success
      ? []
      : parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)),
    ...deploymentProblems,
  ]
    .map((problem) => `  - ${problem}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = parsed.data;

/** See developmentShortcutsAllowed: true only for an explicit NODE_ENV=development. */
export const DEVELOPMENT_SHORTCUTS_ENABLED = developmentShortcutsAllowed(process.env.NODE_ENV);

if (process.env.NODE_ENV === undefined || process.env.NODE_ENV === '') {
  console.warn(
    '[config] NODE_ENV is not set. Running with development defaults but WITHOUT development shortcuts ' +
      '(mock payments, dev CORS origins, rate-limit bypass). Set NODE_ENV=development locally or NODE_ENV=production when deployed.',
  );
}
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
    feature: 'AI service authentication',
    vars: ['AI_SERVICE_TOKEN'],
    impactWhenUnset:
      'the AI service refuses every call (401/503) and eligibility, summaries and the bid assistant fall back to rule-based results',
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
