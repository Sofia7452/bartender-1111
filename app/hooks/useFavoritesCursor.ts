/**
 * 收藏列表 Hook - 游标分页版本
 * 
 * 支持"加载更多"模式，解决深分页性能问题
 * 
 * ## 使用示例
 * 
 * ```tsx
 * function FavoritesPage() {
 *   const {
 *     favorites,
 *     isLoading,
 *     isLoadingMore,
 *     hasMore,
 *     error,
 *     loadMore,
 *     refresh,
 *   } = useFavoritesCursor({ limit: 3 });
 * 
 *   return (
 *     <div>
 *       {favorites.map(fav => (
 *         <FavoriteCard key={fav.id} favorite={fav} />
 *       ))}
 *       
 *       {hasMore && (
 *         <button onClick={loadMore} disabled={isLoadingMore}>
 *           {isLoadingMore ? '加载中...' : '加载更多'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## 特性
 * - ✅ 无限滚动支持
 * - ✅ 自动累积数据
 * - ✅ 性能优化（游标分页）
 * - ✅ 加载状态管理
 * - ✅ 错误处理
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CursorPaginationResponse } from '../types/pagination';

/**
 * 收藏项数据结构
 */
export interface FavoriteWithRecipe {
  id: string;
  sessionId: string;
  recipeId: string;
  createdAt: Date;
  recipe: {
    id: string;
    name: string;
    description: string | null;
    ingredients: any[];
    steps: any[];
    difficulty: number;
    estimatedTime: number;
    category: string | null;
    glassType: string | null;
    technique: string | null;
    garnish: string | null;
  };
}

/**
 * API 响应结构
 */
interface FavoritesResponse {
  success: boolean;
  favorites: FavoriteWithRecipe[];
  pagination: CursorPaginationResponse<string>;
  error?: string;
}

/**
 * Hook 参数
 */
interface UseFavoritesCursorOptions {
  /** 每次加载的数量（默认3） */
  limit?: number;
  /** 是否自动加载第一页（默认true） */
  autoLoad?: boolean;
}

/**
 * Hook 返回值
 */
interface UseFavoritesCursorReturn {
  /** 收藏列表（累积所有已加载的数据） */
  favorites: FavoriteWithRecipe[];
  /** 是否正在加载第一页 */
  isLoading: boolean;
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 错误信息 */
  error: string | null;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新列表（重新加载第一页） */
  refresh: () => Promise<void>;
  /** 清空列表 */
  clear: () => void;
}

/**
 * 收藏列表 Hook（游标分页）
 * 
 * @param options - 配置选项
 * @returns Hook 返回值
 */
export function useFavoritesCursor(
  options: UseFavoritesCursorOptions = {}
): UseFavoritesCursorReturn {
  const { limit = 3, autoLoad = true } = options;

  // 状态管理
  const [favorites, setFavorites] = useState<FavoriteWithRecipe[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载数据的通用函数
   * 
   * @param cursor - 游标（null 表示加载第一页）
   * @param append - 是否追加到现有数据（true）或替换（false）
   */
  const loadData = useCallback(
    async (cursor: string | null, append: boolean) => {
      try {
        // 设置加载状态
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        // 构建 URL
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) {
          params.set('cursor', cursor);
        }

        console.log(`📋 [游标分页] 加载收藏列表，cursor: ${cursor ? '存在' : '无'}, append: ${append}`);

        // 发起请求
        const response = await fetch(`/api/favorites-cursor?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const data: FavoritesResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || '加载失败');
        }

        console.log(`✅ [游标分页] 加载成功，返回 ${data.favorites.length} 条数据，hasMore: ${data.pagination.hasMore}`);

        // 更新状态
        if (append) {
          // 追加模式：将新数据添加到现有数据后面
          setFavorites((prev) => [...prev, ...data.favorites]);
        } else {
          // 替换模式：用新数据替换现有数据
          setFavorites(data.favorites);
        }

        setNextCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);

      } catch (err) {
        console.error('❌ [游标分页] 加载失败:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [limit]
  );

  /**
   * 加载第一页
   */
  const loadFirstPage = useCallback(async () => {
    await loadData(null, false);
  }, [loadData]);

  /**
   * 加载更多（下一页）
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      console.log(`⚠️ [游标分页] 无法加载更多，hasMore: ${hasMore}, isLoadingMore: ${isLoadingMore}`);
      return;
    }

    if (!nextCursor) {
      console.warn('⚠️ [游标分页] nextCursor 为空，无法加载更多');
      return;
    }

    await loadData(nextCursor, true);
  }, [hasMore, isLoadingMore, nextCursor, loadData]);

  /**
   * 刷新列表
   */
  const refresh = useCallback(async () => {
    console.log('🔄 [游标分页] 刷新收藏列表');
    await loadFirstPage();
  }, [loadFirstPage]);

  /**
   * 清空列表
   */
  const clear = useCallback(() => {
    console.log('🗑️ [游标分页] 清空收藏列表');
    setFavorites([]);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
  }, []);

  /**
   * 自动加载第一页
   */
  useEffect(() => {
    if (autoLoad) {
      loadFirstPage();
    }
  }, [autoLoad, loadFirstPage]);

  return {
    favorites,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    clear,
  };
}
