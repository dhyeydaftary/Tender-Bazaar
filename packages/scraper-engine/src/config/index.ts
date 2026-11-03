/**
 * Scraper Engine Configuration
 *
 * Centralised config with environment variable loading and validation.
 * All durations are in milliseconds unless noted otherwise.
 */

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`[ScraperConfig] Missing required env var: ${key}`);
  }
  return value;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw === 'true' || raw === '1';
}

// ---------------------------------------------------------------------------
// Portal definitions
// ---------------------------------------------------------------------------

export interface PortalConfig {
  name: string;
  key: string;
  url: string;
  enabled: boolean;
  cronExpression: string;
  priority: number;
  maxConcurrency: number;
  requestDelayMs: number;
  maxPages: number;
  retryCount: number;
  retryDelayMs: number;
  timeoutMs: number;
  type: 'central' | 'state';
  state?: string;
  usePlaywright: boolean;
}

// ---------------------------------------------------------------------------
// Config object
// ---------------------------------------------------------------------------

export const config = {
  // --- Database ---
  database: {
    url: env('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tenderbazaar'),
  },

  // --- Redis ---
  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
    keyPrefix: 'tb:scraper:',
  },

  // --- Scraper defaults ---
  scraper: {
    defaultConcurrency: envInt('SCRAPER_CONCURRENCY', 2),
    defaultRequestDelayMs: envInt('SCRAPER_REQUEST_DELAY_MS', 2000),
    defaultRetryCount: envInt('SCRAPER_RETRY_COUNT', 3),
    defaultRetryDelayMs: envInt('SCRAPER_RETRY_DELAY_MS', 1000),
    defaultTimeoutMs: envInt('SCRAPER_TIMEOUT_MS', 30000),
    defaultMaxPages: envInt('SCRAPER_MAX_PAGES', 10),
    respectRobotsTxt: envBool('SCRAPER_RESPECT_ROBOTS_TXT', true),
    userAgentRotation: envBool('SCRAPER_UA_ROTATION', true),
  },

  // --- BullMQ ---
  queue: {
    name: 'scraper-jobs',
    /**
     * Queue carrying PostgreSQL -> Elasticsearch sync jobs. Produced here,
     * consumed by api-server (which owns the ES client and document mapping).
     * Both sides must agree on this name.
     */
    tenderIndexName: env('TENDER_INDEX_QUEUE', 'tender-index'),
    concurrency: envInt('QUEUE_CONCURRENCY', 3),
    retryAttempts: envInt('QUEUE_RETRY_ATTEMPTS', 3),
    /**
     * Exponential-backoff base for scrape retries: 60s, then 120s, then 240s.
     *
     * The default was 5000 while the scheduler hardcoded 60000 and ignored this
     * value entirely, so the two disagreed and neither env var had any effect.
     * 60000 is the documented policy, so it is the default here now.
     */
    retryBackoffMs: envInt('QUEUE_RETRY_BACKOFF_MS', 60000),
    keepCompletedJobs: envInt('QUEUE_KEEP_COMPLETED', 1000),
    keepFailedJobs: envInt('QUEUE_KEEP_FAILED', 500),
  },

  // --- Missed-window recovery ---
  // node-cron never replays a tick it missed, so a gap is reconstructed from
  // ScraperHealth.lastRunAt. See scheduler/missed-windows.ts.
  missedWindows: {
    /** How often to sweep. 0 disables missed-window recovery entirely. */
    sweepMs: envInt('MISSED_WINDOW_SWEEP_MS', 300_000),
    /** How long a closed window is forgiven before it counts as missed. */
    graceMs: envInt('MISSED_WINDOW_GRACE_MS', 90_000),
    /** Hard cap on catch-up runs per portal per sweep, to bound a backlog. */
    maxCatchUp: envInt('MISSED_WINDOW_MAX_CATCHUP', 1),
  },

  // --- Playwright ---
  playwright: {
    headless: envBool('PLAYWRIGHT_HEADLESS', true),
    browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    maxContexts: envInt('PLAYWRIGHT_MAX_CONTEXTS', 3),
  },

  // --- Proxy ---
  proxy: {
    urls: process.env.PROXY_URLS ? process.env.PROXY_URLS.split(',').map(s => s.trim()) : [],
    rotatePerRequest: envBool('PROXY_ROTATE_PER_REQUEST', true),
  },

  // --- Logging ---
  logging: {
    level: env('LOG_LEVEL', 'info'),
    enableConsole: envBool('LOG_CONSOLE', true),
    enableFile: envBool('LOG_FILE', false),
    filePath: env('LOG_FILE_PATH', './logs/scraper.log'),
  },

  // --- Admin API ---
  api: {
    // Hosting platforms hand the service its port as PORT; SCRAPER_API_PORT
    // still wins when both are set (Compose sets it explicitly).
    port: envInt('SCRAPER_API_PORT', envInt('PORT', 4001)),
    enabled: envBool('SCRAPER_API_ENABLED', true),
    /**
     * Shared secret required by every state-changing control endpoint
     * (scheduler start/stop, portal run, portal toggle). The API was previously
     * completely unauthenticated with `Access-Control-Allow-Origin: *`, and the
     * port was published to the host, so anyone who could reach it could stop
     * scheduling outright.
     *
     * api-server sends the same value (SCRAPER_API_TOKEN) when it triggers a
     * run. Production startup fails when this is missing or a known
     * placeholder — see assertApiSecurity().
     */
    token: process.env.SCRAPER_API_TOKEN ?? '',
    /**
     * Comma-separated browser origins allowed to call the API. Empty (the
     * default) sends no CORS headers at all, which is correct for a
     * service-to-service API: CORS is not authentication and the previous `*`
     * bought nothing but exposure.
     */
    allowedOrigins: (process.env.SCRAPER_API_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  /**
   * Test-only control hooks (currently: invoking the failed-job retry sweep on
   * demand). Used by the isolated mock-portal verification, because the sweep's
   * only production trigger is an hourly cron and changing that cron for a test
   * would alter production behaviour.
   *
   * Requires BOTH flags, and that is deliberate:
   *
   *   PORTAL_TEST_ENABLED  already implies a test environment — the process
   *                        refuses to boot unless TEST_PORTAL_URL is a
   *                        loopback/private/Compose-internal host (see
   *                        assertTestPortalUrl), so it cannot be true in a
   *                        deployment pointed at real portals;
   *   SCRAPER_TEST_HOOKS   an explicit, separate opt-in, so a stray
   *                        PORTAL_TEST_ENABLED alone never exposes an endpoint.
   *
   * Both default to false, so a normal production deployment never registers
   * the hook at all — the route does not exist rather than being merely
   * guarded.
   */
  testHooksEnabled:
    envBool('PORTAL_TEST_ENABLED', false) && envBool('SCRAPER_TEST_HOOKS', false),

  // --- Environment ---
  env: env('NODE_ENV', 'development'),
  isDev: env('NODE_ENV', 'development') === 'development',
  isProd: env('NODE_ENV', 'development') === 'production',
} as const;

// ---------------------------------------------------------------------------
// Portal registry
// ---------------------------------------------------------------------------

/**
 * Default `enabled` for the 13 REAL government portals.
 *
 * In production this is **false**: contacting a real government portal must be
 * an explicit, per-portal deployment decision (`PORTAL_<NAME>_ENABLED=true`),
 * never something a deployment inherits by forgetting to opt out. Previously
 * every real portal defaulted to true, so merely starting the production stack
 * would begin scraping all 13 — including the three Playwright portals, whose
 * memory profile has never been measured.
 *
 * Outside production the default stays **true**, so development and the
 * existing test suites behave exactly as before. The local mock portal is
 * unaffected either way: it is registered separately and gated on
 * `PORTAL_TEST_ENABLED`, which defaults to false.
 *
 * Note the interaction with the database toggle (see `applyOverrides` in
 * scheduler.ts): the env flag and the `ScraperHealth` row are **ANDed**, so a
 * portal left at the production default cannot be switched on by the admin
 * toggle alone — it needs the environment variable and a container restart.
 * That is deliberate for a kill switch, and is documented in
 * docs/DEPLOYMENT.md § Portal enablement policy.
 */
const realPortalDefault = !config.isProd;

export const PORTAL_CONFIGS: PortalConfig[] = [
  // Central portals
  {
    name: 'GeM',
    key: 'gem',
    url: 'https://gem.gov.in',
    enabled: envBool('PORTAL_GEM_ENABLED', realPortalDefault),
    cronExpression: '0 */2 * * *', // Every 2 hours
    priority: 1,
    maxConcurrency: 2,
    requestDelayMs: 3000,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 30000,
    type: 'central',
    usePlaywright: false,
  },
  {
    name: 'CPPP',
    key: 'cppp',
    url: 'https://eprocure.gov.in/cppp',
    enabled: envBool('PORTAL_CPPP_ENABLED', realPortalDefault),
    cronExpression: '0 */4 * * *', // Every 4 hours
    priority: 1,
    maxConcurrency: 2,
    requestDelayMs: 3000,
    maxPages: 20,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'central',
    usePlaywright: false,
  },
  {
    name: 'eProcure',
    key: 'eprocure',
    url: 'https://eprocure.gov.in/eprocure/app',
    enabled: envBool('PORTAL_EPROCURE_ENABLED', realPortalDefault),
    cronExpression: '30 */4 * * *', // Every 4 hours at :30
    priority: 2,
    maxConcurrency: 2,
    requestDelayMs: 3000,
    maxPages: 15,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'central',
    usePlaywright: false,
  },
  // State portals
  {
    name: 'Gujarat',
    key: 'gujarat',
    url: 'https://tender.nprocure.com',
    enabled: envBool('PORTAL_GUJARAT_ENABLED', realPortalDefault),
    cronExpression: '0 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Gujarat',
    usePlaywright: true,
  },
  {
    name: 'Maharashtra',
    key: 'maharashtra',
    url: 'https://mahatenders.gov.in',
    enabled: envBool('PORTAL_MAHARASHTRA_ENABLED', realPortalDefault),
    cronExpression: '10 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Maharashtra',
    usePlaywright: true,
  },
  {
    name: 'Rajasthan',
    key: 'rajasthan',
    url: 'https://eproc.rajasthan.gov.in',
    enabled: envBool('PORTAL_RAJASTHAN_ENABLED', realPortalDefault),
    cronExpression: '20 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Rajasthan',
    usePlaywright: false,
  },
  {
    name: 'Karnataka',
    key: 'karnataka',
    url: 'https://kppp.karnataka.gov.in',
    enabled: envBool('PORTAL_KARNATAKA_ENABLED', realPortalDefault),
    cronExpression: '30 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Karnataka',
    usePlaywright: false,
  },
  {
    name: 'TamilNadu',
    key: 'tamilnadu',
    url: 'https://tntenders.gov.in',
    enabled: envBool('PORTAL_TAMILNADU_ENABLED', realPortalDefault),
    cronExpression: '40 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Tamil Nadu',
    usePlaywright: true,
  },
  {
    name: 'UP',
    key: 'up',
    url: 'https://etender.up.nic.in',
    enabled: envBool('PORTAL_UP_ENABLED', realPortalDefault),
    cronExpression: '50 */6 * * *',
    priority: 3,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Uttar Pradesh',
    usePlaywright: false,
  },
  {
    name: 'MP',
    key: 'mp',
    url: 'https://mptenders.gov.in',
    enabled: envBool('PORTAL_MP_ENABLED', realPortalDefault),
    cronExpression: '0 1,7,13,19 * * *',
    priority: 4,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Madhya Pradesh',
    usePlaywright: false,
  },
  {
    name: 'Delhi',
    key: 'delhi',
    url: 'https://govtprocurement.delhi.gov.in',
    enabled: envBool('PORTAL_DELHI_ENABLED', realPortalDefault),
    cronExpression: '10 1,7,13,19 * * *',
    priority: 4,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Delhi',
    usePlaywright: false,
  },
  {
    name: 'Kerala',
    key: 'kerala',
    url: 'https://etenders.kerala.gov.in',
    enabled: envBool('PORTAL_KERALA_ENABLED', realPortalDefault),
    cronExpression: '20 1,7,13,19 * * *',
    priority: 4,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'Kerala',
    usePlaywright: false,
  },
  {
    name: 'WestBengal',
    key: 'westbengal',
    url: 'https://wbtenders.gov.in',
    enabled: envBool('PORTAL_WB_ENABLED', realPortalDefault),
    cronExpression: '30 1,7,13,19 * * *',
    priority: 4,
    maxConcurrency: 2,
    requestDelayMs: 2500,
    maxPages: 10,
    retryCount: 3,
    retryDelayMs: 2000,
    timeoutMs: 45000,
    type: 'state',
    state: 'West Bengal',
    usePlaywright: false,
  },
];

// ---------------------------------------------------------------------------
// Local test portal (opt-in, never a real site)
// ---------------------------------------------------------------------------

/**
 * Hosts a test portal URL may point at: loopback, RFC1918 ranges, and the
 * single-label Docker-Compose service names used by the disposable staging
 * stack. Anything else — in particular any public hostname — is rejected.
 *
 * The point is that `PORTAL_TEST_ENABLED=true` left in an environment by
 * accident still cannot cause traffic to a real government portal: the process
 * refuses to boot instead.
 */
export function assertTestPortalUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`[ScraperConfig] TEST_PORTAL_URL is not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`[ScraperConfig] TEST_PORTAL_URL must be http(s): ${raw}`);
  }

  const host = url.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  const isPrivateV4 =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  // A single-label name cannot resolve on the public internet; on the Compose
  // network it is the mock-portal service.
  const isComposeServiceName = /^[a-z0-9][a-z0-9-]*$/.test(host) && !host.includes('.');

  if (!isLoopback && !isPrivateV4 && !isComposeServiceName) {
    throw new Error(
      `[ScraperConfig] TEST_PORTAL_URL must be a loopback, private or Compose-internal ` +
        `host — refusing to point the local test portal at '${host}'.`,
    );
  }

  return url;
}

/**
 * The local mock portal, appended to the registry only when
 * PORTAL_TEST_ENABLED=true.
 *
 * It exists so that recurring scheduler execution, run records, BullMQ
 * retry/backoff, per-portal locking, portal disable and restart recovery can
 * be verified against something that behaves like a portal without any
 * external traffic. See docker/mock-portal/server.js and
 * src/scrapers/test-portal-scraper.ts.
 */
if (envBool('PORTAL_TEST_ENABLED', false)) {
  const testPortalUrl = assertTestPortalUrl(
    env('TEST_PORTAL_URL', 'http://127.0.0.1:18080'),
  );

  PORTAL_CONFIGS.push({
    name: 'LocalTestPortal',
    key: 'testportal',
    url: testPortalUrl.origin,
    enabled: true,
    cronExpression: env('PORTAL_TEST_CRON', '*/2 * * * *'),
    priority: 9,
    maxConcurrency: 2,
    requestDelayMs: 50,
    maxPages: 1,
    retryCount: 1,
    retryDelayMs: 200,
    timeoutMs: 10000,
    type: 'central',
    usePlaywright: false,
  });

  console.warn(
    `[ScraperConfig] PORTAL_TEST_ENABLED=true — local test portal registered ` +
      `at ${testPortalUrl.origin} (cron ${env('PORTAL_TEST_CRON', '*/2 * * * *')}). ` +
      `This must never be set in a real deployment.`,
  );
}

// ---------------------------------------------------------------------------
// Control-API security validation
// ---------------------------------------------------------------------------

/** Placeholder control-API tokens that must never be used in production. */
const PLACEHOLDER_API_TOKENS = new Set([
  'dev-scraper-api-token',
  'changeme',
  'change-me',
  'secret',
  'token',
  'scraper',
  'test',
]);

/** Minimum length for a production control-API token. */
export const MIN_API_TOKEN_LENGTH = 16;

/**
 * Validate the control-API security configuration.
 *
 * Returns a list of problems; empty means acceptable. Pure, so it can be
 * unit-tested without touching process.env. Values are never included in the
 * messages.
 */
export function validateApiSecurity(input: {
  nodeEnv: string;
  apiEnabled: boolean;
  token: string;
}): string[] {
  if (!input.apiEnabled) return [];
  if (input.nodeEnv !== 'production') return [];

  const problems: string[] = [];
  const token = input.token.trim();

  if (token === '') {
    problems.push(
      'SCRAPER_API_TOKEN: must be set in production — the scraper control API would otherwise accept unauthenticated scheduler and portal commands.',
    );
  } else if (token.length < MIN_API_TOKEN_LENGTH) {
    problems.push(
      `SCRAPER_API_TOKEN: must be at least ${MIN_API_TOKEN_LENGTH} characters in production (got ${token.length}).`,
    );
  } else if (PLACEHOLDER_API_TOKENS.has(token.toLowerCase())) {
    problems.push(
      'SCRAPER_API_TOKEN: is a known placeholder value and must not be used in production.',
    );
  }

  return problems;
}

/**
 * Fail closed: throw when the control-API security configuration is unsafe for
 * the current environment. Called during boot, before the API starts listening.
 */
export function assertApiSecurity(): void {
  const problems = validateApiSecurity({
    nodeEnv: config.env,
    apiEnabled: config.api.enabled,
    token: config.api.token,
  });

  if (problems.length > 0) {
    throw new Error(
      `Invalid scraper control-API configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join('\n')}`,
    );
  }
}

/**
 * Get portal config by key.
 */
export function getPortalConfig(key: string): PortalConfig | undefined {
  return PORTAL_CONFIGS.find((p) => p.key === key);
}

/**
 * Get all enabled portals.
 */
export function getEnabledPortals(): PortalConfig[] {
  return PORTAL_CONFIGS.filter((p) => p.enabled);
}

/**
 * Get portals by type.
 */
export function getPortalsByType(type: 'central' | 'state'): PortalConfig[] {
  return PORTAL_CONFIGS.filter((p) => p.type === type && p.enabled);
}
