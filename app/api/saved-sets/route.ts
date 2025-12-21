/**
 * 套装收藏 API
 * 
 * POST /api/saved-sets - 创建套装收藏
 * GET /api/saved-sets - 获取套装列表
 * DELETE /api/saved-sets - 删除套装收藏
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '../../lib/database';
import { prisma } from '../../lib/prisma';
import { getSessionIdFromRequest, setSessionCookie } from '../../lib/session';
import {
  saveDish,
  createSavedSet,
  deleteSavedSet,
} from '../../services/savedSetService';
import type { DishRecommendation } from '../../types/foodPairing';

/**
 * UUID 格式验证正则表达式
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 创建套装收藏
 * POST /api/saved-sets
 * 
 * @description 将一整套菜品和酒品搭配作为一个集合进行收藏
 * 
 * @param request - Next.js 请求对象
 * @returns NextResponse
 * 
 * @requestBody
 * {
 *   dish: DishRecommendation,    // 菜品数据（必需）
 *   recipeIds: string[],          // 酒品ID数组（必需，至少1个）
 *   name?: string,                // 套装名称（可选，最大255字符）
 *   description?: string          // 套装描述（可选）
 * }
 * 
 * @response 200 - 创建成功
 * {
 *   success: true,
 *   savedSet: {
 *     id: string,
 *     sessionId: string,
 *     name: string | null,
 *     description: string | null,
 *     createdAt: Date,
 *     updatedAt: Date,
 *     dish: DishInSet,
 *     recipes: RecipeInSet[]
 *   }
 * }
 * 
 * @response 400 - 请求参数错误
 * {
 *   success: false,
 *   error: string,
 *   details?: string
 * }
 * 
 * @response 404 - 数据不存在（菜品或酒品不存在）
 * {
 *   success: false,
 *   error: string
 * }
 * 
 * @response 409 - 重复收藏（同一用户同一菜品已创建套装）
 * {
 *   success: false,
 *   error: string
 * }
 * 
 * @response 500 - 服务器错误
 * {
 *   success: false,
 *   error: string,
 *   details?: string  // 仅在开发环境返回
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('请求体解析失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: '请求体格式错误，请确保 Content-Type 为 application/json',
        },
        { status: 400 }
      );
    }

    const { dish, recipeIds, recipeDataMap, name, description } = body || {};

    // 2. 验证必需参数
    if (!dish || typeof dish !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: '菜品数据不能为空',
          details: '请确保请求体包含有效的 dish 字段（对象类型）',
        },
        { status: 400 }
      );
    }

    // 验证 dish 对象的必需字段
    if (!dish.id || typeof dish.id !== 'string' || dish.id.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '菜品ID不能为空',
          details: 'dish.id 必须是有效的字符串',
        },
        { status: 400 }
      );
    }

    // 验证 dish.id 是否为有效的 UUID 格式（如果不是，saveDish 会自动生成新的 UUID）
    if (!UUID_REGEX.test(dish.id)) {
      console.warn(`⚠️ 菜品 ID 格式无效，将在保存时自动生成新 UUID: ${dish.id}`);
    }

    if (!dish.name || typeof dish.name !== 'string' || dish.name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '菜品名称不能为空',
          details: 'dish.name 必须是有效的非空字符串',
        },
        { status: 400 }
      );
    }

    if (!dish.cuisine || typeof dish.cuisine !== 'string' || dish.cuisine.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '菜系不能为空',
          details: 'dish.cuisine 必须是有效的非空字符串',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(dish.requiredIngredients)) {
      return NextResponse.json(
        {
          success: false,
          error: '所需食材列表格式错误',
          details: 'dish.requiredIngredients 必须是数组类型',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(dish.steps)) {
      return NextResponse.json(
        {
          success: false,
          error: '烹饪步骤列表格式错误',
          details: 'dish.steps 必须是数组类型',
        },
        { status: 400 }
      );
    }

    if (typeof dish.cookingTime !== 'number' || dish.cookingTime < 0) {
      return NextResponse.json(
        {
          success: false,
          error: '烹饪时间格式错误',
          details: 'dish.cookingTime 必须是非负数字',
        },
        { status: 400 }
      );
    }

    if (typeof dish.difficulty !== 'number' || dish.difficulty < 1 || dish.difficulty > 5) {
      return NextResponse.json(
        {
          success: false,
          error: '难度等级格式错误',
          details: 'dish.difficulty 必须是1-5之间的数字',
        },
        { status: 400 }
      );
    }

    // 验证 recipeIds
    if (!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '酒品ID列表不能为空',
          details: '请确保请求体包含有效的 recipeIds 字段（非空数组）',
        },
        { status: 400 }
      );
    }

    // 验证 recipeIds 数组中的每个元素都是字符串
    if (!recipeIds.every(id => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: '酒品ID格式错误',
          details: 'recipeIds 数组中的每个元素必须是有效的字符串',
        },
        { status: 400 }
      );
    }

    // 验证 recipeIds 是否为有效的 UUID 格式（如果不是，服务层会自动生成新的 UUID）
    const invalidIds = recipeIds.filter(id => !UUID_REGEX.test(id));
    if (invalidIds.length > 0) {
      console.warn(`⚠️ 检测到 ${invalidIds.length} 个无效的 UUID 格式，将在保存时自动生成新 UUID:`, invalidIds);
    }

    // 验证 recipeIds 数组去重（防止重复添加同一酒品）
    const uniqueRecipeIds = [...new Set(recipeIds)];
    if (uniqueRecipeIds.length !== recipeIds.length) {
      console.warn(`⚠️ 检测到重复的酒品ID，已自动去重`);
    }

    // 验证可选字段
    if (name !== undefined && (typeof name !== 'string' || name.length > 255)) {
      return NextResponse.json(
        {
          success: false,
          error: '套装名称格式错误',
          details: 'name 必须是字符串类型，且长度不超过255字符',
        },
        { status: 400 }
      );
    }

    console.log(`📦 收到套装收藏请求，dishId: ${dish.id}, recipeIds: ${recipeIds.length} 个`);

    // 3. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 4. 保存或获取 Dish 记录
    // 注意：Prisma Client 会自动管理连接池，无需手动初始化
    const dishRecord = await saveDish(dish as DishRecommendation);

    // 5. 准备 Recipe 数据映射（如果提供了 recipeDataMap）
    // recipeDataMap 是从前端传来的对象，格式: { [recipeId]: recipeData }
    let recipeDataMapInstance: Map<string, any> | undefined;
    if (recipeDataMap && typeof recipeDataMap === 'object' && !Array.isArray(recipeDataMap)) {
      recipeDataMapInstance = new Map(Object.entries(recipeDataMap));
      console.log(`📝 收到 Recipe 数据映射，包含 ${recipeDataMapInstance.size} 个 Recipe`);
    }

    // 6. 创建套装收藏（使用去重后的 recipeIds）
    const savedSet = await createSavedSet(
      sessionId,
      dishRecord.id,
      uniqueRecipeIds,
      recipeDataMapInstance,
      name,
      description
    );

    // 7. 格式化响应数据
    const responseData = {
      success: true,
      savedSet: {
        id: savedSet.id,
        sessionId: savedSet.sessionId,
        name: savedSet.name,
        description: savedSet.description,
        createdAt: savedSet.createdAt,
        updatedAt: savedSet.updatedAt,
        dish: {
          id: savedSet.dish.id,
          name: savedSet.dish.name,
          description: savedSet.dish.description,
          cuisine: savedSet.dish.cuisine,
          requiredIngredients: savedSet.dish.requiredIngredients,
          cookingTime: savedSet.dish.cookingTime,
          difficulty: savedSet.dish.difficulty,
          steps: savedSet.dish.steps,
          source: savedSet.dish.source,
          tags: savedSet.dish.tags,
        },
        recipes: savedSet.recipes.map((sr) => ({
          id: sr.recipe.id,
          name: sr.recipe.name,
          description: sr.recipe.description,
          ingredients: sr.recipe.ingredients,
          steps: sr.recipe.steps,
          difficulty: sr.recipe.difficulty,
          estimatedTime: sr.recipe.estimatedTime,
          category: sr.recipe.category,
          glassType: sr.recipe.glassType,
          technique: sr.recipe.technique,
          garnish: sr.recipe.garnish,
        })),
      },
    };

    // 8. 创建响应并设置 cookie
    const response = NextResponse.json(responseData);

    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    console.log(`✅ 套装收藏成功，savedSetId: ${savedSet.id}`);
    return response;

  } catch (error) {
    console.error('创建套装收藏API错误:', error);

    // 处理特定错误
    if (error instanceof Error) {
      // 重复收藏错误
      if (error.message.includes('已收藏') || error.message.includes('已存在')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 409 } // Conflict
        );
      }

      // 数据不存在错误
      if (error.message.includes('不存在')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        );
      }

      // 参数验证错误
      if (error.message.includes('不能为空') || error.message.includes('格式错误')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    // 通用错误
    return NextResponse.json(
      {
        success: false,
        error: '创建套装收藏失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * 获取套装列表
 * GET /api/saved-sets?page=1&limit=10
 * 
 * @description 获取当前用户的所有套装收藏列表，支持分页
 * 
 * @param request - Next.js 请求对象
 * @returns NextResponse
 * 
 * @queryParams
 * - page: number (可选，默认1) - 页码，从1开始
 * - limit: number (可选，默认10，最大50) - 每页数量
 * 
 * @response 200 - 查询成功
 * {
 *   success: true,
 *   savedSets: SavedSetWithRelations[],
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     total: number,
 *     totalPages: number
 *   }
 * }
 * 
 * @response 400 - 请求参数错误（页码无效）
 * {
 *   success: false,
 *   error: string
 * }
 * 
 * @response 500 - 服务器错误
 * {
 *   success: false,
 *   error: string,
 *   details?: string  // 仅在开发环境返回
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

    // 2. 从查询参数中获取 page 和 limit
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    let limit = parseInt(searchParams.get('limit') || '10', 10);

    // 3. 验证 limit 范围（最大50）
    if (limit > 50) {
      limit = 50;
      console.warn(`⚠️ limit 超过最大值，已限制为 50`);
    }
    if (limit < 1) {
      limit = 10;
    }

    // 验证 page 范围
    if (page < 1) {
      return NextResponse.json(
        { success: false, error: '页码必须大于0' },
        { status: 400 }
      );
    }

    console.log(`📋 获取套装列表，sessionId: ${sessionId}, page: ${page}, limit: ${limit}`);

    // Prisma Client 会自动管理连接池，不需要每次都初始化
    // await initializeDatabase(); // ❌ 已移除，减少不必要的连接初始化时间

    // 5. 计算分页参数
    const skip = (page - 1) * limit;
    
    const queryStartTime = performance.now();

    // 6. 查询套装列表（使用 select 优化，只返回必需字段）
    const [savedSets, total] = await Promise.all([
      prisma.savedSet.findMany({
        where: { sessionId },
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
            }
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
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.savedSet.count({
        where: { sessionId }
      })
    ]);

    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    
    console.log(`✅ 查询完成，找到 ${total} 个套装，当前页 ${savedSets.length} 个`);
    console.log(`⏱️ [Performance] 数据库查询耗时: ${queryDuration.toFixed(2)}ms`);

    // 7. 格式化响应数据（数据已经通过 select 优化，直接映射即可）
    const savedSetsData = savedSets.map((savedSet: any) => ({
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
    
    console.log(`⏱️ [Performance] API 总耗时: ${totalDuration.toFixed(2)}ms`);

    // 8. 创建响应
    const response = NextResponse.json({
      success: true,
      savedSets: savedSetsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

    // 9. 如果 sessionId 是新生成的，设置到 cookie 中
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

/**
 * 删除套装收藏
 * DELETE /api/saved-sets
 * 
 * @description 删除指定的套装收藏，只能删除自己的套装
 * 
 * @param request - Next.js 请求对象
 * @returns NextResponse
 * 
 * @requestBody
 * {
 *   savedSetId: string  // 套装ID（必需，UUID格式）
 * }
 * 
 * @response 200 - 删除成功
 * {
 *   success: true,
 *   message: string
 * }
 * 
 * @response 400 - 请求参数错误
 * {
 *   success: false,
 *   error: string,
 *   details?: string
 * }
 * 
 * @response 403 - 权限不足（无权删除此套装）
 * {
 *   success: false,
 *   error: string
 * }
 * 
 * @response 404 - 套装不存在
 * {
 *   success: false,
 *   error: string
 * }
 * 
 * @response 500 - 服务器错误
 * {
 *   success: false,
 *   error: string,
 *   details?: string  // 仅在开发环境返回
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('请求体解析失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: '请求体格式错误，请确保 Content-Type 为 application/json',
        },
        { status: 400 }
      );
    }

    const { savedSetId } = body || {};

    // 2. 验证参数
    if (!savedSetId || typeof savedSetId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '套装ID不能为空',
          details: '请确保请求体包含有效的 savedSetId 字段（字符串类型）',
        },
        { status: 400 }
      );
    }

    // 验证 savedSetId 格式（UUID格式）
    if (!UUID_REGEX.test(savedSetId)) {
      return NextResponse.json(
        {
          success: false,
          error: '套装ID格式错误',
          details: 'savedSetId 必须是有效的UUID格式',
        },
        { status: 400 }
      );
    }

    console.log(`🗑️ 收到删除套装请求，savedSetId: ${savedSetId}`);

    // 3. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 4. 删除套装收藏
    // 注意：Prisma Client 会自动管理连接池，无需手动初始化
    await deleteSavedSet(sessionId, savedSetId);

    // 5. 创建响应
    const response = NextResponse.json({
      success: true,
      message: '套装删除成功',
    });

    // 6. 如果 sessionId 是新生成的，设置到 cookie 中
    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    console.log(`✅ 删除套装成功，savedSetId: ${savedSetId}`);
    return response;

  } catch (error) {
    console.error('删除套装API错误:', error);

    // 处理特定错误
    if (error instanceof Error) {
      // 不存在错误
      if (error.message.includes('不存在')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        );
      }

      // 权限错误
      if (error.message.includes('无权')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 } // Forbidden
        );
      }
    }

    // 通用错误
    return NextResponse.json(
      {
        success: false,
        error: '删除套装失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

