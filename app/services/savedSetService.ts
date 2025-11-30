/**
 * SavedSet 服务层
 * 
 * 提供菜品和套装收藏相关的业务逻辑
 */

import { prisma } from '../lib/prisma';
import type { DishRecommendation } from '../types/foodPairing';

/**
 * 保存或获取 Dish 记录
 * 如果 Dish 已存在（根据 id），则返回现有记录；否则创建新记录
 * 
 * @param dishData - 菜品数据（DishRecommendation 接口）
 * @returns Dish 数据库记录
 */
export async function saveDish(dishData: DishRecommendation) {
  try {
    // 先尝试根据 id 查找现有记录
    const existingDish = await prisma.dish.findUnique({
      where: { id: dishData.id }
    });

    if (existingDish) {
      console.log(`📦 菜品已存在，返回现有记录: ${dishData.id} - ${dishData.name}`);
      return existingDish;
    }

    // 如果不存在，创建新记录
    const newDish = await prisma.dish.create({
      data: {
        id: dishData.id,
        name: dishData.name,
        description: dishData.description || null,
        cuisine: dishData.cuisine,
        requiredIngredients: dishData.requiredIngredients,
        cookingTime: dishData.cookingTime,
        difficulty: dishData.difficulty,
        steps: dishData.steps,
        source: dishData.source || null,
        tags: dishData.tags || null,
      }
    });

    console.log(`✅ 创建新菜品记录: ${newDish.id} - ${newDish.name}`);
    return newDish;
  } catch (error) {
    console.error('保存菜品失败:', error);
    throw new Error(`保存菜品失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 创建套装收藏
 * 
 * @param sessionId - 用户会话ID
 * @param dishId - 菜品ID
 * @param recipeIds - 酒品ID数组
 * @param name - 套装名称（可选）
 * @param description - 套装描述（可选）
 * @returns 完整的套装数据（包含 Dish 和 Recipe 详情）
 */
export async function createSavedSet(
  sessionId: string,
  dishId: string,
  recipeIds: string[],
  name?: string,
  description?: string
) {
  try {
    // 1. 验证 dishId 是否存在
    const dish = await prisma.dish.findUnique({
      where: { id: dishId }
    });

    if (!dish) {
      throw new Error(`菜品不存在: ${dishId}`);
    }

    // 2. 验证所有 recipeIds 是否存在
    if (!recipeIds || recipeIds.length === 0) {
      throw new Error('酒品ID列表不能为空');
    }

    const recipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds }
      }
    });

    if (recipes.length !== recipeIds.length) {
      const foundIds = recipes.map(r => r.id);
      const missingIds = recipeIds.filter(id => !foundIds.includes(id));
      throw new Error(`部分酒品不存在: ${missingIds.join(', ')}`);
    }

    // 3. 检查是否已存在相同的套装（根据 sessionId 和 dishId）
    const existingSet = await prisma.savedSet.findUnique({
      where: {
        sessionId_dishId: {
          sessionId,
          dishId
        }
      }
    });

    if (existingSet) {
      throw new Error('该套装已收藏，同一用户同一菜品只能创建一个套装');
    }

    // 4. 创建 SavedSet 记录和关联的 SavedSetRecipe 记录（使用事务）
    const savedSet = await prisma.$transaction(async (tx) => {
      // 创建 SavedSet
      const newSet = await tx.savedSet.create({
        data: {
          sessionId,
          dishId,
          name: name || null,
          description: description || null,
        }
      });

      // 批量创建 SavedSetRecipe 关联记录
      await tx.savedSetRecipe.createMany({
        data: recipeIds.map(recipeId => ({
          savedSetId: newSet.id,
          recipeId,
        })),
        skipDuplicates: true, // 防止重复（虽然已有唯一约束，但这里更安全）
      });

      return newSet;
    });

    // 5. 查询完整的套装数据（包含关联的 Dish 和 Recipe）
    const completeSet = await prisma.savedSet.findUnique({
      where: { id: savedSet.id },
      include: {
        dish: true,
        recipes: {
          include: {
            recipe: true
          }
        }
      }
    });

    if (!completeSet) {
      throw new Error('创建套装后查询失败');
    }

    console.log(`✅ 创建套装成功: ${completeSet.id}，包含 ${completeSet.recipes.length} 个酒品`);

    return completeSet;
  } catch (error) {
    console.error('创建套装失败:', error);
    throw error;
  }
}

/**
 * 获取用户的所有套装收藏
 * 
 * @param sessionId - 用户会话ID
 * @param page - 页码（从1开始）
 * @param limit - 每页数量
 * @returns 套装列表和分页信息
 */
export async function getSavedSets(
  sessionId: string,
  page: number = 1,
  limit: number = 10
) {
  try {
    const skip = (page - 1) * limit;

    // 查询套装列表（包含关联数据）
    const [savedSets, total] = await Promise.all([
      prisma.savedSet.findMany({
        where: { sessionId },
        include: {
          dish: true,
          recipes: {
            include: {
              recipe: true
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

    return {
      savedSets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('获取套装列表失败:', error);
    throw new Error(`获取套装列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 删除套装收藏
 * 
 * @param sessionId - 用户会话ID（用于权限验证）
 * @param savedSetId - 套装ID
 */
export async function deleteSavedSet(sessionId: string, savedSetId: string) {
  try {
    // 1. 验证套装是否存在且属于当前用户
    const savedSet = await prisma.savedSet.findUnique({
      where: { id: savedSetId }
    });

    if (!savedSet) {
      throw new Error('套装不存在');
    }

    if (savedSet.sessionId !== sessionId) {
      throw new Error('无权删除此套装');
    }

    // 2. 删除套装（级联删除会自动删除关联的 SavedSetRecipe 记录）
    await prisma.savedSet.delete({
      where: { id: savedSetId }
    });

    console.log(`✅ 删除套装成功: ${savedSetId}`);
  } catch (error) {
    console.error('删除套装失败:', error);
    throw error;
  }
}

