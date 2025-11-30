/**
 * 套装收藏 API
 * 
 * POST /api/saved-sets - 创建套装收藏
 * GET /api/saved-sets - 获取套装列表
 * DELETE /api/saved-sets - 删除套装收藏
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '../../lib/database';
import { getSessionIdFromRequest, setSessionCookie } from '../../lib/session';
import {
  saveDish,
  createSavedSet,
  getSavedSets,
  deleteSavedSet,
} from '../../services/savedSetService';
import type { DishRecommendation } from '../../types/foodPairing';

/**
 * 创建套装收藏
 * POST /api/saved-sets
 * 
 * 请求体：
 * {
 *   dish: DishRecommendation,    // 菜品数据（必需）
 *   recipeIds: string[],          // 酒品ID数组（必需）
 *   name?: string,                // 套装名称（可选）
 *   description?: string          // 套装描述（可选）
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

    const { dish, recipeIds, name, description } = body || {};

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

    console.log(`📦 收到套装收藏请求，dishId: ${dish.id}, recipeIds: ${recipeIds.length} 个`);

    // 3. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 4. 初始化数据库连接
    await initializeDatabase();

    // 5. 保存或获取 Dish 记录
    const dishRecord = await saveDish(dish as DishRecommendation);

    // 6. 创建套装收藏
    const savedSet = await createSavedSet(
      sessionId,
      dishRecord.id,
      recipeIds,
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
 */
export async function GET(request: NextRequest) {
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

    // 4. 初始化数据库连接
    await initializeDatabase();

    // 5. 查询套装列表
    const result = await getSavedSets(sessionId, page, limit);

    // 6. 格式化响应数据
    const savedSetsData = result.savedSets.map((savedSet) => ({
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
    }));

    // 7. 创建响应
    const response = NextResponse.json({
      success: true,
      savedSets: savedSetsData,
      pagination: result.pagination,
    });

    // 8. 如果 sessionId 是新生成的，设置到 cookie 中
    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    console.log(`✅ 查询完成，找到 ${result.pagination.total} 个套装，当前页 ${savedSetsData.length} 个`);
    return response;

  } catch (error) {
    console.error('获取套装列表API错误:', error);

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
 * 请求体：
 * {
 *   savedSetId: string  // 套装ID（必需）
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

    console.log(`🗑️ 收到删除套装请求，savedSetId: ${savedSetId}`);

    // 3. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 4. 初始化数据库连接
    await initializeDatabase();

    // 5. 删除套装收藏
    await deleteSavedSet(sessionId, savedSetId);

    // 6. 创建响应
    const response = NextResponse.json({
      success: true,
      message: '套装删除成功',
    });

    // 7. 如果 sessionId 是新生成的，设置到 cookie 中
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

