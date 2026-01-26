/**
 * 游标分页工具库
 * 
 * 提供基于游标的分页功能，解决深分页性能问题
 * 
 * ## 游标分页 vs OFFSET 分页
 * 
 * ### OFFSET 分页（传统方式）
 * ```sql
 * SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 1000
 * ```
 * 问题：
 * - 需要扫描前 1000 条数据
 * - 页码越大，性能越差 O(N)
 * - 数据变动时可能出现重复或遗漏
 * 
 * ### 游标分页（推荐方式）
 * ```sql
 * SELECT * FROM users 
 * WHERE created_at < '2024-01-01' 
 * ORDER BY created_at DESC 
 * LIMIT 10
 * ```
 * 优点：
 * - 直接定位，无需扫描前面数据
 * - 性能稳定 O(log N)（如果有索引）
 * - 适合无限滚动和实时数据
 */

import type { CursorPaginationResponse } from '../types/pagination';

/**
 * 游标编码和解码（使用 Base64）
 * 
 * 为什么要编码？
 * 1. 隐藏内部实现细节
 * 2. 避免特殊字符问题
 * 3. 统一游标格式
 */
export class CursorCodec {
  /**
   * 编码游标
   * 
   * @param cursor - 原始游标值（通常是 ID 或时间戳）
   * @returns Base64 编码的游标字符串
   */
  static encode(cursor: string | number | Date): string {
    let value: string;
    
    if (cursor instanceof Date) {
      value = cursor.toISOString();
    } else {
      value = String(cursor);
    }
    
    return Buffer.from(value, 'utf-8').toString('base64url');
  }

  /**
   * 解码游标
   * 
   * @param encodedCursor - Base64 编码的游标
   * @returns 原始游标值
   */
  static decode(encodedCursor: string): string {
    try {
      return Buffer.from(encodedCursor, 'base64url').toString('utf-8');
    } catch (error) {
      throw new Error('无效的游标格式');
    }
  }

  /**
   * 验证游标格式
   * 
   * @param cursor - 游标字符串
   * @returns 是否为有效格式
   */
  static isValid(cursor: string): boolean {
    try {
      this.decode(cursor);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 构建游标分页响应
 * 
 * @template T - 数据项类型
 * @param items - 查询结果数组
 * @param limit - 每页数量
 * @param getCursor - 从数据项提取游标的函数
 * @returns 游标分页响应对象
 * 
 * @example
 * ```typescript
 * const favorites = await prisma.userFavorite.findMany({
 *   take: limit + 1, // 多取1条用于判断是否有下一页
 *   cursor: cursor ? { id: cursor } : undefined,
 *   skip: cursor ? 1 : 0, // 跳过游标本身
 * });
 * 
 * const response = buildCursorResponse(
 *   favorites,
 *   limit,
 *   (item) => item.id
 * );
 * ```
 */
export function buildCursorResponse<T>(
  items: T[],
  limit: number,
  getCursor: (item: T) => string | number | Date
): CursorPaginationResponse<string> {
  // 判断是否有更多数据（通过多取1条判断）
  const hasMore = items.length > limit;
  
  // 移除多余的那一条
  const actualItems = hasMore ? items.slice(0, limit) : items;
  
  // 计算游标
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;
  
  if (actualItems.length > 0) {
    // 下一页游标：最后一条数据的游标
    if (hasMore) {
      const lastItem = actualItems[actualItems.length - 1];
      nextCursor = CursorCodec.encode(getCursor(lastItem));
    }
    
    // 上一页游标：第一条数据的游标
    const firstItem = actualItems[0];
    prevCursor = CursorCodec.encode(getCursor(firstItem));
  }
  
  return {
    nextCursor,
    prevCursor,
    hasMore,
    count: actualItems.length,
  };
}

/**
 * 验证和规范化分页参数
 * 
 * @param limit - 原始 limit 参数
 * @param cursor - 原始 cursor 参数
 * @param defaultLimit - 默认每页数量
 * @param maxLimit - 最大每页数量
 * @returns 规范化后的参数
 */
export function normalizePaginationParams(
  limit: string | number | undefined | null,
  cursor: string | undefined | null,
  defaultLimit: number = 3,
  maxLimit: number = 50
): { limit: number; cursor: string | null } {
  // 规范化 limit
  let normalizedLimit = defaultLimit;
  
  if (limit !== undefined && limit !== null) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      normalizedLimit = Math.min(parsedLimit, maxLimit);
    } else {
      console.warn(`⚠️ 无效的 limit 值: ${limit}，使用默认值 ${defaultLimit}`);
    }
  }
  
  // 规范化 cursor
  let normalizedCursor: string | null = null;
  
  if (cursor) {
    if (CursorCodec.isValid(cursor)) {
      normalizedCursor = CursorCodec.decode(cursor);
    } else {
      console.warn(`⚠️ 无效的 cursor 格式: ${cursor}`);
      throw new Error('无效的游标格式');
    }
  }
  
  return {
    limit: normalizedLimit,
    cursor: normalizedCursor,
  };
}

/**
 * 性能监控装饰器（用于记录分页查询性能）
 * 
 * @param label - 日志标签
 * @param fn - 异步函数
 * @returns 执行结果和性能指标
 */
export async function withPerformanceMonitor<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    console.log(`⏱️ [CursorPagination] ${label} 耗时: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ [CursorPagination] ${label} 失败 (耗时: ${duration.toFixed(2)}ms)`, error);
    throw error;
  }
}
