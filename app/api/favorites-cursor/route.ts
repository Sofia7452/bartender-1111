/**
 * 收藏列表 API - 游标分页版本
 * 
 * GET /api/favorites-cursor?cursor=xxx&limit=3
 * 
 * ## 为什么使用游标分页？
 * 
 * ### 性能对比
 * 
 * **OFFSET 分页（旧版）**
 * ```sql
 * -- 第100页，需要扫描前990条数据
 * SELECT * FROM favorites ORDER BY created_at DESC LIMIT 10 OFFSET 990
 * ```
 * 性能：O(N) - 随着页码增加而变慢
 * 
 * **游标分页（新版）**
 * ```sql
 * -- 直接定位，无需扫描
 * SELECT * FROM favorites 
 * WHERE created_at < '2024-01-01' 
 * ORDER BY created_at DESC 
 * LIMIT 10
 * ```
 * 性能：O(log N) - 性能稳定，不受数据量影响
 * 
 * ### 使用场景
 * - ✅ 无限滚动列表
 * - ✅ "加载更多"按钮
 * - ✅ 移动端分页
 * - ✅ 实时数据流
 * 
 * ### 注意事项
 * - 不支持跳转到任意页码（这是游标分页的特性）
 * - 适合单向浏览（向下滚动）
 * - 需要确保排序字段有索引
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { getSessionIdFromRequest, setSessionCookie } from '../../lib/session';
import {
  normalizePaginationParams,
  buildCursorResponse,
  withPerformanceMonitor,
} from '../../lib/cursorPagination';

/**
 * 获取收藏列表（游标分页）
 * 
 * @param request - Next.js 请求对象
 * @returns 收藏列表和游标分页信息
 * 
 * @queryParams
 * - cursor: string (可选) - 游标，用于定位查询起始位置
 * - limit: number (可选，默认3，最大50) - 每页数量
 * 
 * @example
 * ```typescript
 * // 第一页（不传 cursor）
 * GET /api/favorites-cursor?limit=3
 * 
 * // 第二页（使用返回的 nextCursor）
 * GET /api/favorites-cursor?cursor=xxx&limit=3
 * 
 * // 第三页（继续使用新的 nextCursor）
 * GET /api/favorites-cursor?cursor=yyy&limit=3
 * ```
 * 
 * @response 200 - 查询成功
 * {
 *   success: true,
 *   favorites: Array<{
 *     id: string,
 *     sessionId: string,
 *     recipeId: string,
 *     createdAt: Date,
 *     recipe: Recipe
 *   }>,
 *   pagination: {
 *     nextCursor: string | null,  // 下一页的游标
 *     prevCursor: string | null,  // 上一页的游标
 *     hasMore: boolean,           // 是否还有下一页
 *     count: number               // 当前页数据量
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // 1. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 2. 解析和验证查询参数
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    const rawCursor = searchParams.get('cursor');

    // 验证并规范化参数
    let limit: number;
    let cursor: string | null;
    
    try {
      ({ limit, cursor } = normalizePaginationParams(rawLimit, rawCursor, 3, 50));
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '参数验证失败',
        },
        { status: 400 }
      );
    }

    console.log(`📋 [游标分页] 获取收藏列表，sessionId: ${sessionId}, limit: ${limit}, cursor: ${cursor ? '存在' : '无'}`);

    // 3. 执行游标分页查询
    const { result: favorites, duration } = await withPerformanceMonitor(
      '收藏列表查询',
      async () => {
        return await prisma.userFavorite.findMany({
          where: {
            sessionId,
            // 游标条件：查询创建时间早于游标的记录
            // 如果没有游标，则不添加此条件（查询第一页）
            ...(cursor && {
              createdAt: {
                lt: new Date(cursor), // lt = less than（小于）
              },
            }),
          },
          select: {
            id: true,
            sessionId: true,
            recipeId: true,
            createdAt: true,
            recipe: {
              select: {
                id: true,
                name: true,
                description: true,
                ingredients: true,
                steps: true,
                difficulty: true,
                estimatedTime: true,
                category: true,
                glassType: true,
                technique: true,
                garnish: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc', // 按创建时间降序排序（最新的在前）
          },
          take: limit + 1, // 多取1条，用于判断是否还有下一页
        });
      }
    );

    // 4. 构建游标分页响应
    const paginationInfo = buildCursorResponse(
      favorites,
      limit,
      (item) => item.createdAt // 使用 createdAt 作为游标
    );

    // 5. 移除多余的那一条数据
    const actualFavorites = favorites.slice(0, Math.min(favorites.length, limit));

    // 6. 格式化响应数据
    const favoritesData = actualFavorites.map((favorite) => ({
      id: favorite.id,
      sessionId: favorite.sessionId,
      recipeId: favorite.recipeId,
      createdAt: favorite.createdAt,
      recipe: favorite.recipe,
    }));

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log(`✅ [游标分页] 查询完成，返回 ${favoritesData.length} 条数据，hasMore: ${paginationInfo.hasMore}`);
    console.log(`⏱️ [Performance] API 总耗时: ${totalDuration.toFixed(2)}ms (数据库: ${duration.toFixed(2)}ms)`);

    // 7. 创建响应
    const response = NextResponse.json({
      success: true,
      favorites: favoritesData,
      pagination: paginationInfo,
    });

    // 8. 如果 sessionId 是新生成的，设置到 cookie 中
    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    return response;

  } catch (error) {
    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.error('获取收藏列表API错误:', error);
    console.log(`⏱️ [Performance] API 错误耗时: ${totalDuration.toFixed(2)}ms`);

    return NextResponse.json(
      {
        success: false,
        error: '获取收藏列表失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}
