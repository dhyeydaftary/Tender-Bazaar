import PQueue from 'p-queue';
import Redis from 'ioredis';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimiterConfig {
  /** Portal identifier (used as Redis key prefix) */
  portalName: string;

  /** Max concurrent requests */
  concurrency?: number;

  /** Minimum interval between requests in ms */
  intervalMs?: number;

  /** Number of requests allowed per interval */
  intervalCap?: number;

  /** Redis instance for tracking request counts */
  redis?: Redis;

  /** Whether to check and respect robots.txt (default true) */
  respectRobotsTxt?: boolean;

  /** Base URL of the portal (for robots.txt fetching) */
  portalUrl?: string;
}

export interface RequestStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisHour: number;
  lastRequestAt: string | null;
}

// ---------------------------------------------------------------------------
// Robots.txt parser (basic implementation)
// ---------------------------------------------------------------------------

interface RobotRules {
  disallowedPaths: string[];
  crawlDelay: number | null;
  sitemapUrls: string[];
}

async function fetchRobotsTxt(baseUrl: string): Promise<RobotRules> {
  const rules: RobotRules = {
    disallowedPaths: [],
    crawlDelay: null,
    sitemapUrls: [],
  };

  try {
    const url = new URL('/robots.txt', baseUrl).toString();
    const response = await axios.get(url, {
      timeout: 10_000,
      validateStatus: (status) => status === 200,
    });

    const text = response.data as string;
    let inOurSection = false; // Track if we're in a section that applies to us

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const [directive, ...valueParts] = line.split(':');
      const key = directive.trim().toLowerCase();
      const value = valueParts.join(':').trim();

      if (key === 'user-agent') {
        // We obey rules for "*" (all bots)
        inOurSection = value === '*';
      } else if (inOurSection) {
        if (key === 'disallow' && value) {
          rules.disallowedPaths.push(value);
        } else if (key === 'crawl-delay') {
          const delay = parseFloat(value);
          if (!isNaN(delay)) {
            rules.crawlDelay = delay;
          }
        }
      }

      if (key === 'sitemap' && value) {
        rules.sitemapUrls.push(value);
      }
    }
  } catch {
    // If robots.txt is unavailable, assume no restrictions
  }

  return rules;
}

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

export class RateLimiter {
  private queue: PQueue;
  private redis: Redis | null;
  private portalName: string;
  private robotRules: RobotRules | null = null;
  private respectRobotsTxt: boolean;
  private portalUrl: string;
  private initialized: boolean = false;

  constructor(config: RateLimiterConfig) {
    this.portalName = config.portalName;
    this.redis = config.redis ?? null;
    this.respectRobotsTxt = config.respectRobotsTxt ?? true;
    this.portalUrl = config.portalUrl ?? '';

    this.queue = new PQueue({
      concurrency: config.concurrency ?? 2,
      interval: config.intervalMs ?? 2000,
      intervalCap: config.intervalCap ?? 1,
    });
  }

  /**
   * Initialize the rate limiter: fetch robots.txt rules if configured.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.respectRobotsTxt && this.portalUrl) {
      this.robotRules = await fetchRobotsTxt(this.portalUrl);

      // Adjust rate limit based on crawl-delay from robots.txt
      if (this.robotRules.crawlDelay !== null) {
        const delayMs = this.robotRules.crawlDelay * 1000;
        console.log(
          `[RateLimiter:${this.portalName}] Adjusting interval to ${delayMs}ms based on robots.txt crawl-delay`,
        );
        // Re-create queue with adjusted interval
        const currentConcurrency = this.queue.concurrency;
        this.queue = new PQueue({
          concurrency: currentConcurrency,
          interval: delayMs,
          intervalCap: 1,
        });
      }
    }

    this.initialized = true;
  }

  /**
   * Check if a URL path is allowed by robots.txt.
   */
  isPathAllowed(url: string): boolean {
    if (!this.robotRules || this.robotRules.disallowedPaths.length === 0) {
      return true;
    }

    try {
      const urlPath = new URL(url).pathname;
      for (const disallowed of this.robotRules.disallowedPaths) {
        if (urlPath.startsWith(disallowed)) {
          console.warn(
            `[RateLimiter:${this.portalName}] Path blocked by robots.txt: ${urlPath}`,
          );
          return false;
        }
      }
    } catch {
      // If URL parsing fails, allow the request
    }

    return true;
  }

  /**
   * Execute a function within the rate limiter queue.
   * Tracks request counts in Redis if available.
   */
  async execute<T>(fn: () => Promise<T>, url?: string): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check robots.txt compliance
    if (url && !this.isPathAllowed(url)) {
      throw new Error(`Request blocked by robots.txt: ${url}`);
    }

    return this.queue.add(async () => {
      // Track request count in Redis
      if (this.redis) {
        await this.trackRequest();
      }

      return fn();
    }) as Promise<T>;
  }

  /**
   * Track a request in Redis with daily and hourly counters.
   */
  private async trackRequest(): Promise<void> {
    if (!this.redis) return;

    const now = new Date();
    const dateKey = `scraper:requests:${this.portalName}:${now.toISOString().substring(0, 10)}`;
    const hourKey = `scraper:requests:${this.portalName}:${now.toISOString().substring(0, 13)}`;
    const lastKey = `scraper:last_request:${this.portalName}`;

    const pipeline = this.redis.pipeline();

    // Increment daily counter (TTL 48 hours)
    pipeline.incr(dateKey);
    pipeline.expire(dateKey, 172_800);

    // Increment hourly counter (TTL 2 hours)
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 7200);

    // Store last request timestamp
    pipeline.set(lastKey, now.toISOString());

    await pipeline.exec();
  }

  /**
   * Get request statistics from Redis.
   */
  async getStats(): Promise<RequestStats> {
    if (!this.redis) {
      return {
        totalRequests: 0,
        requestsToday: 0,
        requestsThisHour: 0,
        lastRequestAt: null,
      };
    }

    const now = new Date();
    const dateKey = `scraper:requests:${this.portalName}:${now.toISOString().substring(0, 10)}`;
    const hourKey = `scraper:requests:${this.portalName}:${now.toISOString().substring(0, 13)}`;
    const lastKey = `scraper:last_request:${this.portalName}`;

    const [todayCount, hourCount, lastRequest] = await Promise.all([
      this.redis.get(dateKey),
      this.redis.get(hourKey),
      this.redis.get(lastKey),
    ]);

    return {
      totalRequests: parseInt(todayCount ?? '0', 10),
      requestsToday: parseInt(todayCount ?? '0', 10),
      requestsThisHour: parseInt(hourCount ?? '0', 10),
      lastRequestAt: lastRequest,
    };
  }

  /**
   * Get current queue size and pending count.
   */
  getQueueStatus(): { size: number; pending: number } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
    };
  }

  /**
   * Pause the rate limiter queue.
   */
  pause(): void {
    this.queue.pause();
  }

  /**
   * Resume the rate limiter queue.
   */
  resume(): void {
    this.queue.start();
  }

  /**
   * Clear the queue (cancel pending tasks).
   */
  clear(): void {
    this.queue.clear();
  }

  /**
   * Wait for all queued tasks to complete.
   */
  async drain(): Promise<void> {
    await this.queue.onIdle();
  }
}

/**
 * Factory: create a rate limiter pre-configured for a portal.
 */
export function createRateLimiter(
  portalName: string,
  portalUrl: string,
  options?: {
    concurrency?: number;
    intervalMs?: number;
    redis?: Redis;
    respectRobotsTxt?: boolean;
  },
): RateLimiter {
  return new RateLimiter({
    portalName,
    portalUrl,
    concurrency: options?.concurrency ?? 2,
    intervalMs: options?.intervalMs ?? 2000,
    intervalCap: 1,
    redis: options?.redis,
    respectRobotsTxt: options?.respectRobotsTxt ?? true,
  });
}
