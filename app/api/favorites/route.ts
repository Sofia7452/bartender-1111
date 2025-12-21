import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '../../lib/database';
import { prisma } from '../../lib/prisma';
import { getSessionIdFromRequest, setSessionCookie } from '../../lib/session';

/**
 * 添加收藏
 * POST /api/favorites
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 从请求体中提取 recipeId
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('请求体解析失败:', error);
      return NextResponse.json(
        { success: false, error: '请求体格式错误，请确保 Content-Type 为 application/json' },
        { status: 400 }
      );
    }

    const { recipeId, recipeData } = body || {};

    // 验证 recipeId 是否存在
    if (!recipeId || typeof recipeId !== 'string') {
      console.error('recipeId 验证失败:', { recipeId, type: typeof recipeId, body });
      return NextResponse.json(
        {
          success: false,
          error: '配方ID不能为空',
          details: '请确保请求体包含有效的 recipeId 字段（字符串类型）'
        },
        { status: 400 }
      );
    }

    console.log(`❤️ 收到收藏请求，recipeId: ${recipeId}`);

    // 2. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    // 如果没有现有cookie，说明是新生成的sessionId
    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 3. 初始化数据库连接
    await initializeDatabase();

    // 4. 验证 recipeId 是否存在（查询 recipes 表）
    let recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });

    // 5. 如果Recipe不存在，但提供了recipeData，则创建Recipe记录
    // 注意：Recipe 是共享资源，可以被两类收藏关系使用：
    // - UserFavorite（单独收藏，通过此 API）
    // - SavedSetRecipe（套装收藏中的酒品，通过 /api/saved-sets）
    // 因此，创建 Recipe 是合理的，它会被两类关系共享使用
    if (!recipe && recipeData) {
      console.log(`📝 配方不存在，使用传入的Recipe数据创建新配方，recipeId: ${recipeId}`);
      try {
        // 创建Recipe记录（使用传入的recipeId和recipeData）
        // 这个 Recipe 可以被单独收藏（UserFavorite）和套装收藏（SavedSetRecipe）共享使用
        recipe = await prisma.recipe.create({
          data: {
            id: recipeId, // 使用传入的recipeId
            name: recipeData.name || '未知配方',
            description: recipeData.description || null,
            ingredients: recipeData.ingredients || [],
            steps: recipeData.steps || [],
            difficulty: recipeData.difficulty ?? 1,
            estimatedTime: recipeData.estimatedTime ?? 0,
            source: recipeData.source || null,
            category: recipeData.category || null,
            glassType: recipeData.glassType || null,
            technique: recipeData.technique || null,
            garnish: recipeData.garnish || null,
            notes: recipeData.notes || null,
          }
        });
        console.log(`✅ 成功创建新配方，recipeId: ${recipeId}`);
      } catch (error) {
        console.error(`❌ 创建配方失败，recipeId: ${recipeId}`, error);
        return NextResponse.json(
          {
            success: false,
            error: '创建配方失败',
            details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
          },
          { status: 500 }
        );
      }
    }

    // 6. 如果Recipe仍然不存在，返回错误
    if (!recipe) {
      console.error(`❌ 配方不存在，recipeId: ${recipeId}，且未提供Recipe数据`);
      return NextResponse.json(
        {
          success: false,
          error: '配方不存在',
          details: '如果配方不存在，请提供完整的Recipe数据（recipeData字段）以自动创建配方'
        },
        { status: 404 }
      );
    }

    // 7. 检查是否已收藏（防止重复收藏）
    const existingFavorite = await prisma.userFavorite.findUnique({
      where: {
        sessionId_recipeId: {
          sessionId,
          recipeId
        }
      }
    });

    if (existingFavorite) {
      console.log(`⚠️ 配方已收藏，recipeId: ${recipeId}`);
      return NextResponse.json(
        {
          success: false,
          error: '该配方已收藏',
          favorite: {
            id: existingFavorite.id,
            sessionId: existingFavorite.sessionId,
            recipeId: existingFavorite.recipeId,
            createdAt: existingFavorite.createdAt
          }
        },
        { status: 409 } // Conflict
      );
    }

    // 8. 创建新的 UserFavorite 记录
    const savedFavorite = await prisma.userFavorite.create({
      data: {
        sessionId,
        recipeId
      }
    });
    console.log(`✅ 收藏成功，favoriteId: ${savedFavorite.id}`);

    // 9. 创建响应并设置 cookie
    const response = NextResponse.json({
      success: true,
      favorite: {
        id: savedFavorite.id,
        sessionId: savedFavorite.sessionId,
        recipeId: savedFavorite.recipeId,
        createdAt: savedFavorite.createdAt
      },
      recipe: {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description
      }
    });

    // 9. 如果 sessionId 是新生成的，设置到 cookie 中
    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    return response;

  } catch (error) {
    console.error('收藏API错误:', error);

    // 处理数据库唯一索引约束错误（已收藏的情况）
    if (error instanceof Error) {
      // PostgreSQL 唯一约束违反错误
      if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: '该配方已收藏'
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: '收藏失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 获取收藏列表
 * GET /api/favorites?page=1&limit=20
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // 1. 获取或生成 sessionId
    const sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    // 如果没有现有cookie，说明是新生成的sessionId
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

    console.log(`📋 获取收藏列表，sessionId: ${sessionId}, page: ${page}, limit: ${limit}`);

    // Prisma Client 会自动管理连接池，不需要每次都初始化
    // await initializeDatabase(); // ❌ 已移除，减少不必要的连接初始化时间

    // 5. 使用 Prisma Client 查询该sessionId的所有收藏记录，并关联 recipe 实体
    // 计算分页参数
    const skip = (page - 1) * limit;

    const queryStartTime = performance.now();
    
    // 查询收藏记录（使用 select 只返回必需字段）
    const [favorites, total] = await Promise.all([
      prisma.userFavorite.findMany({
        where: {
          sessionId
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
              garnish: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc' // 按创建时间降序排序
        },
        skip,
        take: limit
      }),
      prisma.userFavorite.count({
        where: {
          sessionId
        }
      })
    ]);

    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    
    console.log(`✅ 查询完成，找到 ${total} 条收藏记录，当前页 ${favorites.length} 条`);
    console.log(`⏱️ [Performance] 数据库查询耗时: ${queryDuration.toFixed(2)}ms`);

    // 6. 计算总页数
    const pages = Math.ceil(total / limit);

    // 7. 格式化响应数据（数据已经通过 select 优化，无需额外处理）
    const favoritesData = favorites.map((favorite) => ({
      id: favorite.id,
      sessionId: favorite.sessionId,
      recipeId: favorite.recipeId,
      createdAt: favorite.createdAt,
      recipe: favorite.recipe
    }));

    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    console.log(`⏱️ [Performance] API 总耗时: ${totalDuration.toFixed(2)}ms`);

    // 8. 创建响应
    const response = NextResponse.json({
      success: true,
      favorites: favoritesData,
      pagination: {
        page,
        limit,
        total,
        pages
      }
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
    
    console.error('获取收藏列表API错误:', error);
    console.log(`⏱️ [Performance] API 错误耗时: ${totalDuration.toFixed(2)}ms`);

    return NextResponse.json(
      {
        success: false,
        error: '获取收藏列表失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 取消收藏
 * DELETE /api/favorites
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 从请求体中提取 recipeId
    const body = await request.json();
    const { recipeId } = body;

    // 2. 验证参数存在（recipeId不能为空）
    if (!recipeId || typeof recipeId !== 'string') {
      return NextResponse.json(
        { success: false, error: '配方ID不能为空' },
        { status: 400 }
      );
    }

    console.log(`🗑️ 收到取消收藏请求，recipeId: ${recipeId}`);

    // 3. 获取或生成 sessionId
    let sessionId = getSessionIdFromRequest(request);
    const hasExistingCookie = request.cookies.has('session_id');

    // 如果没有现有cookie，说明是新生成的sessionId
    if (!hasExistingCookie) {
      console.log(`📝 生成新的 sessionId: ${sessionId}`);
    } else {
      console.log(`📝 使用现有 sessionId: ${sessionId}`);
    }

    // 4. 初始化数据库连接
    await initializeDatabase();

    // 5. 查询并删除匹配的收藏记录（同时匹配sessionId和recipeId）
    // 安全考虑：确保只能删除自己的收藏（通过sessionId验证）
    // 先查找收藏记录
    const favorite = await prisma.userFavorite.findUnique({
      where: {
        sessionId_recipeId: {
          sessionId,
          recipeId
        }
      }
    });

    // 6. 检查是否找到记录（如果不存在，返回友好提示）
    if (!favorite) {
      console.log(`⚠️ 收藏记录不存在，recipeId: ${recipeId}, sessionId: ${sessionId}`);
      return NextResponse.json(
        {
          success: false,
          error: '收藏记录不存在或已被删除'
        },
        { status: 404 }
      );
    }

    // 7. 删除收藏记录
    await prisma.userFavorite.delete({
      where: {
        id: favorite.id
      }
    });
    console.log(`✅ 取消收藏成功，favoriteId: ${favorite.id}`);

    // 8. 创建响应
    const response = NextResponse.json({
      success: true,
      message: '取消收藏成功',
      deletedFavorite: {
        id: favorite.id,
        recipeId: favorite.recipeId
      }
    });

    // 9. 如果 sessionId 是新生成的，设置到 cookie 中
    if (!hasExistingCookie) {
      setSessionCookie(response, sessionId);
      console.log(`🍪 已设置 sessionId cookie`);
    }

    return response;

  } catch (error) {
    console.error('取消收藏API错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: '取消收藏失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

