import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { LLMService } from './llmService';

describe('LLMService Cache Property-Based Tests', () => {
  let llmService: LLMService;

  beforeEach(() => {
    // Create a new instance with mock config for each test
    llmService = new LLMService({
      apiKey: 'test-api-key',
      baseURL: 'https://test.example.com',
      model: 'test-model',
    });
    llmService.clearCache();
  });

  /**
   * Property 3: 缓存一致性
   * Feature: llm-performance-optimization, Property 3: 相同原料组合返回相同结果
   * Validates: Requirements 2.1, 2.5
   */
  it('Property 3: Cache consistency - same ingredients return same results', () => {
    fc.assert(
      fc.property(
        // Generate an array of 1-10 ingredient strings
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (ingredients) => {
          // Mock data to cache
          const mockData = [
            {
              name: 'Test Cocktail',
              description: 'A test cocktail',
              ingredients: ['ingredient1', 'ingredient2'],
              steps: ['step1', 'step2'],
              difficulty: 3,
              estimatedTime: 10,
            },
          ];

          // Access private method through type assertion for testing
          const service = llmService as any;
          
          // Save to cache
          service.saveToCache(ingredients, mockData);

          // Get from cache twice
          const result1 = service.getFromCache(ingredients);
          const result2 = service.getFromCache(ingredients);

          // Both results should be identical
          expect(result1).toEqual(result2);
          expect(result1).toEqual(mockData);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: 缓存过期清理
   * Feature: llm-performance-optimization, Property 4: 过期缓存不被返回
   * Validates: Requirements 2.3
   */
  it('Property 4: Cache expiration - expired cache is not returned', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (ingredients) => {
          const mockData = [
            {
              name: 'Test Cocktail',
              description: 'A test cocktail',
              ingredients: ['ingredient1'],
              steps: ['step1'],
              difficulty: 2,
              estimatedTime: 5,
            },
          ];

          const service = llmService as any;
          
          // Save to cache
          service.saveToCache(ingredients, mockData);

          // Manually set the timestamp to be expired (more than 30 minutes ago)
          const cacheKey = service.getCacheKey(ingredients);
          const cacheEntry = service.cache.get(cacheKey);
          if (cacheEntry) {
            cacheEntry.timestamp = Date.now() - (31 * 60 * 1000); // 31 minutes ago
          }

          // Try to get from cache - should return null because it's expired
          const result = service.getFromCache(ingredients);

          // Expired cache should not be returned
          expect(result).toBeNull();

          // The expired entry should be deleted from cache
          expect(service.cache.has(cacheKey)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: 缓存键规范化
   * Feature: llm-performance-optimization, Property 6: 相同原料不同顺序生成相同键
   * Validates: Requirements 2.5
   */
  it('Property 6: Cache key normalization - same ingredients in different order generate same key', () => {
    fc.assert(
      fc.property(
        // Generate an array of unique strings to avoid duplicates affecting the test
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
        (ingredients) => {
          const service = llmService as any;
          
          // Get the cache key for the original order
          const key1 = service.getCacheKey(ingredients);

          // Create a shuffled version of the ingredients
          const shuffled = [...ingredients].reverse();
          const key2 = service.getCacheKey(shuffled);

          // Create another permutation
          const sorted = [...ingredients].sort();
          const key3 = service.getCacheKey(sorted);

          // All keys should be identical regardless of order
          expect(key1).toBe(key2);
          expect(key1).toBe(key3);
          expect(key2).toBe(key3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Cache key normalization with case insensitivity
   * Feature: llm-performance-optimization, Property 6: 相同原料不同顺序生成相同键
   * Validates: Requirements 2.5
   */
  it('Property 6 (extended): Cache key normalization - case insensitive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (ingredients) => {
          const service = llmService as any;
          
          // Get the cache key for the original
          const key1 = service.getCacheKey(ingredients);

          // Create uppercase version
          const uppercase = ingredients.map(i => i.toUpperCase());
          const key2 = service.getCacheKey(uppercase);

          // Create mixed case version
          const mixedCase = ingredients.map(i => 
            i.split('').map((c, idx) => idx % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('')
          );
          const key3 = service.getCacheKey(mixedCase);

          // All keys should be identical regardless of case
          expect(key1).toBe(key2);
          expect(key1).toBe(key3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
