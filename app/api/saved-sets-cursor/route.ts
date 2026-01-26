/**
 * 套装列表 API - 游标分页版本
 * 
 * GET /api/saved-sets-cursor?cursor=xxx&limit=3
 * 
 * ## 游标分页优势
 * 
 * ### 性能对比示例
 * 
 * **场景**: 用户有1000个套装，查询第100页
 * 
 * | 分页方式 | SQL操作 | 性能 |
 * |---------|--------|------|
 * | OFFSET | 扫描990条数据 | ~500ms |
 * | 游标 | 直接定位 | ~50ms |
 * 
 * **性能提升**: 10倍
 * 
 * ### 适用场景
 * - ✅ 移动端列表（上拉加载更多）
 * - ✅ 瀑布流布局
 * - ✅ 实时数据订阅
 * - ✅ 大数据量列表
 * 
 * ### 不适用场景
 * - ❌ 需要跳转到指定页码
 * - ❌ 需要显示总页数
 * - ❌ 需要分页器组件
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
 * 获取套装列表（游标分页）
 * 
 * @param request - Next.js 请求对象
 * @returns 套装列表和游标分页信息
 * 
 * @queryParams
 * - cursor: string (可选) - 游标，用于定位查询起始位置
 * - limit: number (可选，默认3，最大50) - 每页数量
 * 
 * @response 200 - 查询成功
 * {
 *   success: true,
 *   savedSets: Array<{
 *     id: string,
 *     sessionId: string,
 *     name: string | null,
 *     description: string | null,
 *     createdAt: Date,
 *     updatedAt: Date,
 *     dish: Dish,
 *     recipes: Recipe[]
 *   }>,
 *   pagination: {
 *     nextCursor: string | null,
 *     prevCursor: string | null,
 *     hasMore: boolean,
 *     count: number
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

    console.log(`📦 [游标分页] 获取套装列表，sessionId: ${sessionId}, limit: ${limit}, cursor: ${cursor ? '存在' : '无'}`);

    // 3. 执行游标分页查询
    const { result: savedSets, duration } = await withPerformanceMonitor(
      '套装列表查询',
      async () => {
        return await prisma.savedSet.findMany({
          where: {
            sessionId,
            // 游标条件：查询创建时间早于游标的记录
            ...(cursor && {
              createdAt: {
                lt: new Date(cursor),
              },
            }),
          },
          select: {
            id: true,
            sessionId: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            dish: {
              select: {
                id: true,
                name: true,
                description: true,
                cuisine: true,
                requiredIngredients: true,
                cookingTime: true,
                difficulty: true,
                steps: true,
                source: true,
                tags: true,
              },
            },
            recipes: {
              select: {
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
            },
          },
          orderBy: {
            createdAt: 'desc', // 按创建时间降序排序
          },
          take: limit + 1, // 多取1条，用于判断是否还有下一页
        });
      }
    );

    // 4. 构建游标分页响应
    const paginationInfo = buildCursorResponse(
      savedSets,
      limit,
      (item) => item.createdAt
    );

    // 5. 移除多余的那一条数据
    const actualSavedSets = savedSets.slice(0, Math.min(savedSets.length, limit));

    // 6. 格式化响应数据
    const savedSetsData = actualSavedSets.map((savedSet: any) => ({
      id: savedSet.id,
      sessionId: savedSet.sessionId,
      name: savedSet.name,
      description: savedSet.description,
      createdAt: savedSet.createdAt,
      updatedAt: savedSet.updatedAt,
      dish: savedSet.dish,
      recipes: savedSet.recipes.map((sr: any) => sr.recipe),
    }));

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log(`✅ [游标分页] 查询完成，返回 ${savedSetsData.length} 个套装，hasMore: ${paginationInfo.hasMore}`);
    console.log(`⏱️ [Performance] API 总耗时: ${totalDuration.toFixed(2)}ms (数据库: ${duration.toFixed(2)}ms)`);

    // 7. 创建响应
    const response = NextResponse.json({
      success: true,
      savedSets: savedSetsData,
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

    console.error('获取套装列表API错误:', error);
    console.log(`⏱️ [Performance] API 错误耗时: ${totalDuration.toFixed(2)}ms`);

    return NextResponse.json(
      {
        success: false,
        error: '获取套装列表失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}
