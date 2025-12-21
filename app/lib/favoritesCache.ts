/**
 * Cache manager for favorites page data
 * Provides session-based cache isolation with TTL and invalidation mechanisms
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  sessionId: string;
}

interface CacheOptions {
  ttl?: number; // Cache TTL in milliseconds, default 5 minutes
}

/**
 * FavoritesCache - Client-side memory cache for favorites data
 * 
 * Features:
 * - Session-based cache isolation
 * - TTL-based expiration
 * - Manual invalidation support
 */
export class FavoritesCache {
  private cache: Map<string, CacheEntry<any>>;
  private ttl: number;

  constructor(options?: CacheOptions) {
    this.cache = new Map();
    this.ttl = options?.ttl ?? 5 * 60 * 1000; // Default 5 minutes
  }

  /**
   * Get cached data for a specific key and session
   * Returns null if cache miss or expired
   */
  get<T>(key: string, sessionId: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry belongs to the correct session
    if (entry.sessionId !== sessionId) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with session isolation
   */
  set<T>(key: string, data: T, sessionId: string): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      sessionId,
    };
    this.cache.set(key, entry);
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Check if a cache entry is valid (exists, not expired, correct session)
   */
  isValid(key: string, sessionId: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (entry.sessionId !== sessionId) {
      return false;
    }

    const now = Date.now();
    return now - entry.timestamp <= this.ttl;
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl: this.ttl,
    };
  }
}

/**
 * Cache key generation utilities
 */
export const CACHE_KEYS = {
  favorites: (sessionId: string, page: number) => `favorites:${sessionId}:${page}`,
  savedSets: (sessionId: string, page: number) => `savedSets:${sessionId}:${page}`,
  favoritesTotal: (sessionId: string) => `favorites:${sessionId}:total`,
  setsTotal: (sessionId: string) => `savedSets:${sessionId}:total`,
};

// Singleton instance for global use
let cacheInstance: FavoritesCache | null = null;

/**
 * Get or create the global cache instance
 */
export function getFavoritesCache(options?: CacheOptions): FavoritesCache {
  if (!cacheInstance) {
    cacheInstance = new FavoritesCache(options);
  }
  return cacheInstance;
}

/**
 * Reset the global cache instance (useful for testing)
 */
export function resetFavoritesCache(): void {
  cacheInstance = null;
}
