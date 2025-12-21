import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FavoritesCache, CACHE_KEYS, getFavoritesCache, resetFavoritesCache } from '../../app/lib/favoritesCache';

describe('FavoritesCache', () => {
  let cache: FavoritesCache;

  beforeEach(() => {
    cache = new FavoritesCache();
  });

  describe('Cache storage and retrieval', () => {
    it('should store and retrieve data correctly', () => {
      const key = 'test-key';
      const sessionId = 'session-123';
      const data = { id: 1, name: 'Test Data' };

      cache.set(key, data, sessionId);
      const retrieved = cache.get(key, sessionId);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key', 'session-123');
      expect(result).toBeNull();
    });

    it('should handle multiple cache entries', () => {
      const session = 'session-123';
      const data1 = { id: 1, name: 'Data 1' };
      const data2 = { id: 2, name: 'Data 2' };

      cache.set('key1', data1, session);
      cache.set('key2', data2, session);

      expect(cache.get('key1', session)).toEqual(data1);
      expect(cache.get('key2', session)).toEqual(data2);
    });

    it('should overwrite existing cache entries with same key', () => {
      const key = 'test-key';
      const sessionId = 'session-123';
      const oldData = { value: 'old' };
      const newData = { value: 'new' };

      cache.set(key, oldData, sessionId);
      cache.set(key, newData, sessionId);

      const retrieved = cache.get(key, sessionId);
      expect(retrieved).toEqual(newData);
    });

    it('should handle different data types', () => {
      const sessionId = 'session-123';

      // String
      cache.set('string-key', 'test string', sessionId);
      expect(cache.get('string-key', sessionId)).toBe('test string');

      // Number
      cache.set('number-key', 42, sessionId);
      expect(cache.get('number-key', sessionId)).toBe(42);

      // Array
      cache.set('array-key', [1, 2, 3], sessionId);
      expect(cache.get('array-key', sessionId)).toEqual([1, 2, 3]);

      // Object
      cache.set('object-key', { nested: { value: true } }, sessionId);
      expect(cache.get('object-key', sessionId)).toEqual({ nested: { value: true } });
    });
  });

  describe('SessionId isolation', () => {
    it('should isolate cache entries by sessionId', () => {
      const key = 'shared-key';
      const session1 = 'session-1';
      const session2 = 'session-2';
      const data1 = { user: 'User 1' };
      const data2 = { user: 'User 2' };

      cache.set(key, data1, session1);
      cache.set(key, data2, session2);

      // Each session should get its own data
      expect(cache.get(key, session1)).toEqual(data1);
      expect(cache.get(key, session2)).toEqual(data2);
    });

    it('should return null when accessing with wrong sessionId', () => {
      const key = 'test-key';
      const correctSession = 'session-correct';
      const wrongSession = 'session-wrong';
      const data = { value: 'test' };

      cache.set(key, data, correctSession);

      // Correct session should work
      expect(cache.get(key, correctSession)).toEqual(data);

      // Wrong session should return null
      expect(cache.get(key, wrongSession)).toBeNull();
    });

    it('should not allow cross-session data access', () => {
      const key = 'sensitive-data';
      const session1 = 'user-session-1';
      const session2 = 'user-session-2';
      const session3 = 'user-session-3';

      cache.set(key, { secret: 'session1-data' }, session1);
      cache.set(key, { secret: 'session2-data' }, session2);

      // Session 3 should not access session 1 or 2 data
      expect(cache.get(key, session3)).toBeNull();

      // Each session should only access its own data
      expect(cache.get(key, session1)).toEqual({ secret: 'session1-data' });
      expect(cache.get(key, session2)).toEqual({ secret: 'session2-data' });
    });

    it('should validate sessionId correctly with isValid method', () => {
      const key = 'test-key';
      const session1 = 'session-1';
      const session2 = 'session-2';

      cache.set(key, { data: 'test' }, session1);

      expect(cache.isValid(key, session1)).toBe(true);
      expect(cache.isValid(key, session2)).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire cache entries after TTL', () => {
      const ttl = 5 * 60 * 1000; // 5 minutes
      cache = new FavoritesCache({ ttl });

      const key = 'test-key';
      const sessionId = 'session-123';
      const data = { value: 'test' };

      cache.set(key, data, sessionId);

      // Should be available immediately
      expect(cache.get(key, sessionId)).toEqual(data);

      // Advance time by 4 minutes (still valid)
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(cache.get(key, sessionId)).toEqual(data);

      // Advance time by 2 more minutes (expired)
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(cache.get(key, sessionId)).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      const customTtl = 1000; // 1 second
      cache = new FavoritesCache({ ttl: customTtl });

      const key = 'test-key';
      const sessionId = 'session-123';
      const data = { value: 'test' };

      cache.set(key, data, sessionId);

      // Should be available immediately
      expect(cache.get(key, sessionId)).toEqual(data);

      // Advance time by 500ms (still valid)
      vi.advanceTimersByTime(500);
      expect(cache.get(key, sessionId)).toEqual(data);

      // Advance time by 600ms more (expired)
      vi.advanceTimersByTime(600);
      expect(cache.get(key, sessionId)).toBeNull();
    });

    it('should use default TTL of 5 minutes when not specified', () => {
      cache = new FavoritesCache();

      const key = 'test-key';
      const sessionId = 'session-123';
      const data = { value: 'test' };

      cache.set(key, data, sessionId);

      // Should be valid before 5 minutes
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000); // 4:59
      expect(cache.get(key, sessionId)).toEqual(data);

      // Should expire after 5 minutes
      vi.advanceTimersByTime(2 * 1000); // Total: 5:01
      expect(cache.get(key, sessionId)).toBeNull();
    });

    it('should remove expired entries from cache on access', () => {
      const ttl = 1000;
      cache = new FavoritesCache({ ttl });

      const key = 'test-key';
      const sessionId = 'session-123';

      cache.set(key, { value: 'test' }, sessionId);

      // Verify entry exists
      expect(cache.getStats().size).toBe(1);

      // Expire the entry
      vi.advanceTimersByTime(1500);

      // Access should remove the expired entry
      cache.get(key, sessionId);

      // Cache should be empty now
      expect(cache.getStats().size).toBe(0);
    });

    it('should report expired entries as invalid with isValid', () => {
      const ttl = 1000;
      cache = new FavoritesCache({ ttl });

      const key = 'test-key';
      const sessionId = 'session-123';

      cache.set(key, { value: 'test' }, sessionId);

      expect(cache.isValid(key, sessionId)).toBe(true);

      vi.advanceTimersByTime(1500);

      expect(cache.isValid(key, sessionId)).toBe(false);
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate a specific cache entry', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const sessionId = 'session-123';

      cache.set(key1, { value: 'data1' }, sessionId);
      cache.set(key2, { value: 'data2' }, sessionId);

      // Invalidate key1 for this session
      cache.invalidate(key1, sessionId);

      // key1 should be gone, key2 should remain
      expect(cache.get(key1, sessionId)).toBeNull();
      expect(cache.get(key2, sessionId)).toEqual({ value: 'data2' });
    });

    it('should handle invalidating non-existent keys gracefully', () => {
      expect(() => cache.invalidate('non-existent-key', 'session-123')).not.toThrow();
    });

    it('should invalidate all cache entries', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      cache.set('key1', { value: 'data1' }, session1);
      cache.set('key2', { value: 'data2' }, session1);
      cache.set('key3', { value: 'data3' }, session2);

      // Verify all entries exist
      expect(cache.get('key1', session1)).toBeTruthy();
      expect(cache.get('key2', session1)).toBeTruthy();
      expect(cache.get('key3', session2)).toBeTruthy();

      // Invalidate all
      cache.invalidateAll();

      // All entries should be gone
      expect(cache.get('key1', session1)).toBeNull();
      expect(cache.get('key2', session1)).toBeNull();
      expect(cache.get('key3', session2)).toBeNull();
    });

    it('should clear cache statistics after invalidateAll', () => {
      cache.set('key1', { value: 'data1' }, 'session-1');
      cache.set('key2', { value: 'data2' }, 'session-2');

      expect(cache.getStats().size).toBe(2);

      cache.invalidateAll();

      expect(cache.getStats().size).toBe(0);
    });

    it('should allow re-setting data after invalidation', () => {
      const key = 'test-key';
      const sessionId = 'session-123';
      const data1 = { value: 'first' };
      const data2 = { value: 'second' };

      cache.set(key, data1, sessionId);
      cache.invalidate(key, sessionId);

      expect(cache.get(key, sessionId)).toBeNull();

      cache.set(key, data2, sessionId);
      expect(cache.get(key, sessionId)).toEqual(data2);
    });

    it('should invalidate key across all sessions when sessionId not provided', () => {
      const key = 'shared-key';
      const session1 = 'session-1';
      const session2 = 'session-2';

      cache.set(key, { value: 'data1' }, session1);
      cache.set(key, { value: 'data2' }, session2);

      // Verify both exist
      expect(cache.get(key, session1)).toBeTruthy();
      expect(cache.get(key, session2)).toBeTruthy();

      // Invalidate without sessionId should remove all
      cache.invalidate(key);

      // Both should be gone
      expect(cache.get(key, session1)).toBeNull();
      expect(cache.get(key, session2)).toBeNull();
    });

    it('should only invalidate specific session when sessionId provided', () => {
      const key = 'shared-key';
      const session1 = 'session-1';
      const session2 = 'session-2';

      cache.set(key, { value: 'data1' }, session1);
      cache.set(key, { value: 'data2' }, session2);

      // Invalidate only session1
      cache.invalidate(key, session1);

      // session1 should be gone, session2 should remain
      expect(cache.get(key, session1)).toBeNull();
      expect(cache.get(key, session2)).toEqual({ value: 'data2' });
    });
  });

  describe('CACHE_KEYS utility', () => {
    it('should generate correct favorites cache key', () => {
      const sessionId = 'session-123';
      const page = 1;

      const key = CACHE_KEYS.favorites(sessionId, page);

      expect(key).toBe('favorites:session-123:1');
    });

    it('should generate correct savedSets cache key', () => {
      const sessionId = 'session-456';
      const page = 2;

      const key = CACHE_KEYS.savedSets(sessionId, page);

      expect(key).toBe('savedSets:session-456:2');
    });

    it('should generate correct favoritesTotal cache key', () => {
      const sessionId = 'session-789';

      const key = CACHE_KEYS.favoritesTotal(sessionId);

      expect(key).toBe('favorites:session-789:total');
    });

    it('should generate correct setsTotal cache key', () => {
      const sessionId = 'session-abc';

      const key = CACHE_KEYS.setsTotal(sessionId);

      expect(key).toBe('savedSets:session-abc:total');
    });

    it('should generate unique keys for different sessions', () => {
      const key1 = CACHE_KEYS.favorites('session-1', 1);
      const key2 = CACHE_KEYS.favorites('session-2', 1);

      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different pages', () => {
      const sessionId = 'session-123';
      const key1 = CACHE_KEYS.favorites(sessionId, 1);
      const key2 = CACHE_KEYS.favorites(sessionId, 2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Global cache instance', () => {
    beforeEach(() => {
      resetFavoritesCache();
    });

    afterEach(() => {
      resetFavoritesCache();
    });

    it('should return the same instance on multiple calls', () => {
      const instance1 = getFavoritesCache();
      const instance2 = getFavoritesCache();

      expect(instance1).toBe(instance2);
    });

    it('should share data across getInstance calls', () => {
      const cache1 = getFavoritesCache();
      const cache2 = getFavoritesCache();

      const key = 'test-key';
      const sessionId = 'session-123';
      const data = { value: 'shared' };

      cache1.set(key, data, sessionId);

      expect(cache2.get(key, sessionId)).toEqual(data);
    });

    it('should reset the global instance', () => {
      const instance1 = getFavoritesCache();
      instance1.set('key', { value: 'data' }, 'session-123');

      resetFavoritesCache();

      const instance2 = getFavoritesCache();

      // Should be a new instance
      expect(instance2).not.toBe(instance1);

      // Data should not persist
      expect(instance2.get('key', 'session-123')).toBeNull();
    });

    it('should accept custom options on first call', () => {
      const customTtl = 1000;
      const cache = getFavoritesCache({ ttl: customTtl });

      expect(cache.getStats().ttl).toBe(customTtl);
    });
  });

  describe('Cache statistics', () => {
    it('should report correct cache size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('key1', { value: 'data1' }, 'session-1');
      expect(cache.getStats().size).toBe(1);

      cache.set('key2', { value: 'data2' }, 'session-2');
      expect(cache.getStats().size).toBe(2);
    });

    it('should report correct TTL', () => {
      const customTtl = 10000;
      cache = new FavoritesCache({ ttl: customTtl });

      expect(cache.getStats().ttl).toBe(customTtl);
    });

    it('should update size after invalidation', () => {
      cache.set('key1', { value: 'data1' }, 'session-1');
      cache.set('key2', { value: 'data2' }, 'session-2');

      expect(cache.getStats().size).toBe(2);

      cache.invalidate('key1');

      expect(cache.getStats().size).toBe(1);
    });
  });
});
