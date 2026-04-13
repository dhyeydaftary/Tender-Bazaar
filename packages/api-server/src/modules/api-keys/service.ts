import crypto from 'crypto';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateRawKey(): string {
  const hex = crypto.randomBytes(32).toString('hex');
  return `tb_live_${hex}`;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function maskKey(key: string): string {
  // tb_live_<first 4>****..****<last 4>
  if (key.length < 16) return '****';
  const prefix = key.slice(0, 8); // "tb_live_"
  const last4 = key.slice(-4);
  return `${prefix}****************************${last4}`;
}

/* ------------------------------------------------------------------ */
/* Service                                                            */
/* ------------------------------------------------------------------ */

export const apiKeyService = {
  /**
   * Generate a new API key for a user.
   * The raw key is only returned once — store it securely.
   */
  async generateApiKey(userId: string): Promise<{ key: string; maskedKey: string; createdAt: string }> {
    // Revoke any existing key first
    await apiKeyService.revokeApiKey(userId);

    const rawKey = generateRawKey();
    const hash = hashKey(rawKey);
    const createdAt = new Date().toISOString();

    // Store hashed key → user mapping
    await redis.set(
      `api-key:${hash}`,
      JSON.stringify({ userId, createdAt, lastUsedAt: null }),
    );

    // Store userId → raw key (so user can retrieve the masked version and metadata)
    await redis.set(`user-api-key:${userId}`, rawKey);

    return { key: rawKey, maskedKey: maskKey(rawKey), createdAt };
  },

  /**
   * Validate an API key and return the userId if valid.
   * Also enforces rate limiting (100 requests/hour).
   */
  async validateApiKey(key: string): Promise<string> {
    const hash = hashKey(key);
    const raw = await redis.get(`api-key:${hash}`);

    if (!raw) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    const data = JSON.parse(raw) as {
      userId: string;
      createdAt: string;
      lastUsedAt: string | null;
    };

    // Rate limiting: 100 requests per hour
    const now = new Date();
    const hourKey = `api-rate:${hash}:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
    const currentCount = await redis.incr(hourKey);

    if (currentCount === 1) {
      // Set expiry on first request of the hour
      await redis.expire(hourKey, 3600);
    }

    if (currentCount > 100) {
      throw new AppError('Rate limit exceeded. Maximum 100 requests per hour.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Update lastUsedAt
    data.lastUsedAt = now.toISOString();
    await redis.set(`api-key:${hash}`, JSON.stringify(data));

    return data.userId;
  },

  /**
   * Get API key info for a user (masked key + metadata).
   */
  async getApiKeyInfo(userId: string): Promise<{
    maskedKey: string;
    createdAt: string;
    lastUsedAt: string | null;
    requestsToday: number;
  } | null> {
    const rawKey = await redis.get(`user-api-key:${userId}`);
    if (!rawKey) return null;

    const hash = hashKey(rawKey);
    const data = await redis.get(`api-key:${hash}`);
    if (!data) return null;

    const parsed = JSON.parse(data) as {
      userId: string;
      createdAt: string;
      lastUsedAt: string | null;
    };

    // Count today's requests across all hours
    const now = new Date();
    let requestsToday = 0;
    for (let h = 0; h <= now.getUTCHours(); h++) {
      const hourKey = `api-rate:${hash}:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${h}`;
      const count = await redis.get(hourKey);
      if (count) requestsToday += parseInt(count, 10);
    }

    return {
      maskedKey: maskKey(rawKey),
      createdAt: parsed.createdAt,
      lastUsedAt: parsed.lastUsedAt,
      requestsToday,
    };
  },

  /**
   * Regenerate API key — revokes old and creates new.
   */
  async regenerateApiKey(userId: string): Promise<{ key: string; maskedKey: string; createdAt: string }> {
    return apiKeyService.generateApiKey(userId);
  },

  /**
   * Revoke (delete) a user's API key.
   */
  async revokeApiKey(userId: string): Promise<void> {
    const rawKey = await redis.get(`user-api-key:${userId}`);
    if (!rawKey) return;

    const hash = hashKey(rawKey);
    await redis.del(`api-key:${hash}`);
    await redis.del(`user-api-key:${userId}`);
  },

  /**
   * Store webhook configuration for a user.
   */
  async configureWebhook(
    userId: string,
    config: { url: string; events: string[]; active: boolean }
  ): Promise<{ url: string; events: string[]; active: boolean }> {
    await redis.set(
      `webhook:${userId}`,
      JSON.stringify(config),
    );
    return config;
  },

  /**
   * Get webhook configuration for a user.
   */
  async getWebhookConfig(userId: string): Promise<{
    url: string;
    events: string[];
    active: boolean;
  } | null> {
    const raw = await redis.get(`webhook:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  },
};
