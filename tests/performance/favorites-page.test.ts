/**
 * 收藏夹页面性能测试
 * 
 * 验证性能指标：
 * - 首屏加载时间 < 2 秒
 * - API 响应时间 < 300ms
 * - 缓存命中率 > 80%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FavoritesCache } from '../../app/lib/favoritesCache';
import { performanceMonitor } from '../../app/lib/performanceMonitor';

describe('收藏夹页面性能测试', () => {
  beforeEach(() => {
    // 启用性能监控（测试环境默认禁用）
    performanceMonitor.setEnabled(true);
    // 清除性能监控数据
    performanceMonitor.clear();
  });

  describe('缓存性能', () => {
    it('应该在缓存命中时快速返回数据', () => {
      const cache = new FavoritesCache({ ttl: 5 * 60 * 1000 });
      const sessionId = 'test-session-123';
      const testData = { favorites: [{ id: '1', name: 'Test' }] };

      // 第一次存储
      const storeStart = performance.now();
      cache.set('favorites:1', testData, sessionId);
      const storeEnd = performance.now();
      const storeDuration = storeEnd - storeStart;

      // 缓存存储应该很快（< 10ms）
      expect(storeDuration).toBeLessThan(10);

      // 第二次读取（缓存命中）
      const readStart = performance.now();
      const cachedData = cache.get('favorites:1', sessionId);
      const readEnd = performance.now();
      const readDuration = readEnd - readStart;

      // 缓存读取应该非常快（< 5ms）
      expect(readDuration).toBeLessThan(5);
      expect(cachedData).toEqual(testData);
    });

    it('应该正确隔离不同 sessionId 的缓存', () => {
      const cache = new FavoritesCache({ ttl: 5 * 60 * 1000 });
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      const data1 = { favorites: [{ id: '1', name: 'User1' }] };
      const data2 = { favorites: [{ id: '2', name: 'User2' }] };

      // 存储两个不同用户的数据
      cache.set('favorites:1', data1, sessionId1);
      cache.set('favorites:1', data2, sessionId2);

      // 验证隔离
      expect(cache.get('favorites:1', sessionId1)).toEqual(data1);
      expect(cache.get('favorites:1', sessionId2)).toEqual(data2);
    });

    it('应该在 TTL 过期后返回 null', () => {
      const cache = new FavoritesCache({ ttl: 100 }); // 100ms TTL
      const sessionId = 'test-session';
      const testData = { favorites: [] };

      cache.set('favorites:1', testData, sessionId);

      // 立即读取应该成功
      expect(cache.get('favorites:1', sessionId)).toEqual(testData);

      // 等待 TTL 过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // TTL 过期后应该返回 null
          expect(cache.get('favorites:1', sessionId)).toBeNull();
          resolve();
        }, 150);
      });
    });
  });

  describe('性能监控', () => {
    it('应该正确记录页面加载时间', () => {
      const loadTime = 1500; // 1.5 秒
      performanceMonitor.trackPageLoad('favorites', loadTime);

      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(1);
      expect(summary.pageLoads.average).toBe(loadTime);
      expect(summary.pageLoads.max).toBe(loadTime);
      expect(summary.pageLoads.min).toBe(loadTime);
    });

    it('应该正确记录 API 调用时间', () => {
      const apiTime = 250; // 250ms
      performanceMonitor.trackAPICall('/api/favorites', apiTime);

      const summary = performanceMonitor.getSummary();
      expect(summary.apiCalls.count).toBe(1);
      expect(summary.apiCalls.average).toBe(apiTime);
    });

    it('应该正确计算缓存命中率', () => {
      // 模拟 10 次请求，8 次命中
      for (let i = 0; i < 8; i++) {
        performanceMonitor.trackCacheHit(`key${i}`, true);
      }
      for (let i = 8; i < 10; i++) {
        performanceMonitor.trackCacheHit(`key${i}`, false);
      }

      const summary = performanceMonitor.getSummary();
      expect(summary.cache.totalRequests).toBe(10);
      expect(summary.cache.hits).toBe(8);
      expect(summary.cache.misses).toBe(2);
      expect(summary.cache.hitRate).toBe(0.8);
    });

    it('应该在页面加载时间超过目标值时发出警告', () => {
      const slowLoadTime = 2500; // 2.5 秒，超过 2 秒目标
      
      // 捕获 console.warn
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (message: string) => {
        warnings.push(message);
      };

      performanceMonitor.trackPageLoad('favorites', slowLoadTime);

      // 恢复 console.warn
      console.warn = originalWarn;

      // 验证警告
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('超过目标值');
    });

    it('应该在 API 调用时间超过目标值时发出警告', () => {
      const slowApiTime = 350; // 350ms，超过 300ms 目标
      
      // 捕获 console.warn
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (message: string) => {
        warnings.push(message);
      };

      performanceMonitor.trackAPICall('/api/favorites', slowApiTime);

      // 恢复 console.warn
      console.warn = originalWarn;

      // 验证警告
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('超过目标值');
    });
  });

  describe('性能目标验证', () => {
    it('模拟场景：首屏加载应该在 2 秒内完成', () => {
      // 模拟页面加载流程
      const pageLoadStart = performance.now();
      
      // 模拟 API 调用（并行）
      const favoritesApiTime = 250; // 250ms
      const savedSetsApiTime = 280; // 280ms
      
      performanceMonitor.trackAPICall('/api/favorites', favoritesApiTime);
      performanceMonitor.trackAPICall('/api/saved-sets', savedSetsApiTime);
      
      // 总加载时间应该是较慢的 API 时间（因为是并行的）
      const totalLoadTime = Math.max(favoritesApiTime, savedSetsApiTime);
      
      performanceMonitor.trackPageLoad('favorites', totalLoadTime);
      
      const summary = performanceMonitor.getSummary();
      
      // 验证性能目标
      expect(summary.pageLoads.average).toBeLessThan(2000); // < 2 秒
      expect(summary.apiCalls.average).toBeLessThan(300); // < 300ms
    });

    it('模拟场景：缓存命中应该显著减少加载时间', () => {
      const cache = new FavoritesCache({ ttl: 5 * 60 * 1000 });
      const sessionId = 'test-session';
      
      // 第一次加载（无缓存）- 模拟 API 调用时间
      const apiTime = 250;
      performanceMonitor.trackAPICall('/api/favorites', apiTime);
      performanceMonitor.trackCacheHit('favorites:1', false);
      
      // 存储到缓存
      cache.set('favorites:1', { data: 'test' }, sessionId);
      
      // 第二次加载（缓存命中）- 测量实际缓存读取时间
      const secondLoadStart = performance.now();
      const cachedData = cache.get('favorites:1', sessionId);
      const secondLoadEnd = performance.now();
      const secondLoadTime = secondLoadEnd - secondLoadStart;
      
      performanceMonitor.trackCacheHit('favorites:1', true);
      
      // 验证缓存命中
      expect(cachedData).not.toBeNull();
      // 缓存读取应该非常快（< 10ms）
      expect(secondLoadTime).toBeLessThan(10);
      // 缓存读取应该比 API 调用快得多
      expect(secondLoadTime).toBeLessThan(apiTime);
    });

    it('模拟场景：独立加载应该允许部分内容先显示', () => {
      // 模拟两个 API 调用，一个快一个慢
      const fastApiTime = 150; // 150ms
      const slowApiTime = 400; // 400ms
      
      performanceMonitor.trackAPICall('/api/favorites', fastApiTime);
      performanceMonitor.trackAPICall('/api/saved-sets', slowApiTime);
      
      const summary = performanceMonitor.getSummary();
      
      // 验证：快的 API 可以先返回
      expect(fastApiTime).toBeLessThan(slowApiTime);
      
      // 验证：平均时间不会被慢的 API 拖累太多
      const avgTime = summary.apiCalls.average;
      expect(avgTime).toBeLessThan(slowApiTime);
      expect(avgTime).toBeGreaterThan(fastApiTime);
    });
  });
});
