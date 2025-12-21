/**
 * 性能监控工具测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performanceMonitor } from '../../app/lib/performanceMonitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // 清除所有统计数据
    performanceMonitor.clear();
    // 启用性能监控
    performanceMonitor.setEnabled(true);
    // 清除控制台 mock
    vi.clearAllMocks();
  });

  describe('trackPageLoad', () => {
    it('应该记录页面加载时间', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      performanceMonitor.trackPageLoad('favorites', 1500);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(1);
      expect(summary.pageLoads.average).toBe(1500);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] 页面加载 - favorites: 1500.00ms')
      );
    });

    it('应该在加载时间超过目标值时发出警告', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      performanceMonitor.trackPageLoad('favorites', 2500);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ 页面加载时间超过目标值')
      );
    });

    it('应该计算多次加载的平均时间', () => {
      performanceMonitor.trackPageLoad('favorites', 1000);
      performanceMonitor.trackPageLoad('favorites', 2000);
      performanceMonitor.trackPageLoad('favorites', 1500);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(3);
      expect(summary.pageLoads.average).toBe(1500);
      expect(summary.pageLoads.max).toBe(2000);
      expect(summary.pageLoads.min).toBe(1000);
    });
  });

  describe('trackAPICall', () => {
    it('应该记录 API 调用时间', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      performanceMonitor.trackAPICall('/api/favorites', 250);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.apiCalls.count).toBe(1);
      expect(summary.apiCalls.average).toBe(250);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] API 调用 - /api/favorites: 250.00ms')
      );
    });

    it('应该在 API 调用时间超过目标值时发出警告', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      performanceMonitor.trackAPICall('/api/favorites', 350);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ API 调用时间超过目标值')
      );
    });

    it('应该计算多次 API 调用的平均时间', () => {
      performanceMonitor.trackAPICall('/api/favorites', 200);
      performanceMonitor.trackAPICall('/api/saved-sets', 300);
      performanceMonitor.trackAPICall('/api/favorites', 250);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.apiCalls.count).toBe(3);
      expect(summary.apiCalls.average).toBe(250);
      expect(summary.apiCalls.max).toBe(300);
      expect(summary.apiCalls.min).toBe(200);
    });
  });

  describe('trackCacheHit', () => {
    it('应该记录缓存命中', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      performanceMonitor.trackCacheHit('favorites:session123:1', true);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.cache.totalRequests).toBe(1);
      expect(summary.cache.hits).toBe(1);
      expect(summary.cache.misses).toBe(0);
      expect(summary.cache.hitRate).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache] favorites:session123:1: 命中 ✓')
      );
    });

    it('应该记录缓存未命中', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      performanceMonitor.trackCacheHit('favorites:session123:1', false);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.cache.totalRequests).toBe(1);
      expect(summary.cache.hits).toBe(0);
      expect(summary.cache.misses).toBe(1);
      expect(summary.cache.hitRate).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache] favorites:session123:1: 未命中 ✗')
      );
    });

    it('应该计算缓存命中率', () => {
      performanceMonitor.trackCacheHit('key1', true);
      performanceMonitor.trackCacheHit('key2', false);
      performanceMonitor.trackCacheHit('key3', true);
      performanceMonitor.trackCacheHit('key4', true);
      performanceMonitor.trackCacheHit('key5', false);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.cache.totalRequests).toBe(5);
      expect(summary.cache.hits).toBe(3);
      expect(summary.cache.misses).toBe(2);
      expect(summary.cache.hitRate).toBe(0.6); // 3/5 = 60%
    });
  });

  describe('getSummary', () => {
    it('应该返回完整的性能统计摘要', () => {
      performanceMonitor.trackPageLoad('favorites', 1500);
      performanceMonitor.trackAPICall('/api/favorites', 250);
      performanceMonitor.trackCacheHit('key1', true);
      performanceMonitor.trackCacheHit('key2', false);
      
      const summary = performanceMonitor.getSummary();
      
      expect(summary).toEqual({
        pageLoads: {
          count: 1,
          average: 1500,
          max: 1500,
          min: 1500,
        },
        apiCalls: {
          count: 1,
          average: 250,
          max: 250,
          min: 250,
        },
        cache: {
          hitRate: 0.5,
          totalRequests: 2,
          hits: 1,
          misses: 1,
        },
      });
    });

    it('应该处理空统计数据', () => {
      const summary = performanceMonitor.getSummary();
      
      expect(summary).toEqual({
        pageLoads: {
          count: 0,
          average: 0,
          max: 0,
          min: 0,
        },
        apiCalls: {
          count: 0,
          average: 0,
          max: 0,
          min: 0,
        },
        cache: {
          hitRate: 0,
          totalRequests: 0,
          hits: 0,
          misses: 0,
        },
      });
    });
  });

  describe('clear', () => {
    it('应该清除所有统计数据', () => {
      performanceMonitor.trackPageLoad('favorites', 1500);
      performanceMonitor.trackAPICall('/api/favorites', 250);
      performanceMonitor.trackCacheHit('key1', true);
      
      performanceMonitor.clear();
      
      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(0);
      expect(summary.apiCalls.count).toBe(0);
      expect(summary.cache.totalRequests).toBe(0);
    });
  });

  describe('setEnabled', () => {
    it('应该在禁用时不记录数据', () => {
      performanceMonitor.setEnabled(false);
      
      performanceMonitor.trackPageLoad('favorites', 1500);
      performanceMonitor.trackAPICall('/api/favorites', 250);
      performanceMonitor.trackCacheHit('key1', true);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(0);
      expect(summary.apiCalls.count).toBe(0);
      expect(summary.cache.totalRequests).toBe(0);
    });

    it('应该在重新启用后记录数据', () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.trackPageLoad('favorites', 1500);
      
      performanceMonitor.setEnabled(true);
      performanceMonitor.trackPageLoad('favorites', 2000);
      
      const summary = performanceMonitor.getSummary();
      expect(summary.pageLoads.count).toBe(1);
      expect(summary.pageLoads.average).toBe(2000);
    });
  });

  describe('printSummary', () => {
    it('应该打印性能统计摘要', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      performanceMonitor.trackPageLoad('favorites', 1500);
      performanceMonitor.trackAPICall('/api/favorites', 250);
      performanceMonitor.trackCacheHit('key1', true);
      performanceMonitor.trackCacheHit('key2', false);
      
      performanceMonitor.printSummary();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('=== 性能监控摘要 ==='));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📄 页面加载:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🌐 API 调用:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('💾 缓存统计:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🎯 目标达成情况:'));
    });
  });
});
