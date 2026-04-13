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
    concurrency: envInt('QUEUE_CONCURRENCY', 3),
    retryAttempts: envInt('QUEUE_RETRY_ATTEMPTS', 3),
    retryBackoffMs: envInt('QUEUE_RETRY_BACKOFF_MS', 5000),
    keepCompletedJobs: envInt('QUEUE_KEEP_COMPLETED', 1000),
    keepFailedJobs: envInt('QUEUE_KEEP_FAILED', 500),
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
    port: envInt('SCRAPER_API_PORT', 4001),
    enabled: envBool('SCRAPER_API_ENABLED', true),
  },

  // --- Environment ---
  env: env('NODE_ENV', 'development'),
  isDev: env('NODE_ENV', 'development') === 'development',
  isProd: env('NODE_ENV', 'development') === 'production',
} as const;

// ---------------------------------------------------------------------------
// Portal registry
// ---------------------------------------------------------------------------

export const PORTAL_CONFIGS: PortalConfig[] = [
  // Central portals
  {
    name: 'GeM',
    key: 'gem',
    url: 'https://gem.gov.in',
    enabled: envBool('PORTAL_GEM_ENABLED', true),
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
    enabled: envBool('PORTAL_CPPP_ENABLED', true),
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
    enabled: envBool('PORTAL_EPROCURE_ENABLED', true),
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
    url: 'https://nprocure.com',
    enabled: envBool('PORTAL_GUJARAT_ENABLED', true),
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
    enabled: envBool('PORTAL_MAHARASHTRA_ENABLED', true),
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
    enabled: envBool('PORTAL_RAJASTHAN_ENABLED', true),
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
    url: 'https://eproc.karnataka.gov.in',
    enabled: envBool('PORTAL_KARNATAKA_ENABLED', true),
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
    enabled: envBool('PORTAL_TAMILNADU_ENABLED', true),
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
    enabled: envBool('PORTAL_UP_ENABLED', true),
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
    enabled: envBool('PORTAL_MP_ENABLED', true),
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
    enabled: envBool('PORTAL_DELHI_ENABLED', true),
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
    enabled: envBool('PORTAL_KERALA_ENABLED', true),
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
    enabled: envBool('PORTAL_WB_ENABLED', true),
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
