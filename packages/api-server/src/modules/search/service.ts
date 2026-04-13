import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { randomUUID } from 'crypto';

interface SearchFilters {
  category?: string;
  state?: string;
  tenderType?: string;
  minValue?: number;
  maxValue?: number;
  organizations?: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: string;
}

interface RecentSearch {
  query: string;
  timestamp: string;
}

export const searchService = {
  async saveSearch(
    userId: string,
    searchData: { name: string; query: string; filters: SearchFilters }
  ): Promise<SavedSearch> {
    const key = `saved-searches:${userId}`;

    // Check max limit (20)
    const existing = await redis.llen(key);
    if (existing >= 20) {
      throw new AppError('Maximum saved searches limit (20) reached', 400, 'LIMIT_REACHED');
    }

    const savedSearch: SavedSearch = {
      id: randomUUID(),
      name: searchData.name,
      query: searchData.query,
      filters: searchData.filters,
      createdAt: new Date().toISOString(),
    };

    await redis.lpush(key, JSON.stringify(savedSearch));
    return savedSearch;
  },

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    const key = `saved-searches:${userId}`;
    const items = await redis.lrange(key, 0, -1);
    return items.map((item) => JSON.parse(item) as SavedSearch);
  },

  async deleteSavedSearch(userId: string, searchId: string): Promise<{ message: string }> {
    const key = `saved-searches:${userId}`;
    const items = await redis.lrange(key, 0, -1);

    const filtered = items.filter((item) => {
      const parsed = JSON.parse(item) as SavedSearch;
      return parsed.id !== searchId;
    });

    // Replace the list
    const multi = redis.multi();
    multi.del(key);
    if (filtered.length > 0) {
      multi.rpush(key, ...filtered);
    }
    await multi.exec();

    return { message: 'Saved search deleted' };
  },

  async getRecentSearches(userId: string): Promise<RecentSearch[]> {
    const key = `recent-searches:${userId}`;
    const items = await redis.lrange(key, 0, 9);
    return items.map((item) => JSON.parse(item) as RecentSearch);
  },

  async recordSearch(userId: string, query: string): Promise<void> {
    const key = `recent-searches:${userId}`;
    const entry: RecentSearch = {
      query,
      timestamp: new Date().toISOString(),
    };

    await redis.lpush(key, JSON.stringify(entry));
    await redis.ltrim(key, 0, 9);

    // Also increment global keyword analytics
    if (query.trim()) {
      await redis.zincrby('search:keywords', 1, query.trim().toLowerCase());
    }
  },
};
