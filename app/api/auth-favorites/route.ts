/**
 * 登录用户收藏 API
 * 
 * 与匿名用户的 /api/favorites 不同，此 API 要求用户必须登录
 * 收藏数据存储在 AuthUserFavorite 表中，与 User 关联
 * 
 * POST /api/auth-favorites - 添加收藏
 * GET /api/auth-favorites - 获取收藏列表
 * DELETE /api/auth-favorites - 取消收藏
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { getAuthInfo } from '../../lib/auth';

/**
 * 添加收藏（登录用户）
 * POST /api/auth-favorites
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 获取认证信息
    const authInfo = getAuthInfo(request);

    if (!authInfo.isAuthenticated || !authInfo.userId) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }

    const { recipeId, recipeData } = body || {};

    if (!recipeId || typeof recipeId !== 'string') {
      return NextResponse.json(
        { success: false, error: '配方ID不能为空' },
        { status: 400 }
      );
    }

    console.log(`❤️ [登录用户] 收到收藏请求，userId: ${authInfo.userId}, recipeId: ${recipeId}`);

    // 3. 检查配方是否存在，不存在则创建
    let recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });

    if (!recipe && recipeData) {
      recipe = await prisma.recipe.create({
        data: {
          id: recipeId,
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
          notes: recipeData.notes || null
        }
      });
      console.log(`✅ 成功创建新配方，recipeId: ${recipeId}`);
    }

    if (!recipe) {
      return NextResponse.json(
        { success: false, error: '配方不存在' },
        { status: 404 }
      );
    }

    // 4. 检查是否已收藏
    const existingFavorite = await prisma.authUserFavorite.findUnique({
      where: {
        userId_recipeId: {
          userId: authInfo.userId,
          recipeId
        }
      }
    });

    if (existingFavorite) {
      return NextResponse.json(
        { success: false, error: '该配方已收藏' },
        { status: 409 }
      );
    }

    // 5. 创建收藏记录
    const favorite = await prisma.authUserFavorite.create({
      data: {
        userId: authInfo.userId,
        recipeId
      }
    });

    console.log(`✅ [登录用户] 收藏成功，favoriteId: ${favorite.id}`);

    return NextResponse.json({
      success: true,
      favorite: {
        id: favorite.id,
        userId: favorite.userId,
        recipeId: favorite.recipeId,
        createdAt: favorite.createdAt
      },
      recipe: {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description
      }
    });

  } catch (error) {
    console.error('[登录用户] 收藏 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '收藏失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 获取收藏列表（登录用户）
 * GET /api/auth-favorites?page=1&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 获取认证信息
    const authInfo = getAuthInfo(request);

    if (!authInfo.isAuthenticated || !authInfo.userId) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 解析分页参数
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    console.log(`📋 [登录用户] 获取收藏列表，userId: ${authInfo.userId}, page: ${page}`);

    // 3. 查询收藏
    const [favorites, total] = await Promise.all([
      prisma.authUserFavorite.findMany({
        where: { userId: authInfo.userId },
        include: {
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.authUserFavorite.count({
        where: { userId: authInfo.userId }
      })
    ]);

    const pages = Math.ceil(total / limit);

    console.log(`✅ [登录用户] 查询完成，共 ${total} 条收藏`);

    return NextResponse.json({
      success: true,
      favorites: favorites.map(f => ({
        id: f.id,
        userId: f.userId,
        recipeId: f.recipeId,
        createdAt: f.createdAt,
        recipe: f.recipe
      })),
      pagination: { page, limit, total, pages }
    });

  } catch (error) {
    console.error('[登录用户] 获取收藏列表 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '获取收藏列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 取消收藏（登录用户）
 * DELETE /api/auth-favorites
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 获取认证信息
    const authInfo = getAuthInfo(request);

    if (!authInfo.isAuthenticated || !authInfo.userId) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { recipeId } = body;

    if (!recipeId || typeof recipeId !== 'string') {
      return NextResponse.json(
        { success: false, error: '配方ID不能为空' },
        { status: 400 }
      );
    }

    console.log(`🗑️ [登录用户] 取消收藏，userId: ${authInfo.userId}, recipeId: ${recipeId}`);

    // 3. 查找并删除收藏
    const favorite = await prisma.authUserFavorite.findUnique({
      where: {
        userId_recipeId: {
          userId: authInfo.userId,
          recipeId
        }
      }
    });

    if (!favorite) {
      return NextResponse.json(
        { success: false, error: '收藏记录不存在' },
        { status: 404 }
      );
    }

    await prisma.authUserFavorite.delete({
      where: { id: favorite.id }
    });

    console.log(`✅ [登录用户] 取消收藏成功`);

    return NextResponse.json({
      success: true,
      message: '取消收藏成功',
      deletedFavorite: {
        id: favorite.id,
        recipeId: favorite.recipeId
      }
    });

  } catch (error) {
    console.error('[登录用户] 取消收藏 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '取消收藏失败' },
      { status: 500 }
    );
  }
}
