/**
 * SavedSet 套装收藏相关类型定义
 */

import type { DishRecommendation } from './foodPairing';

/**
 * 基础 Recipe 类型（用于 SavedSet 响应）
 */
export interface RecipeInSet {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
  category: string | null;
  glassType: string | null;
  technique: string | null;
  garnish: string | null;
}

/**
 * 基础 Dish 类型（用于 SavedSet 响应）
 */
export interface DishInSet {
  id: string;
  name: string;
  description: string | null;
  cuisine: string;
  requiredIngredients: string[];
  cookingTime: number;
  difficulty: number;
  steps: string[];
  source: string | null;
  tags: string[] | null;
}

/**
 * SavedSet 完整类型（包含关联的 Dish 和 Recipe）
 */
export interface SavedSetWithRelations {
  id: string;
  sessionId: string;
  name: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  dish: DishInSet;
  recipes: RecipeInSet[];
}

/**
 * 创建套装收藏请求
 */
export interface CreateSavedSetRequest {
  /** 菜品数据（DishRecommendation 接口） */
  dish: DishRecommendation;
  /** 酒品ID数组（必需，非空） */
  recipeIds: string[];
  /** 套装名称（可选） */
  name?: string;
  /** 套装描述（可选） */
  description?: string;
}

/**
 * 创建套装收藏响应
 */
export interface CreateSavedSetResponse {
  success: boolean;
  savedSet?: SavedSetWithRelations;
  error?: string;
  details?: string;
}

/**
 * 获取套装列表响应
 */
export interface GetSavedSetsResponse {
  success: boolean;
  savedSets?: SavedSetWithRelations[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  details?: string;
}

/**
 * 删除套装请求
 */
export interface DeleteSavedSetRequest {
  /** 套装ID */
  savedSetId: string;
}

/**
 * 删除套装响应
 */
export interface DeleteSavedSetResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
}

