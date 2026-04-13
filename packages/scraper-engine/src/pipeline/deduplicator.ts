/**
 * Tender Deduplication Engine
 *
 * Multi-level deduplication:
 * 1. Primary: exact match on referenceNumber + sourcePortal
 * 2. Secondary: fuzzy match on title + organization + estimatedValue (within 5% tolerance)
 * 3. Redis-backed seen-tender cache with 30-day TTL
 * 4. Corrigendum/amendment detection — updates existing rather than creating new
 */

import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import type { NormalizedTenderData } from './normalizer';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DeduplicationResult {
  isNew: boolean;
  isDuplicate: boolean;
  isCorrigendum: boolean;
  existingTenderId?: string;
  matchType?: 'exact' | 'fuzzy' | 'corrigendum';
  similarityScore?: number;
}

export interface DeduplicatorConfig {
  /** Redis key prefix for dedup cache */
  redisPrefix?: string;
  /** TTL in seconds for Redis cache entries (default: 30 days) */
  cacheTtlSeconds?: number;
  /** Minimum similarity threshold for fuzzy matching (0-1, default: 0.85) */
  fuzzyThreshold?: number;
  /** Tolerance for estimated value comparison (0-1, default: 0.05 = 5%) */
  valueTolerance?: number;
}

const DEFAULT_CONFIG: Required<DeduplicatorConfig> = {
  redisPrefix: 'tb:dedup',
  cacheTtlSeconds: 30 * 24 * 60 * 60, // 30 days
  fuzzyThreshold: 0.85,
  valueTolerance: 0.05,
};

// ─── Levenshtein Distance ───────────────────────────────────────────────────────

/**
 * Compute the Levenshtein distance between two strings.
 * Uses Wagner-Fischer dynamic programming approach with O(min(m,n)) space.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Ensure a is the shorter string for space optimization
  if (m > n) return levenshteinDistance(b, a);

  let prevRow = Array.from({ length: m + 1 }, (_, i) => i);
  let currRow = new Array(m + 1);

  for (let j = 1; j <= n; j++) {
    currRow[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        currRow[i - 1] + 1,      // insertion
        prevRow[i] + 1,           // deletion
        prevRow[i - 1] + cost,    // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[m];
}

/**
 * Calculate string similarity (0-1) based on Levenshtein distance.
 * 1.0 = identical, 0.0 = completely different
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1.0;

  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(aLower, bLower);
  return 1 - distance / maxLen;
}

/**
 * Check if two monetary values are within a tolerance percentage.
 */
function valuesWithinTolerance(
  a: number | undefined,
  b: number | undefined,
  tolerance: number,
): boolean {
  // If both are undefined or zero, consider them matching
  if ((a === undefined || a === 0) && (b === undefined || b === 0)) return true;
  // If only one is undefined/zero, they don't match
  if (a === undefined || a === 0 || b === undefined || b === 0) return false;

  const diff = Math.abs(a - b);
  const avg = (a + b) / 2;
  return diff / avg <= tolerance;
}

// ─── Deduplicator Class ─────────────────────────────────────────────────────────

export class TenderDeduplicator {
  private redis: Redis;
  private prisma: PrismaClient;
  private config: Required<DeduplicatorConfig>;

  constructor(redis: Redis, prisma: PrismaClient, config?: DeduplicatorConfig) {
    this.redis = redis;
    this.prisma = prisma;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a tender is a duplicate.
   *
   * Order of checks:
   * 1. Redis cache (exact key: referenceNumber + sourcePortal)
   * 2. Database exact match (referenceNumber + sourcePortal)
   * 3. Database fuzzy match (title + organization + estimatedValue)
   * 4. Corrigendum detection
   */
  async checkDuplicate(tender: NormalizedTenderData): Promise<DeduplicationResult> {
    // 1. Check Redis cache for exact match
    const cacheKey = this.buildCacheKey(tender.referenceNumber, tender.sourcePortal);
    const cachedId = await this.redis.get(cacheKey);

    if (cachedId) {
      // Check if this is a corrigendum update
      if (tender.status === 'CORRIGENDUM') {
        return {
          isNew: false,
          isDuplicate: false,
          isCorrigendum: true,
          existingTenderId: cachedId,
          matchType: 'corrigendum',
        };
      }

      return {
        isNew: false,
        isDuplicate: true,
        isCorrigendum: false,
        existingTenderId: cachedId,
        matchType: 'exact',
        similarityScore: 1.0,
      };
    }

    // 2. Database exact match on sourceId + sourcePortal (unique constraint)
    const exactMatch = await this.prisma.tender.findUnique({
      where: {
        sourceId_sourcePortal: {
          sourceId: tender.sourceId,
          sourcePortal: tender.sourcePortal,
        },
      },
      select: { id: true, status: true },
    });

    if (exactMatch) {
      // Cache the match
      await this.cacheMapping(tender.referenceNumber, tender.sourcePortal, exactMatch.id);

      if (tender.status === 'CORRIGENDUM') {
        return {
          isNew: false,
          isDuplicate: false,
          isCorrigendum: true,
          existingTenderId: exactMatch.id,
          matchType: 'corrigendum',
        };
      }

      return {
        isNew: false,
        isDuplicate: true,
        isCorrigendum: false,
        existingTenderId: exactMatch.id,
        matchType: 'exact',
        similarityScore: 1.0,
      };
    }

    // 3. Database search by reference number (across portals — same tender on different portals)
    const refMatch = await this.prisma.tender.findFirst({
      where: {
        referenceNumber: tender.referenceNumber,
      },
      select: { id: true },
    });

    if (refMatch) {
      await this.cacheMapping(tender.referenceNumber, tender.sourcePortal, refMatch.id);

      if (tender.status === 'CORRIGENDUM') {
        return {
          isNew: false,
          isDuplicate: false,
          isCorrigendum: true,
          existingTenderId: refMatch.id,
          matchType: 'corrigendum',
        };
      }

      return {
        isNew: false,
        isDuplicate: true,
        isCorrigendum: false,
        existingTenderId: refMatch.id,
        matchType: 'exact',
        similarityScore: 1.0,
      };
    }

    // 4. Fuzzy match: title + organization + estimatedValue
    const fuzzyResult = await this.fuzzyMatch(tender);
    if (fuzzyResult) {
      await this.cacheMapping(tender.referenceNumber, tender.sourcePortal, fuzzyResult.existingTenderId!);
      return fuzzyResult;
    }

    // 5. No match found — new tender
    return {
      isNew: true,
      isDuplicate: false,
      isCorrigendum: false,
    };
  }

  /**
   * Fuzzy match against existing tenders using title similarity,
   * organization match, and value tolerance.
   */
  private async fuzzyMatch(tender: NormalizedTenderData): Promise<DeduplicationResult | null> {
    // Find candidates with similar organization and overlapping dates
    const candidates = await this.prisma.tender.findMany({
      where: {
        organization: {
          contains: tender.organization.split(' ')[0], // First word of org name
          mode: 'insensitive',
        },
        publishedDate: {
          gte: new Date(tender.publishedDate.getTime() - 7 * 24 * 60 * 60 * 1000), // +/- 7 days
          lte: new Date(tender.publishedDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        title: true,
        organization: true,
        estimatedValue: true,
      },
      take: 50, // Limit candidates to avoid performance issues
    });

    if (candidates.length === 0) return null;

    let bestMatch: { id: string; score: number } | null = null;

    for (const candidate of candidates) {
      // Title similarity
      const titleSim = stringSimilarity(tender.title, candidate.title);

      // Organization similarity
      const orgSim = stringSimilarity(tender.organization, candidate.organization);

      // Value match (boolean converted to score)
      const valueMatch = valuesWithinTolerance(
        tender.estimatedValue,
        candidate.estimatedValue ?? undefined,
        this.config.valueTolerance,
      );

      // Weighted composite score
      // Title is most important (60%), org (25%), value (15%)
      const compositeScore =
        titleSim * 0.6 +
        orgSim * 0.25 +
        (valueMatch ? 1.0 : 0.0) * 0.15;

      if (compositeScore >= this.config.fuzzyThreshold) {
        if (!bestMatch || compositeScore > bestMatch.score) {
          bestMatch = { id: candidate.id, score: compositeScore };
        }
      }
    }

    if (bestMatch) {
      if (tender.status === 'CORRIGENDUM') {
        return {
          isNew: false,
          isDuplicate: false,
          isCorrigendum: true,
          existingTenderId: bestMatch.id,
          matchType: 'corrigendum',
          similarityScore: bestMatch.score,
        };
      }

      return {
        isNew: false,
        isDuplicate: true,
        isCorrigendum: false,
        existingTenderId: bestMatch.id,
        matchType: 'fuzzy',
        similarityScore: bestMatch.score,
      };
    }

    return null;
  }

  /**
   * Mark a tender as seen in the Redis cache.
   * Called after a new tender is successfully inserted into the database.
   */
  async markAsSeen(
    referenceNumber: string,
    sourcePortal: string,
    tenderId: string,
  ): Promise<void> {
    await this.cacheMapping(referenceNumber, sourcePortal, tenderId);
  }

  /**
   * Store a reference-to-id mapping in Redis with TTL.
   */
  private async cacheMapping(
    referenceNumber: string,
    sourcePortal: string,
    tenderId: string,
  ): Promise<void> {
    const key = this.buildCacheKey(referenceNumber, sourcePortal);
    await this.redis.setex(key, this.config.cacheTtlSeconds, tenderId);
  }

  /**
   * Build a Redis cache key for deduplication.
   */
  private buildCacheKey(referenceNumber: string, sourcePortal: string): string {
    const normalizedRef = referenceNumber.toLowerCase().replace(/\s+/g, '');
    const normalizedPortal = sourcePortal.toLowerCase().replace(/\s+/g, '');
    return `${this.config.redisPrefix}:${normalizedPortal}:${normalizedRef}`;
  }

  /**
   * Get dedup stats from Redis.
   */
  async getStats(): Promise<{
    cachedEntries: number;
  }> {
    const keys = await this.redis.keys(`${this.config.redisPrefix}:*`);
    return { cachedEntries: keys.length };
  }

  /**
   * Clear all dedup cache entries (for testing or reset).
   */
  async clearCache(): Promise<void> {
    const keys = await this.redis.keys(`${this.config.redisPrefix}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
