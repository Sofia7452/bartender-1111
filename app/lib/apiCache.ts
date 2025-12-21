/**
 * API 缓存服务
 * 
 * 使用 Vercel KV (Redis) 实现高性能缓存
 * 
 * 安装依赖：
 * npm install @vercel/kv
 * 
 * 配置：
 * 1. 在 Vercel Dashboard 中启用 KV Storage
 * 2. 环境变量会自动注入（KV_REST_API_URL, KV_REST_API_TOKEN）
 */

// 注意：只有在安装了 @vercel/kv 后才能使用
// 如果未安装，这个文件会报错，但不影响其他功能

let kv: any = null;

try {
  // 动态导入，避免在未安装时报错
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
} catch (error) {
  console.warn('⚠️ @vercel/kv 未安装，缓存功能将被禁用');
  console.warn('   安装命令: npm install @vercel/kv');
}

/**
 * API 缓存类
 */
export class ApiCache {
  private ttl: number;
  private enabled: boolean;

  /**
   * @param ttl - 缓存过期时间（秒），默认 5 分钟
   */
  constructor(ttl: number = 5 * 60) {
    this.ttl = ttl;
    this.enabled = kv !== null && process.env.KV_REST_API_URL !== undefined;

    if (!this.enabled) {
      console.warn('⚠️ 缓存服务未启用（Vercel KV 未配置）');
    }
  }

  /**
   * 从缓存获取数据
   * 
   * @param key - 缓存键
   * @returns 缓存的数据，如果不存在或缓存未启用则返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const cached = await kv.get<T>(key);
      if (cached) {
        console.log(`✅ [Cache] 命中: ${key}`);
      } else {
        console.log(`❌ [Cache] 未命中: ${key}`);
      }
      return cached;
    } catch (error) {
      console.error('❌ [Cache] 读取失败:', error);
      return null;
    }
  }

  /**
   * 写入缓存
   * 
   * @param key - 缓存键
   * @param value - 要缓存的数据
   * @param ttl - 可选的过期时间（秒），覆盖默认值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await kv.set(key, value, { ex: ttl || this.ttl });
      console.log(`✅ [Cache] 写入: ${key} (TTL: ${ttl || this.ttl}s)`);
    } catch (error) {
      console.error('❌ [Cache] 写入失败:', error);
    }
  }

  /**
   * 删除单个缓存
   * 
   * @param key - 缓存键
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await kv.del(key);
      console.log(`✅ [Cache] 删除: ${key}`);
    } catch (error) {
      console.error('❌ [Cache] 删除失败:', error);
    }
  }

  /**
   * 删除匹配模式的所有缓存
   * 
   * @param pattern - 匹配模式（支持 * 通配符）
   * 
   * @example
   * // 删除某个用户的所有收藏缓存
   * await cache.invalidatePattern('favorites:user123:*');
   * 
   * // 删除所有收藏缓存
   * await cache.invalidatePattern('favorites:*');
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // 获取匹配的所有键
      const keys = await kv.keys(pattern);
      
      if (keys.length === 0) {
        console.log(`ℹ️ [Cache] 没有匹配的缓存: ${pattern}`);
        return;
      }

      // 批量删除
      await kv.del(...keys);
      console.log(`✅ [Cache] 批量删除: ${keys.length} 个键 (${pattern})`);
    } catch (error) {
      console.error('❌ [Cache] 批量删除失败:', error);
    }
  }

  /**
   * 清空所有缓存（谨慎使用）
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await kv.flushdb();
      console.log(`✅ [Cache] 已清空所有缓存`);
    } catch (error) {
      console.error('❌ [Cache] 清空失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    enabled: boolean;
    keyCount?: number;
    memoryUsage?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false };
    }

    try {
      const keys = await kv.keys('*');
      return {
        enabled: true,
        keyCount: keys.length,
      };
    } catch (error) {
      console.error('❌ [Cache] 获取统计信息失败:', error);
      return { enabled: true };
    }
  }
}

/**
 * 全局缓存实例
 * 
 * 使用示例：
 * ```typescript
 * import { apiCache } from '@/lib/apiCache';
 * 
 * // 读取缓存
 * const cached = await apiCache.get('my-key');
 * if (cached) {
 *   return cached;
 * }
 * 
 * // 写入缓存
 * const data = await fetchData();
 * await apiCache.set('my-key', data);
 * 
 * // 删除缓存
 * await apiCache.delete('my-key');
 * 
 * // 批量删除
 * await apiCache.invalidatePattern('user:123:*');
 * ```
 */
export const apiCache = new ApiCache(5 * 60); // 默认 5 分钟 TTL

/**
 * 生成缓存键的辅助函数
 */
export const CacheKeys = {
  /**
   * 收藏列表缓存键
   * @param sessionId - 用户会话ID
   * @param page - 页码
   * @param limit - 每页数量
   */
  favorites: (sessionId: string, page: number, limit: number) =>
    `favorites:${sessionId}:${page}:${limit}`,

  /**
   * 收藏列表模式（用于批量删除）
   * @param sessionId - 用户会话ID
   */
  favoritesPattern: (sessionId: string) => `favorites:${sessionId}:*`,

  /**
   * 套装列表缓存键
   * @param sessionId - 用户会话ID
   * @param page - 页码
   * @param limit - 每页数量
   */
  savedSets: (sessionId: string, page: number, limit: number) =>
    `saved-sets:${sessionId}:${page}:${limit}`,

  /**
   * 套装列表模式（用于批量删除）
   * @param sessionId - 用户会话ID
   */
  savedSetsPattern: (sessionId: string) => `saved-sets:${sessionId}:*`,

  /**
   * 单个套装缓存键
   * @param savedSetId - 套装ID
   */
  savedSet: (savedSetId: string) => `saved-set:${savedSetId}`,
};
