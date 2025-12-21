/**
 * 性能监控工具
 * 用于监控页面加载时间、API 调用时间和缓存命中率
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

interface CacheMetric {
  key: string;
  hit: boolean;
  timestamp: number;
}

interface PerformanceStats {
  pageLoads: PerformanceMetric[];
  apiCalls: PerformanceMetric[];
  cacheHits: CacheMetric[];
}

class PerformanceMonitor {
  private stats: PerformanceStats = {
    pageLoads: [],
    apiCalls: [],
    cacheHits: [],
  };

  private enabled: boolean;

  constructor(enabled: boolean = process.env.NODE_ENV === 'development') {
    this.enabled = enabled;
  }

  /**
   * 监控页面加载时间
   * @param pageName 页面名称
   * @param duration 加载时长（毫秒）
   */
  trackPageLoad(pageName: string, duration: number): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name: pageName,
      duration,
      timestamp: Date.now(),
    };

    this.stats.pageLoads.push(metric);
    console.log(`[Performance] 页面加载 - ${pageName}: ${duration.toFixed(2)}ms`);

    // 如果加载时间超过目标值（2秒），发出警告
    if (duration > 2000) {
      console.warn(`[Performance] ⚠️ 页面加载时间超过目标值: ${pageName} (${duration.toFixed(2)}ms > 2000ms)`);
    }
  }

  /**
   * 监控 API 调用时间
   * @param endpoint API 端点
   * @param duration 调用时长（毫秒）
   */
  trackAPICall(endpoint: string, duration: number): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name: endpoint,
      duration,
      timestamp: Date.now(),
    };

    this.stats.apiCalls.push(metric);
    console.log(`[Performance] API 调用 - ${endpoint}: ${duration.toFixed(2)}ms`);

    // 如果 API 调用时间超过目标值（300ms），发出警告
    if (duration > 300) {
      console.warn(`[Performance] ⚠️ API 调用时间超过目标值: ${endpoint} (${duration.toFixed(2)}ms > 300ms)`);
    }
  }

  /**
   * 监控缓存命中情况
   * @param key 缓存键
   * @param hit 是否命中
   */
  trackCacheHit(key: string, hit: boolean): void {
    if (!this.enabled) return;

    const metric: CacheMetric = {
      key,
      hit,
      timestamp: Date.now(),
    };

    this.stats.cacheHits.push(metric);
    console.log(`[Cache] ${key}: ${hit ? '命中 ✓' : '未命中 ✗'}`);
  }

  /**
   * 获取缓存命中率统计
   * @returns 缓存命中率（0-1）
   */
  getCacheHitRate(): number {
    if (this.stats.cacheHits.length === 0) return 0;

    const hits = this.stats.cacheHits.filter(m => m.hit).length;
    return hits / this.stats.cacheHits.length;
  }

  /**
   * 获取平均页面加载时间
   * @returns 平均加载时间（毫秒）
   */
  getAveragePageLoadTime(): number {
    if (this.stats.pageLoads.length === 0) return 0;

    const total = this.stats.pageLoads.reduce((sum, m) => sum + m.duration, 0);
    return total / this.stats.pageLoads.length;
  }

  /**
   * 获取平均 API 调用时间
   * @returns 平均调用时间（毫秒）
   */
  getAverageAPICallTime(): number {
    if (this.stats.apiCalls.length === 0) return 0;

    const total = this.stats.apiCalls.reduce((sum, m) => sum + m.duration, 0);
    return total / this.stats.apiCalls.length;
  }

  /**
   * 获取性能统计摘要
   */
  getSummary(): {
    pageLoads: { count: number; average: number; max: number; min: number };
    apiCalls: { count: number; average: number; max: number; min: number };
    cache: { hitRate: number; totalRequests: number; hits: number; misses: number };
  } {
    const pageLoadDurations = this.stats.pageLoads.map(m => m.duration);
    const apiCallDurations = this.stats.apiCalls.map(m => m.duration);
    const cacheHits = this.stats.cacheHits.filter(m => m.hit).length;
    const cacheMisses = this.stats.cacheHits.filter(m => !m.hit).length;

    return {
      pageLoads: {
        count: this.stats.pageLoads.length,
        average: this.getAveragePageLoadTime(),
        max: pageLoadDurations.length > 0 ? Math.max(...pageLoadDurations) : 0,
        min: pageLoadDurations.length > 0 ? Math.min(...pageLoadDurations) : 0,
      },
      apiCalls: {
        count: this.stats.apiCalls.length,
        average: this.getAverageAPICallTime(),
        max: apiCallDurations.length > 0 ? Math.max(...apiCallDurations) : 0,
        min: apiCallDurations.length > 0 ? Math.min(...apiCallDurations) : 0,
      },
      cache: {
        hitRate: this.getCacheHitRate(),
        totalRequests: this.stats.cacheHits.length,
        hits: cacheHits,
        misses: cacheMisses,
      },
    };
  }

  /**
   * 打印性能统计摘要
   */
  printSummary(): void {
    if (!this.enabled) return;

    const summary = this.getSummary();

    console.log('\n=== 性能监控摘要 ===');
    
    console.log('\n📄 页面加载:');
    console.log(`  总次数: ${summary.pageLoads.count}`);
    console.log(`  平均时间: ${summary.pageLoads.average.toFixed(2)}ms`);
    console.log(`  最大时间: ${summary.pageLoads.max.toFixed(2)}ms`);
    console.log(`  最小时间: ${summary.pageLoads.min.toFixed(2)}ms`);

    console.log('\n🌐 API 调用:');
    console.log(`  总次数: ${summary.apiCalls.count}`);
    console.log(`  平均时间: ${summary.apiCalls.average.toFixed(2)}ms`);
    console.log(`  最大时间: ${summary.apiCalls.max.toFixed(2)}ms`);
    console.log(`  最小时间: ${summary.apiCalls.min.toFixed(2)}ms`);

    console.log('\n💾 缓存统计:');
    console.log(`  总请求数: ${summary.cache.totalRequests}`);
    console.log(`  命中次数: ${summary.cache.hits}`);
    console.log(`  未命中次数: ${summary.cache.misses}`);
    console.log(`  命中率: ${(summary.cache.hitRate * 100).toFixed(2)}%`);

    // 检查是否达到目标
    const pageLoadTarget = 2000; // 2秒
    const apiCallTarget = 300; // 300ms
    const cacheHitRateTarget = 0.8; // 80%

    console.log('\n🎯 目标达成情况:');
    console.log(`  页面加载 < ${pageLoadTarget}ms: ${summary.pageLoads.average < pageLoadTarget ? '✓ 达成' : '✗ 未达成'}`);
    console.log(`  API 调用 < ${apiCallTarget}ms: ${summary.apiCalls.average < apiCallTarget ? '✓ 达成' : '✗ 未达成'}`);
    console.log(`  缓存命中率 > ${cacheHitRateTarget * 100}%: ${summary.cache.hitRate > cacheHitRateTarget ? '✓ 达成' : '✗ 未达成'}`);

    console.log('\n===================\n');
  }

  /**
   * 清除所有统计数据
   */
  clear(): void {
    this.stats = {
      pageLoads: [],
      apiCalls: [],
      cacheHits: [],
    };
  }

  /**
   * 启用或禁用性能监控
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// 导出单例实例
export const performanceMonitor = new PerformanceMonitor();

// 导出类型
export type { PerformanceMetric, CacheMetric, PerformanceStats };
